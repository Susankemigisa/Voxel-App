# Combined Modal endpoint for Voxel (ASR + Translation + TTS) on one deployment.
#
# Deploy:
#   modal deploy voice_endpoints.py
#
# Example base URL after deploy:
#   https://xxxxx--voxel-voice-endpoints-fastapi-app.modal.run
#
# Routes:
#   POST /asr/transcribe   (multipart/form-data: wav, language, use_word_timestamps)
#   POST /translate        (json: text, source_lang, target_lang)
#   POST /tts/synthesize   (json: text, language, voice, pitch, rate)

from pathlib import Path
from typing import Optional
import base64
import io

import modal
from fastapi import FastAPI, File, Form, HTTPException

APP_NAME = "voxel-voice-endpoints"
GPU = "L4"
SCALEDOWN = 60 * 2

SAMPLE_RATE = 16000
BEAM_SIZE = 5
MODEL_MOUNT_DIR = Path("/models")
MODEL_DOWNLOAD_DIR = Path("downloads")

WHISPER_MODEL_ID = "openai/whisper-small"
TRANSLATE_EN_LG_MODEL = "Helsinki-NLP/opus-mt-en-lg"
TRANSLATE_LG_EN_MODEL = "Helsinki-NLP/opus-mt-lg-en"
TTS_EN_MODEL = "facebook/mms-tts-eng"
TTS_LG_MODEL = "facebook/mms-tts-lug"

image = (
    modal.Image.from_registry("nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04", add_python="3.11")
    .apt_install("git")
    .pip_install(
        "fastapi[standard]",
        "numpy",
        "librosa",
        "soundfile",
        "torch",
        "transformers==4.44.2",
        "sentencepiece",
        "huggingface_hub[hf_transfer]==0.26.2",
        "ctranslate2==4.4.0",
        "faster_whisper==1.0.3",
    )
)

app = modal.App(APP_NAME)
volume = modal.Volume.from_name(APP_NAME, create_if_missing=True)

with image.imports():
    import numpy as np
    import librosa
    import soundfile as sf
    import torch
    import ctranslate2

    from faster_whisper import WhisperModel
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, VitsModel, VitsTokenizer


# -----------------------------
# Lazy Runtime Model Manager
# -----------------------------

class RuntimeModels:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._whisper = None

        self._tok_en_lg = None
        self._mod_en_lg = None
        self._tok_lg_en = None
        self._mod_lg_en = None

        self._tts_tok_en = None
        self._tts_mod_en = None
        self._tts_tok_lg = None
        self._tts_mod_lg = None

    def _maybe_download_and_convert_whisper(self, model_storage_dir: Path, model_id: str) -> str:
        subdir = model_id.replace("/", "_") + "_ct2"
        model_path = model_storage_dir / subdir

        if not model_path.exists():
            model_path.mkdir(parents=True, exist_ok=True)
            converter = ctranslate2.converters.TransformersConverter(model_name_or_path=model_id)
            converter.convert(str(model_path), quantization="float16", force=True)

        return str(model_path)

    def get_whisper(self):
        if self._whisper is None:
            model_dir = MODEL_MOUNT_DIR / MODEL_DOWNLOAD_DIR
            model_path = self._maybe_download_and_convert_whisper(model_dir, WHISPER_MODEL_ID)
            self._whisper = WhisperModel(model_path, device="cuda", compute_type="float16")
        return self._whisper

    def get_translator(self, source_lang: str, target_lang: str):
        if source_lang == "en" and target_lang == "lg":
            if self._tok_en_lg is None or self._mod_en_lg is None:
                self._tok_en_lg = AutoTokenizer.from_pretrained(TRANSLATE_EN_LG_MODEL)
                self._mod_en_lg = AutoModelForSeq2SeqLM.from_pretrained(TRANSLATE_EN_LG_MODEL).to(self.device)
                self._mod_en_lg.eval()
            return self._tok_en_lg, self._mod_en_lg, TRANSLATE_EN_LG_MODEL

        if source_lang == "lg" and target_lang == "en":
            if self._tok_lg_en is None or self._mod_lg_en is None:
                self._tok_lg_en = AutoTokenizer.from_pretrained(TRANSLATE_LG_EN_MODEL)
                self._mod_lg_en = AutoModelForSeq2SeqLM.from_pretrained(TRANSLATE_LG_EN_MODEL).to(self.device)
                self._mod_lg_en.eval()
            return self._tok_lg_en, self._mod_lg_en, TRANSLATE_LG_EN_MODEL

        raise ValueError("Unsupported language direction")

    def get_tts(self, language: str):
        if language == "en":
            if self._tts_tok_en is None or self._tts_mod_en is None:
                self._tts_tok_en = VitsTokenizer.from_pretrained(TTS_EN_MODEL)
                self._tts_mod_en = VitsModel.from_pretrained(TTS_EN_MODEL).to(self.device)
                self._tts_mod_en.eval()
            return self._tts_tok_en, self._tts_mod_en

        if language == "lg":
            if self._tts_tok_lg is None or self._tts_mod_lg is None:
                self._tts_tok_lg = VitsTokenizer.from_pretrained(TTS_LG_MODEL)
                self._tts_mod_lg = VitsModel.from_pretrained(TTS_LG_MODEL).to(self.device)
                self._tts_mod_lg.eval()
            return self._tts_tok_lg, self._tts_mod_lg

        raise ValueError("Unsupported language")


runtime = RuntimeModels()


# -----------------------------
# Route Handlers
# -----------------------------

web = FastAPI(title="Voxel Unified Voice Endpoints", version="1.0.0")


@web.get("/health")
def health():
    return {
        "status": "ok",
        "device": runtime.device,
        "routes": ["/asr/transcribe", "/translate", "/tts/synthesize"],
    }


@web.post("/asr/transcribe")
def asr_transcribe(
    wav: bytes = File(...),
    language: Optional[str] = Form(default="en"),
    use_word_timestamps: bool = Form(default=False),
):
    if language not in {"en", "lg", None}:
        raise HTTPException(status_code=422, detail="language must be 'en' or 'lg'")

    audio_array, _ = librosa.load(io.BytesIO(wav), sr=SAMPLE_RATE)

    model = runtime.get_whisper()
    segments, _ = model.transcribe(
        audio_array,
        beam_size=BEAM_SIZE,
        language=language,
        task="transcribe",
        condition_on_previous_text=False,
        vad_filter=True,
        word_timestamps=use_word_timestamps,
    )

    transcript = ""
    segment_texts = []
    confidences = []
    compression_ratios = []
    words = []

    for segment in segments:
        transcript += segment.text + " "
        segment_texts.append(segment.text)
        confidences.append(float(np.exp(segment.avg_logprob)))
        compression_ratios.append(float(segment.compression_ratio))
        if segment.words:
            words.extend(segment.words)

    transcript = transcript.strip()

    return {
        "result": "success",
        "transcription": transcript,
        "segments": segment_texts,
        "confidences": confidences,
        "compression_ratios": compression_ratios,
        "words": words,
    }


@web.post("/translate")
def translate(payload: dict):
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

    tokenizer, model, model_used = runtime.get_translator(source_lang, target_lang)

    with torch.no_grad():
        inputs = tokenizer(text, return_tensors="pt", padding=True).to(runtime.device)
        out_ids = model.generate(**inputs, max_new_tokens=256)
        translated = tokenizer.batch_decode(out_ids, skip_special_tokens=True)[0]

    return {
        "source_text": text,
        "translated": translated,
        "source_lang": source_lang,
        "target_lang": target_lang,
        "model_used": model_used,
    }


@web.post("/tts/synthesize")
def tts_synthesize(payload: dict):
    text = (payload.get("text") or "").strip()
    language = (payload.get("language") or "en").strip().lower()
    voice = (payload.get("voice") or "female").strip().lower()
    pitch = float(payload.get("pitch", 0.5))
    rate = float(payload.get("rate", 1.0))

    if not text:
        raise HTTPException(status_code=422, detail="'text' is required")
    if language not in {"en", "lg"}:
        raise HTTPException(status_code=422, detail="language must be 'en' or 'lg'")
    if voice not in {"female", "male", "robot"}:
        raise HTTPException(status_code=422, detail="voice must be 'female', 'male', or 'robot'")

    tokenizer, model = runtime.get_tts(language)

    if voice == "robot":
        pitch = max(0.0, pitch - 0.25)

    with torch.no_grad():
        inputs = tokenizer(text, return_tensors="pt").to(runtime.device)
        output = model(**inputs)

    waveform = output.waveform[0].cpu().numpy().astype(np.float32)
    sample_rate = int(model.config.sampling_rate)

    if abs(pitch - 0.5) > 0.05:
        n_steps = (pitch - 0.5) * 12.0
        waveform = librosa.effects.pitch_shift(waveform, sr=sample_rate, n_steps=n_steps)

    if abs(rate - 1.0) > 0.05:
        bounded_rate = max(0.5, min(1.5, float(rate)))
        waveform = librosa.effects.time_stretch(waveform, rate=bounded_rate)

    buf = io.BytesIO()
    sf.write(buf, waveform, sample_rate, format="WAV", subtype="PCM_16")
    wav_bytes = buf.getvalue()
    duration_ms = int(len(waveform) / sample_rate * 1000)

    return {
        "audio_base64": base64.b64encode(wav_bytes).decode("utf-8"),
        "duration_ms": duration_ms,
        "sample_rate": sample_rate,
        "voice": voice,
        "text": text,
    }


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("huggingface-secret")],
    gpu=GPU,
    scaledown_window=SCALEDOWN,
    enable_memory_snapshot=True,
    volumes={MODEL_MOUNT_DIR: volume},
)
@modal.asgi_app()
def fastapi_app():
    return web
