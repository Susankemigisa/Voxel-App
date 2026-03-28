# Modal translation endpoint for Voxel backend.
# Deploy:
#   modal deploy translate_endpoint.py
#
# Endpoint accepts JSON:
# {
#   "text": "hello",
#   "source_lang": "en",
#   "target_lang": "lg"
# }

import modal

MODAL_APP_NAME = "voxel-translate-endpoint-v1"
GPU = "L4"
SCALEDOWN = 60 * 2

MODEL_EN_LG = "Helsinki-NLP/opus-mt-en-lg"
MODEL_LG_EN = "Helsinki-NLP/opus-mt-lg-en"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]",
        "torch",
        "transformers",
        "sentencepiece",
    )
)

app = modal.App(MODAL_APP_NAME)

with image.imports():
    import torch
    from fastapi import Body, HTTPException
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer


@app.cls(
    image=image,
    gpu=GPU,
    scaledown_window=SCALEDOWN,
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=16)
class Translator:
    @modal.enter()
    def enter(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.tok_en_lg = AutoTokenizer.from_pretrained(MODEL_EN_LG)
        self.mod_en_lg = AutoModelForSeq2SeqLM.from_pretrained(MODEL_EN_LG).to(self.device)
        self.mod_en_lg.eval()

        self.tok_lg_en = AutoTokenizer.from_pretrained(MODEL_LG_EN)
        self.mod_lg_en = AutoModelForSeq2SeqLM.from_pretrained(MODEL_LG_EN).to(self.device)
        self.mod_lg_en.eval()

    @modal.fastapi_endpoint(method="POST", docs=True)
    def translate(self, payload: dict = Body(...)):
        text = (payload.get("text") or "").strip()
        source_lang = (payload.get("source_lang") or "").strip().lower()
        target_lang = (payload.get("target_lang") or "").strip().lower()

        if not text:
            raise HTTPException(status_code=422, detail="'text' is required")
        if source_lang not in {"en", "lg"} or target_lang not in {"en", "lg"}:
            raise HTTPException(status_code=422, detail="source_lang/target_lang must be 'en' or 'lg'")
        if source_lang == target_lang:
            return {
                "source_text": text,
                "translated": text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "model_used": "none",
            }

        if source_lang == "en" and target_lang == "lg":
            tokenizer = self.tok_en_lg
            model = self.mod_en_lg
            model_used = MODEL_EN_LG
        elif source_lang == "lg" and target_lang == "en":
            tokenizer = self.tok_lg_en
            model = self.mod_lg_en
            model_used = MODEL_LG_EN
        else:
            raise HTTPException(status_code=422, detail="Unsupported language direction")

        with torch.no_grad():
            inputs = tokenizer(text, return_tensors="pt", padding=True).to(self.device)
            out_ids = model.generate(**inputs, max_new_tokens=256)
            translated = tokenizer.batch_decode(out_ids, skip_special_tokens=True)[0]

        return {
            "source_text": text,
            "translated": translated,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "model_used": model_used,
        }
