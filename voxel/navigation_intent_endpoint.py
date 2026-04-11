# Modal endpoint for transcript correction and location extraction.
# Deploy:
#   modal deploy navigation_intent_endpoint.py
#
# Request JSON:
# {
#   "transcript": "take me to ntnda",
#   "language": "en",
#   "country_bias": "Uganda"
# }
#
# Response JSON:
# {
#   "is_navigation": true,
#   "destination": "Ntinda",
#   "query": "Ntinda, Uganda",
#   "confidence": 0.84,
#   "corrected_text": "Take me to Ntinda",
#   "reason": "model extraction"
# }

import json
import re

import modal

APP_NAME = "voxel-navigation-intent-endpoint-v1"
GPU = "L4"
SCALEDOWN = 60 * 20
MODEL_ID = "CraneAILabs/ganda-gemma-1b"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]",
        "torch",
        "transformers",
    )
)

app = modal.App(APP_NAME)

with image.imports():
    import torch
    from fastapi import Body, HTTPException
    from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline


def _extract_json_block(text: str) -> dict:
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("No JSON object found in model output")
    return json.loads(m.group(0))


UGANDA_PLACES = [
    "kampala", "entebbe", "jinja", "mbale", "gulu", "mbarara", "fort portal",
    "lira", "arua", "soroti", "kabale", "masaka", "tororo", "ntinda", "kawempe",
    "nakawa", "makindye", "rubaga", "kireka", "naalya", "mukono", "wakiso",
    "bweyogerere", "kira", "namugongo", "kololo", "naguru", "bukoto", "kamwokya",
    "mulago", "wandegeya", "makerere", "mengo", "nsambya", "bugolobi", "luzira",
    "muyenga", "ggaba", "kabalagala", "katwe", "kisenyi", "nakasero",
    "garden city", "acacia mall", "makerere university", "mulago hospital",
    "entebbe airport", "entebbe international airport",
]


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[.,!?\"']", "", text.lower())).strip()


def _format_destination(raw: str) -> str:
    words = [w for w in raw.split(" ") if w]
    out = " ".join(w[:1].upper() + w[1:] for w in words)
    return re.sub(r"\b(Uganda|UG)\b", "", out, flags=re.IGNORECASE).strip()


def _build_query(destination: str, country_bias: str) -> str:
    d = destination.strip()
    if not d:
        return ""
    if country_bias.lower() in d.lower():
        return d
    return f"{d}, {country_bias}"


def _rule_fallback(transcript: str, language: str, country_bias: str) -> dict:
    text = _normalise(transcript)

    en_triggers = [
        "take me to", "navigate to", "go to", "directions to", "how do i get to",
        "i want to go to", "i need to go to", "bring me to", "head to",
    ]
    lg_triggers = [
        "ntwala e", "ntwale e", "ntwala ku", "ntwale ku", "genda e", "genda ku",
        "nsomeze", "njigiriza", "nkolere ekkubo", "nfuna ekkubo okutuuka",
    ]

    for trigger in (lg_triggers if language == "lg" else en_triggers + lg_triggers):
        if trigger in text:
            after = text.split(trigger, 1)[1].strip()
            if len(after) > 1:
                dest = _format_destination(after)
                return {
                    "is_navigation": True,
                    "destination": dest,
                    "query": _build_query(dest, country_bias),
                    "confidence": 0.82,
                    "corrected_text": transcript.strip(),
                    "reason": "rule fallback trigger",
                }

    for place in UGANDA_PLACES:
        if text == place or text.startswith(place) or text.endswith(place) or place in text:
            dest = _format_destination(place)
            return {
                "is_navigation": True,
                "destination": dest,
                "query": _build_query(dest, country_bias),
                "confidence": 0.7,
                "corrected_text": transcript.strip(),
                "reason": "rule fallback place",
            }

    return {
        "is_navigation": False,
        "destination": "",
        "query": "",
        "confidence": 0.0,
        "corrected_text": transcript.strip(),
        "reason": "rule fallback no intent",
    }


@app.cls(
    image=image,
    gpu=GPU,
    scaledown_window=SCALEDOWN,
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=16)
class NavigationExtractor:
    @modal.enter()
    def enter(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
        )
        if self.device == "cuda":
            self.model = self.model.to("cuda")

        self.generator = pipeline(
            "text-generation",
            model=self.model,
            tokenizer=self.tokenizer,
            device=0 if self.device == "cuda" else -1,
        )

    @modal.fastapi_endpoint(method="POST", docs=True)
    def extract(self, payload: dict = Body(...)):
        transcript = (payload.get("transcript") or "").strip()
        language = (payload.get("language") or "en").strip().lower()
        country_bias = (payload.get("country_bias") or "Uganda").strip()

        if not transcript:
            raise HTTPException(status_code=422, detail="'transcript' is required")
        if language not in {"en", "lg"}:
            raise HTTPException(status_code=422, detail="language must be 'en' or 'lg'")

        prompt = (
            "You are a strict JSON API for navigation intent extraction. "
            "Given a noisy speech transcript, correct obvious ASR mistakes and extract destination if present.\n"
            "Return ONLY valid JSON with keys: is_navigation, destination, query, confidence, corrected_text, reason.\n"
            "Rules:\n"
            "- is_navigation must be boolean.\n"
            "- destination should be empty string when not navigation.\n"
            f"- query should include '{country_bias}' when destination exists.\n"
            "- confidence must be number 0..1.\n"
            "- corrected_text should preserve original meaning.\n"
            "- reason should be short.\n"
            "Examples:\n"
            "Input: take me to ntinda\n"
            "Output: {\"is_navigation\":true,\"destination\":\"Ntinda\",\"query\":\"Ntinda, Uganda\",\"confidence\":0.9,\"corrected_text\":\"take me to ntinda\",\"reason\":\"navigation request\"}\n"
            "Input: ntwala e ntinda\n"
            "Output: {\"is_navigation\":true,\"destination\":\"Ntinda\",\"query\":\"Ntinda, Uganda\",\"confidence\":0.9,\"corrected_text\":\"ntwala e ntinda\",\"reason\":\"luganda navigation request\"}\n"
            f"Language: {language}\n"
            f"Transcript: {transcript}\n"
            "JSON:"
        )

        out = self.generator(
            prompt,
            max_new_tokens=110,
            do_sample=False,
            return_full_text=False,
        )
        generated = out[0]["generated_text"].strip()

        try:
            parsed = _extract_json_block(generated)
        except Exception:
            parsed = _rule_fallback(transcript=transcript, language=language, country_bias=country_bias)

        destination = str(parsed.get("destination", "")).strip()
        corrected_text = str(parsed.get("corrected_text", transcript)).strip()
        is_navigation = bool(parsed.get("is_navigation", False)) and bool(destination)

        query = str(parsed.get("query", "")).strip()
        if destination and not query:
            query = f"{destination}, {country_bias}"

        confidence = parsed.get("confidence", 0.0)
        try:
            confidence = max(0.0, min(1.0, float(confidence)))
        except Exception:
            confidence = 0.0

        reason = str(parsed.get("reason", "model extraction")).strip() or "model extraction"

        return {
            "is_navigation": is_navigation,
            "destination": destination,
            "query": query,
            "confidence": confidence,
            "corrected_text": corrected_text,
            "reason": reason,
        }
