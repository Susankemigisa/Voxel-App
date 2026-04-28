"""
Voxel Voice Endpoints — Modal deployment for ASR, TTS, and Translation.

Deploy:
  modal deploy voxel_voice_endpoints.py
"""

import base64
import io
import logging

import modal
from fastapi import Request

APP_NAME  = "voxel-voice-endpoints"
GPU       = "T4"
SCALEDOWN = 60 * 15

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
        "python-multipart",
        "torch",
        "torchaudio",
        "transformers",
        "accelerate",
        "soundfile",
        "numpy",
        "librosa",
        "datasets",
        "httpx",
        "sentencepiece",
        "sacremoses",
        "pyarrow",
    )
)

model_cache = modal.Volume.from_name("voxel-model-cache", create_if_missing=True)
hf_secret = modal.Secret.from_name("huggingface-secret")

app = modal.App(APP_NAME)

WHISPER_EN_ID       = "openai/whisper-small"
WHISPER_UG_EN_ID    = "cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"
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
    min_containers=1,
    secrets=[hf_secret],
    volumes={"/app/models": model_cache},
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=8)
class ASREndpoint:

    @modal.enter()
    def load(self):
        import torch
        from transformers import WhisperForConditionalGeneration, WhisperProcessor, Wav2Vec2ForCTC, AutoProcessor

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_ug = None
        self.processor_ug = None
        self.model_lg = None
        self.processor_lg = None

        try:
            self.processor_ug = WhisperProcessor.from_pretrained(WHISPER_UG_EN_ID, cache_dir="/app/models")
            self.model_ug = WhisperForConditionalGeneration.from_pretrained(WHISPER_UG_EN_ID, cache_dir="/app/models").to(self.device)
            self.model_ug.eval()
            logger.info("✅ Ugandan Whisper loaded")
        except Exception as e:
            logger.warning("Ugandan Whisper failed, will use standard: %s", e)

        self.processor_en = WhisperProcessor.from_pretrained(WHISPER_EN_ID, cache_dir="/app/models")
        self.model_en = WhisperForConditionalGeneration.from_pretrained(WHISPER_EN_ID, cache_dir="/app/models").to(self.device)
        self.model_en.eval()
        logger.info("✅ Standard Whisper loaded on %s", self.device)

        try:
            self.processor_lg = AutoProcessor.from_pretrained(MMS_ASR_LG_ID, cache_dir="/app/models")
            self.processor_lg.tokenizer.set_target_lang("lug")
            self.model_lg = Wav2Vec2ForCTC.from_pretrained(MMS_ASR_LG_ID, cache_dir="/app/models", target_lang="lug", ignore_mismatched_sizes=True).to(self.device)
            self.model_lg.eval()
            logger.info("✅ MMS Luganda ASR loaded")
        except Exception as e:
            logger.warning("MMS Luganda ASR failed: %s", e)

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, request: Request):
        import numpy as np
        import soundfile as sf
        import torch

        form     = await request.form()
        language = str(form.get("language", "en")).strip().lower()
        wav_field = form.get("wav")
        if wav_field is None:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="'wav' field is required")

        wav_bytes = await wav_field.read() if hasattr(wav_field, "read") else bytes(wav_field)
        audio, sr = sf.read(io.BytesIO(wav_bytes), dtype="float32")
        if sr != SAMPLE_RATE:
            import librosa
            audio = librosa.resample(audio, orig_sr=sr, target_sr=SAMPLE_RATE)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        if language == "lg" and self.model_lg is not None:
            inputs = self.processor_lg(audio, sampling_rate=SAMPLE_RATE, return_tensors="pt", padding=True)
            with torch.no_grad():
                logits = self.model_lg(inputs.input_values.to(self.device)).logits
            transcript = self.processor_lg.batch_decode(torch.argmax(logits, dim=-1))[0].strip()
            confidence = float(torch.softmax(logits, dim=-1).max(dim=-1).values.mean().item())
        else:
            model     = self.model_ug     if self.model_ug     else self.model_en
            processor = self.processor_ug if self.processor_ug else self.processor_en
            inputs    = processor(audio, sampling_rate=SAMPLE_RATE, return_tensors="pt")
            with torch.no_grad():
                predicted_ids = model.generate(inputs.input_features.to(self.device), language="english", task="transcribe")
            transcript = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
            confidence = 0.95

        if not transcript:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail="No speech detected")

        return {"transcription": transcript, "text": transcript, "language": language, "confidence": round(min(max(confidence, 0.0), 1.0), 3)}


# ── TTS Endpoint ──────────────────────────────────────────────────────────────

@app.cls(
    image=image,
    gpu=GPU,
    scaledown_window=SCALEDOWN,
    min_containers=1,
    secrets=[hf_secret],
    volumes={"/app/models": model_cache},
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=8)
class TTSEndpoint:

    @modal.enter()
    def load(self):
        import torch
        from transformers import VitsModel, VitsTokenizer, SpeechT5ForTextToSpeech, SpeechT5Processor, SpeechT5HifiGan

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.speecht5_model     = None
        self.speecht5_processor = None
        self.speecht5_vocoder   = None
        self.speaker_embeddings = None

        # MMS English (male/robot) — always load first, smallest
        self.mms_en_tokenizer = VitsTokenizer.from_pretrained(MMS_TTS_EN_ID, cache_dir="/app/models")
        self.mms_en_model     = VitsModel.from_pretrained(MMS_TTS_EN_ID, cache_dir="/app/models").to(self.device)
        self.mms_en_model.eval()
        logger.info("✅ MMS EN TTS loaded")

        # MMS Luganda
        try:
            self.mms_lg_tokenizer = VitsTokenizer.from_pretrained(MMS_TTS_LG_ID, cache_dir="/app/models")
            self.mms_lg_model     = VitsModel.from_pretrained(MMS_TTS_LG_ID, cache_dir="/app/models").to(self.device)
            self.mms_lg_model.eval()
            logger.info("✅ MMS LG TTS loaded")
        except Exception as e:
            logger.warning("MMS LG TTS failed: %s", e)
            self.mms_lg_tokenizer = self.mms_en_tokenizer
            self.mms_lg_model     = self.mms_en_model

        # SpeechT5 female English — load last, largest
        try:
            self.speecht5_processor = SpeechT5Processor.from_pretrained(SPEECHT5_ID, cache_dir="/app/models")
            self.speecht5_model     = SpeechT5ForTextToSpeech.from_pretrained(SPEECHT5_ID, cache_dir="/app/models").to(self.device)
            self.speecht5_model.eval()
            self.speecht5_vocoder   = SpeechT5HifiGan.from_pretrained(SPEECHT5_VOCODER_ID, cache_dir="/app/models").to(self.device)
            self.speecht5_vocoder.eval()

            # Load speaker embeddings from dataset
            try:
                # Download speaker embeddings directly from HF
                from huggingface_hub import hf_hub_download
                import numpy as np
                xvector_path = hf_hub_download(
                    repo_id="Matthijs/cmu-arctic-xvectors",
                    filename="cmu-arctic-xvectors.arrow",
                    repo_type="dataset",
                    cache_dir="/app/models",
                )
                import pyarrow as pa
                table = pa.ipc.open_file(xvector_path).read_all()
                xvector = table["xvector"][7306].as_py()
                self.speaker_embeddings = torch.tensor(xvector).unsqueeze(0).to(self.device)
                logger.info("✅ SpeechT5 + speaker embeddings loaded")
            except Exception as e:
                logger.warning("Speaker embeddings failed, using fixed fallback: %s", e)
                torch.manual_seed(7306)
                self.speaker_embeddings = torch.randn(1, 512).to(self.device)
                self.speaker_embeddings = self.speaker_embeddings / self.speaker_embeddings.norm()
                logger.info("✅ SpeechT5 loaded with fallback embeddings")

        except Exception as e:
            logger.warning("SpeechT5 failed to load, female voice will use MMS: %s", e)

        logger.info("✅ TTS endpoint ready on %s", self.device)

    @modal.fastapi_endpoint(method="POST")
    async def synthesize(self, request: dict):
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

        # Use SpeechT5 for female English if available
        use_speecht5 = (
            voice == "female"
            and language == "en"
            and self.speecht5_model is not None
            and self.speaker_embeddings is not None
        )

        if use_speecht5:
            inputs = self.speecht5_processor(text=text, return_tensors="pt").to(self.device)
            with torch.no_grad():
                speech = self.speecht5_model.generate_speech(inputs["input_ids"], self.speaker_embeddings, vocoder=self.speecht5_vocoder)
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

        return {
            "audio_base64": base64.b64encode(buf.read()).decode("utf-8"),
            "duration_ms":  int(len(waveform) / sample_rate * 1000),
            "sample_rate":  sample_rate,
            "voice":        voice,
            "text":         text,
        }


# ── Translation Endpoint ──────────────────────────────────────────────────────

@app.cls(
    image=image,
    scaledown_window=SCALEDOWN,
    min_containers=1,
    secrets=[hf_secret],
    volumes={"/app/models": model_cache},
    enable_memory_snapshot=True,
)
@modal.concurrent(max_inputs=16)
class TranslationEndpoint:

    @modal.enter()
    def load(self):
        import torch
        from transformers import AutoModelForSeq2SeqLM, MarianTokenizer

        self.device = "cuda" if torch.cuda.is_available() else "cpu"

        self.en_lg_tokenizer = MarianTokenizer.from_pretrained(TRANSLATE_EN_LG_ID, cache_dir="/app/models")
        self.en_lg_model     = AutoModelForSeq2SeqLM.from_pretrained(TRANSLATE_EN_LG_ID, cache_dir="/app/models").to(self.device)
        self.en_lg_model.eval()

        self.lg_en_tokenizer = MarianTokenizer.from_pretrained(TRANSLATE_LG_EN_ID, cache_dir="/app/models")
        self.lg_en_model     = AutoModelForSeq2SeqLM.from_pretrained(TRANSLATE_LG_EN_ID, cache_dir="/app/models").to(self.device)
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
            return {"translated": text, "source_lang": source_lang, "target_lang": target_lang, "model_used": "none"}

        if source_lang == "en" and target_lang == "lg":
            tokenizer, model, model_id = self.en_lg_tokenizer, self.en_lg_model, TRANSLATE_EN_LG_ID
        elif source_lang == "lg" and target_lang == "en":
            tokenizer, model, model_id = self.lg_en_tokenizer, self.lg_en_model, TRANSLATE_LG_EN_ID
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=422, detail=f"Unsupported: {source_lang} -> {target_lang}")

        inputs = tokenizer(text, return_tensors="pt", padding=True).to(self.device)
        with torch.no_grad():
            translated_tokens = model.generate(**inputs, max_new_tokens=256)
        translated = tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

        return {"translated": translated, "source_lang": source_lang, "target_lang": target_lang, "model_used": model_id}


# ── Shared helpers ────────────────────────────────────────────────────────────

def _apply_rate_and_pitch(waveform, sample_rate, rate, pitch, voice="female"):
    try:
        import librosa
        import numpy as np
        waveform = waveform.astype(np.float32)
        if voice == "robot":
            pitch = max(0.0, pitch - 0.25)
        if abs(pitch - 0.5) > 0.05:
            waveform = librosa.effects.pitch_shift(waveform, sr=sample_rate, n_steps=(pitch - 0.5) * 12)
        if abs(rate - 1.0) > 0.05:
            waveform = librosa.effects.time_stretch(waveform, rate=rate)
    except Exception as e:
        logger.warning("Rate/pitch adjustment skipped: %s", e)
    return waveform