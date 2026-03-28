# Modal TTS endpoint for Voxel backend.
# Deploy:
#   modal deploy tts_endpoint.py
#
# Endpoint accepts JSON:
# {
#   "text": "Hello",
#   "language": "en",
#   "voice": "female",
#   "pitch": 0.5,
#   "rate": 1.0
# }

import base64
import io

import modal

MODAL_APP_NAME = "voxel-tts-endpoint-v1"
GPU = "L4"
SCALEDOWN = 60 * 2

MODEL_EN = "facebook/mms-tts-eng"
MODEL_LG = "facebook/mms-tts-lug"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]",
        "torch",
        "transformers",
        "librosa",
        "soundfile",
        "numpy",
    )
)

app = modal.App(MODAL_APP_NAME)

with image.imports():
    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    from fastapi import Body, HTTPException
    from transformers import VitsModel, VitsTokenizer


@app.cls(
    image=image,
    gpu=GPU,
    scaledown_window=SCALEDOWN,
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=12)
class TTS:
    @modal.enter()
    def enter(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.tok_en = VitsTokenizer.from_pretrained(MODEL_EN)
        self.mod_en = VitsModel.from_pretrained(MODEL_EN).to(self.device)
        self.mod_en.eval()

        self.tok_lg = VitsTokenizer.from_pretrained(MODEL_LG)
        self.mod_lg = VitsModel.from_pretrained(MODEL_LG).to(self.device)
        self.mod_lg.eval()

    def _apply_rate_and_pitch(self, waveform: np.ndarray, sample_rate: int, rate: float, pitch: float) -> np.ndarray:
        waveform = waveform.astype(np.float32)

        if abs(pitch - 0.5) > 0.05:
            n_steps = (pitch - 0.5) * 12.0
            waveform = librosa.effects.pitch_shift(waveform, sr=sample_rate, n_steps=n_steps)

        if abs(rate - 1.0) > 0.05:
            rate = max(0.5, min(1.5, float(rate)))
            waveform = librosa.effects.time_stretch(waveform, rate=rate)

        return waveform

    @modal.fastapi_endpoint(method="POST", docs=True)
    def synthesize(self, payload: dict = Body(...)):
        text = (payload.get("text") or "").strip()
        language = (payload.get("language") or "en").strip().lower()
        voice = (payload.get("voice") or "female").strip().lower()
        pitch = float(payload.get("pitch", 0.5))
        rate = float(payload.get("rate", 1.0))

        if not text:
            raise HTTPException(status_code=422, detail="'text' is required")
        if language not in {"en", "lg"}:
            raise HTTPException(status_code=422, detail="language must be 'en' or 'lg'")

        if language == "en":
            tokenizer = self.tok_en
            model = self.mod_en
        else:
            tokenizer = self.tok_lg
            model = self.mod_lg

        if voice == "robot":
            pitch = max(0.0, pitch - 0.25)

        with torch.no_grad():
            inputs = tokenizer(text, return_tensors="pt").to(self.device)
            output = model(**inputs)

        waveform = output.waveform[0].cpu().numpy()
        sample_rate = int(model.config.sampling_rate)
        waveform = self._apply_rate_and_pitch(waveform, sample_rate, rate, pitch)

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
