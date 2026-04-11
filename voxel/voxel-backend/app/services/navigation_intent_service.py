"""
Navigation intent service.

Extracts destination intent from transcripts with strategy-based routing:
- modal: call remote Modal endpoint only
- auto: try Modal first, fallback to local rules
- local: use local rules only
"""
import logging
import re
from dataclasses import dataclass

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


EN_TRIGGERS = [
    "take me to", "navigate to", "go to", "directions to", "how do i get to",
    "i want to go to", "i need to go to", "bring me to", "head to",
    "route to", "find route to", "get me to", "drive to", "walk to",
]

LG_TRIGGERS = [
    "ntwala e", "ntwale e", "ntwala ku", "ntwale ku", "genda e", "genda ku",
    "nsomeze", "genda", "njigiriza", "nsobola otya okugenda", "nsobola ngenda",
    "nfuna ekkubo okutuuka", "ngenda", "nkolere ekkubo",
    "kundagirira", "kundagirila", "ndagirira", "ndagira e", "ndagira ku",
]

UGANDA_PLACES = [
    "kampala", "entebbe", "jinja", "mbale", "gulu", "mbarara", "fort portal",
    "fortportal", "lira", "arua", "soroti", "kabale", "masaka", "tororo",
    "ntinda", "kawempe", "nakawa", "makindye", "rubaga", "kireka", "naalya",
    "mukono", "wakiso", "bweyogerere", "kyaliwajjala", "kira", "namugongo",
    "gayaza", "matugga", "bombo", "luwero", "wobulenzi", "zirobwe",
    "kololo", "naguru", "bukoto", "kamwokya", "mulago", "wandegeya",
    "makerere", "kivulu", "nakulabye", "lubaga", "mengo", "nsambya",
    "bugolobi", "luzira", "portbell", "muyenga", "ggaba", "kabalagala",
    "kisugu", "namuwongo", "katwe", "kisenyi", "old taxi park", "new taxi park",
    "owino", "nakasero", "city centre", "garden city", "acacia mall",
    "palace of the republic", "parliament", "makerere university",
    "mulago hospital", "kampala hospital", "aga khan", "case hospital",
    "entebbe airport", "entebbe international airport",
    "kyebando", "mpigi", "kalangala",
]

ASR_PLACE_ALIASES = {
    "mpijgi": "mpigi",
    "mpiggi": "mpigi",
    "mpiji": "mpigi",
    "kalangalaa": "kalangala",
    "kolangala": "kalangala",
}


@dataclass
class NavigationIntentResult:
    is_navigation: bool
    destination: str = ""
    query: str = ""
    confidence: float = 0.0
    corrected_text: str = ""
    reason: str = ""


class NavigationIntentService:
    def _strategy(self) -> str:
        strategy = (settings.navigation_intent_strategy or "local").strip().lower()
        if strategy not in {"auto", "modal", "local"}:
            logger.warning("Invalid NAVIGATION_INTENT_STRATEGY=%r, defaulting to 'local'", strategy)
            return "local"
        return strategy

    async def extract(self, transcript: str, language: str = "en") -> NavigationIntentResult:
        text = (transcript or "").strip()
        if not text:
            return NavigationIntentResult(False, corrected_text="", reason="empty transcript")

        strategy = self._strategy()

        if strategy in {"auto", "modal"}:
            if settings.navigation_modal_url:
                try:
                    return await self._extract_modal(text=text, language=language)
                except Exception as e:
                    if strategy == "modal":
                        raise RuntimeError(f"Modal navigation extraction failed: {e}") from e
                    logger.warning("Modal navigation extraction failed, using local fallback: %r", e)
            elif strategy == "modal":
                raise RuntimeError("Modal navigation mode requires NAVIGATION_MODAL_URL")

        return self.extract_local(text=text)

    def extract_local(self, text: str) -> NavigationIntentResult:
        return self._extract_local(text=text)

    async def _extract_modal(self, text: str, language: str) -> NavigationIntentResult:
        headers = {"Content-Type": "application/json"}
        if settings.navigation_modal_token:
            headers["Authorization"] = f"Bearer {settings.navigation_modal_token}"

        payload = {
            "transcript": text,
            "language": language,
            "country_bias": "Uganda",
        }

        async with httpx.AsyncClient(timeout=settings.navigation_modal_timeout_s) as client:
            response = await client.post(settings.navigation_modal_url, json=payload, headers=headers)

        if response.status_code != 200:
            raise RuntimeError(f"Modal endpoint returned {response.status_code}: {response.text}")

        data = response.json()

        destination = self._sanitize_destination((data.get("destination") or "").strip(), text)
        corrected_text = (data.get("corrected_text") or text).strip()
        is_navigation = bool(data.get("is_navigation", False))
        confidence = float(data.get("confidence", 0.0))
        reason = str(data.get("reason", "modal"))

        query = self._build_query(destination) if destination else ""
        return NavigationIntentResult(
            is_navigation=is_navigation and bool(destination),
            destination=self._format_destination(destination) if destination else "",
            query=query,
            confidence=max(0.0, min(1.0, confidence)),
            corrected_text=corrected_text,
            reason=reason,
        )

    def _extract_local(self, text: str) -> NavigationIntentResult:
        norm = self._normalise(text)
        for wrong, correct in ASR_PLACE_ALIASES.items():
            norm = norm.replace(wrong, correct)

        for trigger in EN_TRIGGERS:
            if trigger in norm:
                after = norm.split(trigger, 1)[1].strip()
                if len(after) > 1:
                    return self._build_result(after, text, 0.9, "local trigger en")

        for trigger in LG_TRIGGERS:
            if trigger in norm:
                after = norm.split(trigger, 1)[1].strip()
                if len(after) > 1:
                    return self._build_result(after, text, 0.85, "local trigger lg")

        for place in UGANDA_PLACES:
            if norm == place or norm.startswith(place) or norm.endswith(place):
                return self._build_result(place, text, 0.75, "local exact place")

        if len(norm.split(" ")) <= 5:
            for place in UGANDA_PLACES:
                if place in norm:
                    return self._build_result(place, text, 0.65, "local partial place")

        return NavigationIntentResult(
            is_navigation=False,
            destination="",
            query="",
            confidence=0.0,
            corrected_text=text.strip(),
            reason="no navigation intent",
        )

    def _build_result(self, raw_destination: str, corrected: str, confidence: float, reason: str) -> NavigationIntentResult:
        destination = self._sanitize_destination(raw_destination, corrected)
        return NavigationIntentResult(
            is_navigation=True,
            destination=destination,
            query=self._build_query(destination),
            confidence=confidence,
            corrected_text=corrected.strip(),
            reason=reason,
        )

    def _sanitize_destination(self, destination: str, context_text: str) -> str:
        text = self._normalise(destination)
        context = self._normalise(context_text)

        for wrong, correct in ASR_PLACE_ALIASES.items():
            text = text.replace(wrong, correct)
            context = context.replace(wrong, correct)

        # Prefer known place mentions from destination first, then full context.
        for source in (text, context):
            for place in UGANDA_PLACES:
                if place in source:
                    return self._format_destination(place)

        # Strip conversational wrappers commonly seen in Luganda requests.
        wrappers = [
            "sayidizeyo", "sayidiizeyo", "sayirizeyo", "sayirize eyo", "sayiriz eyo",
            "nyamba", "njagala kugenda",
            "gye bayita", "ebayita", "bayita", "gyebayita",
        ]
        cleaned = text
        for w in wrappers:
            cleaned = cleaned.replace(w, " ")

        cleaned = re.sub(r"\s+", " ", cleaned).strip(" -,")
        if cleaned:
            return self._format_destination(cleaned)

        return self._format_destination(destination)

    def _normalise(self, text: str) -> str:
        return re.sub(r"\s+", " ", re.sub(r"[.,!?'\"]", "", text.lower())).strip()

    def _format_destination(self, raw: str) -> str:
        words = [w for w in raw.split(" ") if w]
        text = " ".join(w[:1].upper() + w[1:] for w in words)
        text = re.sub(r"\b(Uganda|UG)\b", "", text, flags=re.IGNORECASE).strip()
        return text

    def _build_query(self, destination: str) -> str:
        dest = destination.strip()
        if not dest:
            return ""
        if "uganda" in dest.lower():
            return dest
        return f"{dest}, Uganda"


navigation_intent_service = NavigationIntentService()
