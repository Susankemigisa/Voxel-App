"""
TranslationService — Stage 4 of the Voice Reconstruction Pipeline (optional).
Handles bidirectional English ↔ Luganda translation via Helsinki-NLP models.
"""
import logging
import asyncio
from dataclasses import dataclass

import httpx

from app.services.model_loader import model_registry
from app.models.schemas import Language
from app.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class TranslationResult:
    source_text:  str
    translated:   str
    source_lang:  str
    target_lang:  str
    model_used:   str


class TranslationService:

    def _strategy(self) -> str:
        strategy = (settings.translate_strategy or "local").strip().lower()
        if strategy not in {"auto", "modal", "local"}:
            logger.warning("Invalid TRANSLATE_STRATEGY=%r, defaulting to 'local'", strategy)
            return "local"
        return strategy

    def _modal_url_for(self, source_lang: Language, target_lang: Language) -> str:
        if source_lang == Language.EN and target_lang == Language.LG:
            return settings.translate_modal_en_lg_url
        if source_lang == Language.LG and target_lang == Language.EN:
            return settings.translate_modal_lg_en_url
        return ""

    async def translate(
        self,
        text:        str,
        source_lang: Language,
        target_lang: Language,
    ) -> TranslationResult:
        if source_lang == target_lang:
            return TranslationResult(
                source_text = text,
                translated  = text,
                source_lang = source_lang.value,
                target_lang = target_lang.value,
                model_used  = "none",
            )

        strategy = self._strategy()
        modal_url = self._modal_url_for(source_lang, target_lang)

        if strategy in {"auto", "modal"}:
            if modal_url:
                try:
                    return await self._translate_modal(text, source_lang, target_lang, modal_url)
                except Exception as e:
                    if strategy == "modal":
                        raise RuntimeError(f"Modal translation failed: {e}") from e
                    logger.warning("Modal translation failed — falling back to local: %s", e)
            elif strategy == "modal":
                raise RuntimeError(
                    f"Modal translation URL not configured for {source_lang.value}->{target_lang.value}"
                )

        key      = f"translate_{source_lang.value}_{target_lang.value}"
        model_id = (
            settings.hf_translate_en_lg
            if source_lang == Language.EN
            else settings.hf_translate_lg_en
        )

        if not model_registry.is_loaded(key):
            if source_lang == Language.EN:
                model_registry.load_translate_en_lg()
            else:
                model_registry.load_translate_lg_en()

        loaded = model_registry.get(key)
        if not loaded or not loaded.loaded:
            raise RuntimeError(f"Translation model {key} not available")

        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self._translate_sync,
            text,
            loaded.model,
            loaded.extra,   # tokenizer
            loaded.device,
            source_lang,
            target_lang,
            model_id,
        )
        return result

    async def _translate_modal(
        self,
        text: str,
        source_lang: Language,
        target_lang: Language,
        modal_url: str,
    ) -> TranslationResult:
        headers = {"Content-Type": "application/json"}
        if settings.translate_modal_token:
            headers["Authorization"] = f"Bearer {settings.translate_modal_token}"

        payload = {
            "text": text,
            "source_lang": source_lang.value,
            "target_lang": target_lang.value,
        }

        async with httpx.AsyncClient(timeout=settings.translate_modal_timeout_s) as client:
            response = await client.post(modal_url, json=payload, headers=headers)

        if response.status_code != 200:
            raise RuntimeError(f"Modal endpoint returned {response.status_code}: {response.text}")

        result = response.json()
        translated = (result.get("translated") or "").strip()
        if not translated:
            raise RuntimeError("Empty translation from Modal endpoint")

        return TranslationResult(
            source_text=text,
            translated=translated,
            source_lang=source_lang.value,
            target_lang=target_lang.value,
            model_used=result.get("model_used", "modal"),
        )

    def _translate_sync(
        self,
        text:        str,
        model:       any,
        tokenizer:   any,
        device:      str,
        source_lang: Language,
        target_lang: Language,
        model_id:    str,
    ) -> TranslationResult:
        import torch
        try:
            inputs = tokenizer(text, return_tensors="pt", padding=True).to(device)
            with torch.no_grad():
                translated_tokens = model.generate(**inputs, max_new_tokens=256)
            translated = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

            return TranslationResult(
                source_text = text,
                translated  = translated,
                source_lang = source_lang.value,
                target_lang = target_lang.value,
                model_used  = model_id,
            )
        except Exception as e:
            logger.error("Translation failed: %s", e)
            raise RuntimeError(f"Translation failed: {e}") from e


# Singleton
translation_service = TranslationService()
