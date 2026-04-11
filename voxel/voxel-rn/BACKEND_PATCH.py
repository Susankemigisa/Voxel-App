"""
ADD THESE TWO ENDPOINTS to voxel-backend/app/routers/pipeline.py

Paste them at the bottom of the existing pipeline.py file,
just before the end of the file.
"""

# ── ADD TO IMPORTS at top of pipeline.py ─────────────────────────────────────
# from pydantic import BaseModel
# (BaseModel should already be imported from app.models.schemas)


# ── PASTE THESE TWO ENDPOINTS at bottom of pipeline.py ───────────────────────

from pydantic import BaseModel as _BaseModel

class CorrectionRequest(_BaseModel):
    text:     str
    language: str = "en"

class CorrectionResponse(_BaseModel):
    original:  str
    clean_text: str

@router.post("/correct", response_model=CorrectionResponse)
async def correct_text(req: CorrectionRequest):
    """
    AI text correction endpoint for Smart Correction feature.
    Takes already-transcribed text and refines it further.
    """
    import anthropic, os, time

    original = req.text.strip()
    if not original:
        return CorrectionResponse(original=original, clean_text=original)

    lang_label = "Luganda" if req.language == "lg" else "English"

    try:
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))
        prompt = (
            f"You are correcting a speech-to-text transcription from a Ugandan speaker.\n"
            f"Language: {lang_label}\n"
            f"Input: \"{original}\"\n\n"
            f"Fix only genuine errors: grammar from Luganda interference, stutters, "
            f"filler words (um, uh, eh), repeated words, mis-transcribed Ugandan place names.\n"
            f"Do NOT rephrase or change meaning. Return ONLY the corrected text, nothing else."
        )
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}]
        )
        corrected = message.content[0].text.strip().strip('"')
    except Exception as e:
        logger.warning("AI correction failed: %s", e)
        corrected = original

    return CorrectionResponse(original=original, clean_text=corrected)
