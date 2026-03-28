# Whisper Pipeline Update — Support for Old & New Models

## Problem Fixed
The error occurred due to conflicting logits processors in newer transformers library versions (4.35+):
```
ForceTokensLogitsProcessor has already been created with the values... 
passed to `.generate()`, but it has already been created with the values...
```

This happened because newer Whisper models automatically create a `ForceTokensLogitsProcessor` when you pass certain parameters, and we were passing conflicting parameters.

## Solution Implemented

### 1. **Version-Aware Whisper Inference** (`app/services/asr_service.py`)
- Added version detection for the `transformers` library
- **For transformers ≥ 4.35.0**: Uses the new API with `language` and `task` parameters directly
- **For transformers < 4.35.0**: Falls back to legacy `forced_decoder_ids` approach
- Added fallback mechanism if the new API fails

```python
if transformers_version >= version.parse("4.35.0"):
    # New approach - avoids logits processor conflicts
    predicted_ids = model.generate(
        input_features,
        language="english",
        task="transcribe",
        # ... other parameters
    )
else:
    # Legacy approach with forced_decoder_ids
    predicted_ids = self._infer_whisper_legacy(...)
```

### 2. **Model Fallback Support** (`app/services/model_loader.py`)
- Enhanced English ASR loader to support fallback models
- If the primary model fails to load, automatically tries the alternative
- Useful for:
  - Testing different model versions
  - Graceful degradation if a model is unavailable
  - Switching between CDLI fine-tuned and OpenAI base models

Example configuration chain:
1. Primary: `openai/whisper-small` (242MB, balanced)
2. Fallback: `openai/whisper-base` (140MB, smaller, faster)

### 3. **Configuration Enhancement** (`app/config.py`)
Added support for alternative Whisper models:
- `hf_asr_model_en`: Primary English ASR model
- `hf_asr_model_en_alt`: Fallback English ASR model (new)

Available Whisper models (OpenAI):
```
openai/whisper-tiny       (39MB)  — smallest, fastest
openai/whisper-base       (140MB) — good balance
openai/whisper-small      (242MB) — recommended (DEFAULT)
openai/whisper-medium     (769MB) — better accuracy
openai/whisper-large      (2.9GB) — best accuracy
```

CDLI Fine-tuned Models (Ugandan English):
```
cdli/whisper-tiny_finetuned_ugandan_english_nonstandard_speech_v1.0
cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0
cdli/whisper-large-v3_finetuned_ugandan_english_nonstandard_speech_v1.0
```

### 4. **Dependencies** (`requirements.txt`)
Added `packaging==23.2` for version comparison functionality.

## How to Use

### Switch to Different Whisper Models
Edit `.env` or `app/config.py`:

```bash
# Use OpenAI's base model (faster)
HF_ASR_MODEL_EN="openai/whisper-base"
HF_ASR_MODEL_EN_ALT="openai/whisper-tiny"

# Or use CDLI fine-tuned (better for Ugandan English)
HF_ASR_MODEL_EN="cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"
HF_ASR_MODEL_EN_ALT="openai/whisper-small"
```

### Test the Pipeline
```python
# The ASR service now:
# 1. Auto-detects transformers version
# 2. Uses appropriate generation parameters
# 3. Falls back to alternative model if needed
# 4. Logs detailed information about which model was used
```

## Files Modified
1. `app/services/asr_service.py` — Added version detection and dual inference paths
2. `app/services/model_loader.py` — Added fallback mechanism with model chaining
3. `app/config.py` — Added alternative model configuration
4. `requirements.txt` — Added `packaging` dependency

## Backward Compatibility
✅ Fully backward compatible:
- Works with transformers 4.35+ (newer versions)
- Works with transformers < 4.35 (older versions)
- Existing configurations continue to work without changes
- Logs indicate which approach is being used for debugging

## Testing
The pipeline now automatically:
- Detects your transformers version at runtime
- Selects the appropriate inference method
- Logs the model version and approach used
- Provides clear error messages if something fails

Example log output:
```
INFO: Attempting to load English ASR model: openai/whisper-small
INFO: ✅ English ASR loaded (whisper): openai/whisper-small
```

## Future Enhancements
1. Add dynamic model switching via API endpoint
2. Add model benchmarking/profiling
3. Add automatic model optimization (quantization, pruning)
4. Support for more language-specific models

---

**Status**: ✅ Ready for deployment
**Tested with**: 
- transformers 4.37.2 (current)
- openai/whisper-small, openai/whisper-base
- Both CPU and CUDA devices
