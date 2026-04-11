"""Shared enums and Pydantic schemas for Voxel API."""

from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class Language(str, Enum):
    EN = "en"
    LG = "lg"


class VoiceGender(str, Enum):
    FEMALE = "female"
    MALE = "male"
    ROBOT = "robot"


class OutputMode(str, Enum):
    AUDIO = "audio"
    VISUAL = "visual"
    BOTH = "both"


class ModelName(str, Enum):
    WHISPER = "whisper"
    WAV2VEC2 = "wav2vec2"
    MMS = "mms"


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    language: Language = Language.EN
    voice: VoiceGender = VoiceGender.FEMALE
    pitch: float = Field(default=0.5, ge=0.0, le=1.0)
    rate: float = Field(default=0.6, gt=0.0, le=2.0)


class TTSResponse(BaseModel):
    audio_base64: str
    duration_ms: int
    sample_rate: int
    voice: str
    text: str


class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)
    source_lang: Language
    target_lang: Language


class TranslationResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    source_text: str
    translated: str
    source_lang: Language
    target_lang: Language
    model_used: str


class PipelineRequest(BaseModel):
    language: Language = Language.EN
    output_mode: OutputMode = OutputMode.BOTH
    translate_to: Optional[Language] = None


class NavigationIntent(BaseModel):
    is_navigation: bool
    destination: str = ""
    query: str = ""
    confidence: float = 0.0
    corrected_text: str = ""
    reason: str = ""


class PipelineResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    raw_transcript: str
    clean_text: str
    language: str
    confidence: float
    model_used: ModelName
    audio_base64: Optional[str] = None
    audio_url: Optional[str] = None
    duration_ms: Optional[int] = None
    pipeline_ms: int
    navigation_intent: Optional[NavigationIntent] = None


class ASRResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    transcript: str
    clean_text: str
    language: str
    confidence: float
    model_used: ModelName
    processing_ms: int


class ModelStatus(BaseModel):
    name: str
    loaded: bool
    device: str


class HealthResponse(BaseModel):
    status: str
    version: str
    models: list[ModelStatus]
