"""
evaluate_asr_luganda.py — Word Error Rate evaluation for Voxel's Luganda ASR.

Uses the CDLI Ugandan Luganda non-standard speech dataset to measure
how accurately facebook/mms-1b-all (lug adapter) transcribes Luganda speech.

Usage:
    python evaluate_asr_luganda.py --samples 100 --hf_token YOUR_TOKEN

Requirements:
    pip install jiwer --break-system-packages
"""

import argparse
import logging
import numpy as np
import torch
import re
from transformers import Wav2Vec2ForCTC, AutoProcessor
from datasets import load_dataset
from jiwer import wer, cer

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

MODEL_ID   = "facebook/mms-1b-all"
DATASET_ID = "cdli/ugandan_luganda_nonstandard_speech_v1.0"
CACHE_DIR  = "D:/app/models"
TARGET_SR  = 16_000

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalise(text: str) -> str:
    """Lowercase, strip punctuation and extra spaces for fair WER comparison."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_model(device: str):
    logger.info(f"Loading model: {MODEL_ID} (lug adapter)")
    processor = AutoProcessor.from_pretrained(MODEL_ID, cache_dir=CACHE_DIR)
    model = Wav2Vec2ForCTC.from_pretrained(
        MODEL_ID,
        cache_dir              = CACHE_DIR,
        ignore_mismatched_sizes = True,
    ).to(device)

    # Activate Luganda language adapter
    processor.tokenizer.set_target_lang("lug")
    model.load_adapter("lug")
    model.eval()

    logger.info("Model loaded with Luganda (lug) adapter.\n")
    return model, processor


def transcribe(audio_array: np.ndarray, model, processor, device: str) -> str:
    inputs = processor(
        audio_array,
        sampling_rate  = TARGET_SR,
        return_tensors = "pt",
        padding        = True,
    )
    input_values = inputs.input_values.to(device)

    with torch.no_grad():
        logits = model(input_values).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    return processor.batch_decode(predicted_ids)[0].strip()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples",  type=int, default=100,
                        help="Number of samples to evaluate (default: 100)")
    parser.add_argument("--split",    type=str, default="test",
                        help="Dataset split: test / train / validation")
    parser.add_argument("--hf_token", type=str, default=None,
                        help="HuggingFace token (required for gated dataset)")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Device: {device}\n")

    # Check model is downloaded before starting
    import os
    model_cache = os.path.join(CACHE_DIR, "models--facebook--mms-1b-all")
    if not os.path.exists(model_cache):
        logger.error(
            "❌ facebook/mms-1b-all not found in cache.\n"
            "   Run the download script first:\n"
            "   python -c \"from huggingface_hub import hf_hub_download; "
            "[hf_hub_download('facebook/mms-1b-all', f, cache_dir='D:/app/models', resume_download=True) "
            "for f in ['config.json','model.safetensors','adapter.lug.bin','adapter.lug.safetensors',"
            "'preprocessor_config.json','tokenizer_config.json','vocab.json','special_tokens_map.json']]\""
        )
        return

    model, processor = load_model(device)

    logger.info(f"Loading dataset: {DATASET_ID} ({args.split} split)…")
    dataset = load_dataset(
        DATASET_ID,
        split     = args.split,
        cache_dir = CACHE_DIR,
        token     = args.hf_token,
        streaming = True,
    )

    references = []
    hypotheses = []
    errors     = []
    skipped    = 0
    count      = 0

    logger.info(f"Evaluating {args.samples} samples…\n")
    logger.info(f"{'#':<5} {'Reference':<45} {'Hypothesis':<45} WER")
    logger.info("-" * 105)

    for sample in dataset:
        if count >= args.samples:
            break

        ref = sample.get("transcription", "")
        if not ref:
            skipped += 1
            continue

        audio_info = sample.get("audio")
        if audio_info is None:
            skipped += 1
            continue

        audio_array = np.array(audio_info["array"], dtype=np.float32)

        if audio_info["sampling_rate"] != TARGET_SR:
            import librosa
            audio_array = librosa.resample(
                audio_array,
                orig_sr   = audio_info["sampling_rate"],
                target_sr = TARGET_SR,
            )

        try:
            hyp = transcribe(audio_array, model, processor, device)
        except Exception as e:
            errors.append(str(e))
            skipped += 1
            continue

        ref_norm = normalise(ref)
        hyp_norm = normalise(hyp)

        references.append(ref_norm)
        hypotheses.append(hyp_norm)

        sample_wer = wer([ref_norm], [hyp_norm]) * 100
        flag = "✓" if sample_wer == 0 else f"{sample_wer:.0f}%"
        logger.info(f"{count+1:<5} {ref[:43]:<45} {hyp[:43]:<45} {flag}")
        count += 1

    # ── Results ───────────────────────────────────────────────────────────────

    if not references:
        logger.error(
            "\nNo samples evaluated. Possible causes:\n"
            "  - Dataset requires a HuggingFace token: pass --hf_token YOUR_TOKEN\n"
            "  - Model not fully downloaded yet\n"
        )
        return

    total_wer  = wer(references, hypotheses) * 100
    total_cer  = cer(references, hypotheses) * 100
    exact_rate = sum(r == h for r, h in zip(references, hypotheses)) / len(references) * 100

    grade = (
        "🟢 Excellent" if total_wer < 20 else
        "🟢 Good"      if total_wer < 35 else
        "🟡 Fair"      if total_wer < 50 else
        "🔴 Poor"
    )

    print("\n" + "=" * 60)
    print("  VOXEL LUGANDA ASR EVALUATION RESULTS")
    print("=" * 60)
    print(f"  Model    : {MODEL_ID} (lug adapter)")
    print(f"  Dataset  : {DATASET_ID.split('/')[-1]}")
    print(f"  Split    : {args.split}")
    print(f"  Samples  : {count}  (skipped: {skipped})")
    print("-" * 60)
    print(f"  Word Error Rate  (WER) : {total_wer:.1f}%  {grade}")
    print(f"  Char Error Rate  (CER) : {total_cer:.1f}%")
    print(f"  Exact Match Rate       : {exact_rate:.1f}%")
    print("=" * 60)
    print()
    print("  WER reference guide:")
    print("  < 20%   Excellent  — near human-level accuracy")
    print("  20-35%  Good       — usable, most words correct")
    print("  35-50%  Fair       — core message usually clear")
    print("  > 50%   Poor       — significant errors")
    print("=" * 60)
    print()
    print("  Note: Luganda is a low-resource language. WER of 40-60%")
    print("  is considered acceptable for low-resource ASR systems.")
    print("  The text reconstructor in Voxel's pipeline reduces the")
    print("  effective WER users experience by cleaning repetitions.")
    print("=" * 60)

    if errors:
        print(f"\n  {len(errors)} inference error(s):")
        for e in errors[:3]:
            print(f"    - {e}")


if __name__ == "__main__":
    main()