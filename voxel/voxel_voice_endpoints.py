"""
Voxel Voice Endpoints — Modal deployment for ASR, TTS, and Translation.

Deploy:
  modal deploy voxel_voice_endpoints.py

Endpoints:
  POST /asr/transcribe   — Whisper speech-to-text (multipart form: wav + language)
  POST /tts/synthesize   — MMS / SpeechT5 text-to-speech (JSON)
  POST /translate        — Helsinki-NLP English <-> Luganda translation (JSON)

After deploy, update your .env / Modal secret:
  ASR_MODAL_URL=https://<workspace>--voxel-voice-endpoints-asrendpoint-transcribe.modal.run
  TTS_MODAL_URL=https://<workspace>--voxel-voice-endpoints-ttsendpoint-synthesize.modal.run
  TRANSLATE_MODAL_EN_LG_URL=https://<workspace>--voxel-voice-endpoints-translationendpoint-translate.modal.run
  TRANSLATE_MODAL_LG_EN_URL=https://<workspace>--voxel-voice-endpoints-translationendpoint-translate.modal.run
"""

import base64
import io
import logging

import modal

# ── App & Image ───────────────────────────────────────────────────────────────

APP_NAME  = "voxel-voice-endpoints"
GPU       = "T4"        # cheapest Modal GPU — enough for Whisper + MMS
SCALEDOWN = 60 * 15     # keep warm for 15 min after last request

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "ffmpeg",
        "libsndfile1",
        "libsndfile1-dev",
        "build-essential",
    )
    .pip_install(
        "fastapi[standard]",
        "python-multipart",   # required for UploadFile / Form in FastAPI
        "torch",
        "torchaudio",
        "transformers",
        "accelerate",
        "soundfile",
        "numpy",
        "librosa",
        "datasets",
        "httpx",
    )
)

model_cache = modal.Volume.from_name("voxel-model-cache", create_if_missing=True)

app = modal.App(APP_NAME)

# ── Model IDs ─────────────────────────────────────────────────────────────────

WHISPER_EN_ID       = "openai/whisper-small"
# Ugandan English fine-tuned Whisper — much better for local accents
WHISPER_UG_EN_ID    = "cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"
# Luganda ASR — MMS-1B supports 1000+ languages including Luganda (lug)
MMS_ASR_LG_ID       = "facebook/mms-1b-all"
MMS_TTS_EN_ID       = "facebook/mms-tts-eng"
MMS_TTS_LG_ID       = "facebook/mms-tts-lug"
SPEECHT5_ID         = "microsoft/speecht5_tts"
SPEECHT5_VOCODER_ID = "microsoft/speecht5_hifigan"
TRANSLATE_EN_LG_ID  = "Helsinki-NLP/opus-mt-en-lg"
TRANSLATE_LG_EN_ID  = "Helsinki-NLP/opus-mt-lg-en"
SAMPLE_RATE         = 16000

logger = logging.getLogger(__name__)


# ── ASR Endpoint ──────────────────────────────────────────────────────────────

@app.cls(
    image=image,
    gpu=GPU,
    scaledown_window=SCALEDOWN,
    volumes={"/app/models": model_cache},
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=8)
class ASREndpoint:

    @modal.enter()
    def load(self):
        import torch
        from transformers import (
            WhisperForConditionalGeneration, WhisperProcessor,
            Wav2Vec2ForCTC, AutoProcessor,
        )

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # Primary: Ugandan English fine-tuned Whisper
        try:
            self.processor_ug = WhisperProcessor.from_pretrained(
                WHISPER_UG_EN_ID, cache_dir="/app/models"
            )
            self.model_ug = WhisperForConditionalGeneration.from_pretrained(
                WHISPER_UG_EN_ID, cache_dir="/app/models"
            ).to(self.device)
            self.model_ug.eval()
            logger.info("✅ Ugandan Whisper loaded on %s", self.device)
        except Exception as e:
            logger.warning("Could not load Ugandan Whisper, falling back to standard: %s", e)
            self.model_ug = None
            self.processor_ug = None

        # Fallback English: standard Whisper small
        self.processor_en = WhisperProcessor.from_pretrained(
            WHISPER_EN_ID, cache_dir="/app/models"
        )
        self.model_en = WhisperForConditionalGeneration.from_pretrained(
            WHISPER_EN_ID, cache_dir="/app/models"
        ).to(self.device)
        self.model_en.eval()
        logger.info("✅ Standard Whisper loaded on %s", self.device)

        # Luganda ASR: MMS-1B-all with Luganda adapter
        try:
            self.processor_lg = AutoProcessor.from_pretrained(
                MMS_ASR_LG_ID, cache_dir="/app/models"
            )
            self.processor_lg.tokenizer.set_target_lang("lug")
            self.model_lg = Wav2Vec2ForCTC.from_pretrained(
                MMS_ASR_LG_ID, cache_dir="/app/models",
                target_lang="lug", ignore_mismatched_sizes=True,
            ).to(self.device)
            self.model_lg.eval()
            logger.info("✅ MMS Luganda ASR loaded on %s", self.device)
        except Exception as e:
            logger.warning("Could not load MMS Luganda ASR: %s", e)
            self.model_lg = None
            self.processor_lg = None

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, request: "Request"):  # type: ignore[name-defined]
        """
        Accepts multipart form data:
          wav      — audio file bytes (WAV, 16kHz mono preferred)
          language — "en" or "lg" (default: "en")

        Returns:
          { "transcription": "...", "text": "...", "language": "en", "confidence": 0.95 }
        """
        import numpy as np
        import soundfile as sf
        import torch
        from fastapi import Request

        form     = await request.form()
        language = str(form.get("language", "en")).strip().lower()

        wav_field = form.get("wav")
        if wav_field is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="'wav' field is required in multipart form")

        # Read bytes from UploadFile or raw bytes
        if hasattr(wav_field, "read"):
            wav_bytes = await wav_field.read()
        else:
            wav_bytes = bytes(wav_field)

        # Decode audio
        buf       = io.BytesIO(wav_bytes)
        audio, sr = sf.read(buf, dtype="float32")

        if sr != SAMPLE_RATE:
            import librosa
            audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)

        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        # Route to correct model
        if language == "lg" and self.model_lg is not None:
            # Luganda — MMS wav2vec2
            inputs = self.processor_lg(
                audio, sampling_rate=SAMPLE_RATE, return_tensors="pt", padding=True
            )
            input_values = inputs.input_values.to(self.device)
            with torch.no_grad():
                logits = self.model_lg(input_values).logits
            predicted_ids = torch.argmax(logits, dim=-1)
            transcript    = self.processor_lg.batch_decode(predicted_ids)[0].strip()
            confidence    = float(torch.softmax(logits, dim=-1).max(dim=-1).values.mean().item())
        else:
            # English — prefer Ugandan fine-tuned, fall back to standard Whisper
            model     = self.model_ug     if self.model_ug     else self.model_en
            processor = self.processor_ug if self.processor_ug else self.processor_en

            inputs = processor(audio, sampling_rate=SAMPLE_RATE, return_tensors="pt")
            input_features = inputs.input_features.to(self.device)

            with torch.no_grad():
                predicted_ids = model.generate(
                    input_features,
                    language="english",
                    task="transcribe",
                    no_speech_threshold=0.6,
                    condition_on_prev_tokens=False,
                )

            transcript = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
            confidence = 0.95

        if not transcript:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="No speech detected in audio")

        return {
            "transcription": transcript,
            "text":          transcript,
            "language":      language,
            "confidence":    round(min(max(confidence, 0.0), 1.0), 3),
        }


# ── TTS Endpoint ──────────────────────────────────────────────────────────────

@app.cls(
    image=image,
    gpu=GPU,
    scaledown_window=SCALEDOWN,
    volumes={"/app/models": model_cache},
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=8)
class TTSEndpoint:

    @modal.enter()
    def load(self):
        import torch
        from transformers import (
            VitsModel, VitsTokenizer,
            SpeechT5ForTextToSpeech, SpeechT5Processor, SpeechT5HifiGan,
        )
        from datasets import load_dataset

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        # MMS English TTS (male / robot)
        self.mms_en_tokenizer = VitsTokenizer.from_pretrained(
            MMS_TTS_EN_ID, cache_dir="/app/models"
        )
        self.mms_en_model = VitsModel.from_pretrained(
            MMS_TTS_EN_ID, cache_dir="/app/models"
        ).to(self.device)
        self.mms_en_model.eval()

        # MMS Luganda TTS
        self.mms_lg_tokenizer = VitsTokenizer.from_pretrained(
            MMS_TTS_LG_ID, cache_dir="/app/models"
        )
        self.mms_lg_model = VitsModel.from_pretrained(
            MMS_TTS_LG_ID, cache_dir="/app/models"
        ).to(self.device)
        self.mms_lg_model.eval()

        # SpeechT5 female English TTS
        self.speecht5_processor = SpeechT5Processor.from_pretrained(
            SPEECHT5_ID, cache_dir="/app/models"
        )
        self.speecht5_model = SpeechT5ForTextToSpeech.from_pretrained(
            SPEECHT5_ID, cache_dir="/app/models"
        ).to(self.device)
        self.speecht5_model.eval()
        self.speecht5_vocoder = SpeechT5HifiGan.from_pretrained(
            SPEECHT5_VOCODER_ID, cache_dir="/app/models"
        ).to(self.device)
        self.speecht5_vocoder.eval()

        embeddings_dataset = load_dataset(
            "Matthijs/cmu-arctic-xvectors", split="validation", cache_dir="/app/models"
        )
        import torch as _t
        self.speaker_embeddings = _t.tensor(
            embeddings_dataset[7306]["xvector"]
        ).unsqueeze(0).to(self.device)

        logger.info("✅ TTS models loaded on %s", self.device)

    @modal.fastapi_endpoint(method="POST")
    async def synthesize(self, request: dict):
        """
        JSON fields:
          text     — text to synthesize (required)
          language — "en" or "lg" (default: "en")
          voice    — "female", "male", or "robot" (default: "female")
          pitch    — 0.0–1.0, 0.5 = no change (default: 0.5)
          rate     — speaking rate, 1.0 = natural (default: 1.0)
        """
        import numpy as np
        import soundfile as sf
        import torch

        text     = (request.get("text") or "").strip()
        language = request.get("language", "en")
        voice    = request.get("voice", "female")
        pitch    = float(request.get("pitch", 0.5))
        rate     = float(request.get("rate", 1.0))

        if not text:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="text is required")

        use_speecht5 = (voice == "female" and language == "en")

        if use_speecht5:
            inputs  = self.speecht5_processor(text=text, return_tensors="pt").to(self.device)
            spk_emb = self.speaker_embeddings
            with torch.no_grad():
                speech = self.speecht5_model.generate_speech(
                    inputs["input_ids"], spk_emb, vocoder=self.speecht5_vocoder
                )
            waveform    = speech.cpu().numpy()
            sample_rate = 16000

        elif language == "lg":
            inputs = self.mms_lg_tokenizer(text, return_tensors="pt").to(self.device)
            with torch.no_grad():
                output = self.mms_lg_model(**inputs)
            waveform    = output.waveform[0].cpu().numpy()
            sample_rate = self.mms_lg_model.config.sampling_rate

        else:
            inputs = self.mms_en_tokenizer(text, return_tensors="pt").to(self.device)
            with torch.no_grad():
                output = self.mms_en_model(**inputs)
            waveform    = output.waveform[0].cpu().numpy()
            sample_rate = self.mms_en_model.config.sampling_rate

        waveform = _apply_rate_and_pitch(waveform, sample_rate, rate, pitch, voice)

        buf = io.BytesIO()
        sf.write(buf, waveform, sample_rate, format="WAV", subtype="PCM_16")
        buf.seek(0)
        audio_b64   = base64.b64encode(buf.read()).decode("utf-8")
        duration_ms = int(len(waveform) / sample_rate * 1000)

        return {
            "audio_base64": audio_b64,
            "duration_ms":  duration_ms,
            "sample_rate":  sample_rate,
            "voice":        voice,
            "text":         text,
        }


# ── Translation Endpoint ──────────────────────────────────────────────────────

@app.cls(
    image=image,
    scaledown_window=SCALEDOWN,
    volumes={"/app/models": model_cache},
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=16)
class TranslationEndpoint:

    @modal.enter()
    def load(self):
        import torch
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.en_lg_tokenizer = AutoTokenizer.from_pretrained(
            TRANSLATE_EN_LG_ID, cache_dir="/app/models"
        )
        self.en_lg_model = AutoModelForSeq2SeqLM.from_pretrained(
            TRANSLATE_EN_LG_ID, cache_dir="/app/models"
        ).to(self.device)
        self.en_lg_model.eval()

        self.lg_en_tokenizer = AutoTokenizer.from_pretrained(
            TRANSLATE_LG_EN_ID, cache_dir="/app/models"
        )
        self.lg_en_model = AutoModelForSeq2SeqLM.from_pretrained(
            TRANSLATE_LG_EN_ID, cache_dir="/app/models"
        ).to(self.device)
        self.lg_en_model.eval()

        logger.info("✅ Translation models loaded on %s", self.device)

    @modal.fastapi_endpoint(method="POST")
    async def translate(self, request: dict):
        import torch

        text        = (request.get("text") or "").strip()
        source_lang = request.get("source_lang", "en")
        target_lang = request.get("target_lang", "lg")

        if not text:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="text is required")

        if source_lang == target_lang:
            return {"translated": text, "source_lang": source_lang,
                    "target_lang": target_lang, "model_used": "none"}

        if source_lang == "en" and target_lang == "lg":
            tokenizer, model, model_id = self.en_lg_tokenizer, self.en_lg_model, TRANSLATE_EN_LG_ID
        elif source_lang == "lg" and target_lang == "en":
            tokenizer, model, model_id = self.lg_en_tokenizer, self.lg_en_model, TRANSLATE_LG_EN_ID
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=422,
                detail=f"Unsupported language pair: {source_lang} -> {target_lang}")

        inputs = tokenizer(text, return_tensors="pt", padding=True).to(self.device)
        with torch.no_grad():
            translated_tokens = model.generate(**inputs, max_new_tokens=256)
        translated = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

        return {"translated": translated, "source_lang": source_lang,
                "target_lang": target_lang, "model_used": model_id}


# ── Shared helpers ────────────────────────────────────────────────────────────

def _apply_rate_and_pitch(waveform, sample_rate, rate, pitch, voice="female"):
    try:
        import librosa
        import numpy as np
        waveform = waveform.astype(np.float32)
        # Robot voice: shift pitch down
        if voice == "robot":
            pitch = max(0.0, pitch - 0.25)
        if abs(pitch - 0.5) > 0.05:
            n_steps  = (pitch - 0.5) * 12
            waveform = librosa.effects.pitch_shift(waveform, sr=sample_rate, n_steps=n_steps)
        if abs(rate - 1.0) > 0.05:
            waveform = librosa.effects.time_stretch(waveform, rate=rate)
    except Exception as e:
        logger.warning("Rate/pitch adjustment skipped: %s", e)
    return waveform
