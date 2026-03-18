"""
evaluate_asr.py — Word Error Rate evaluation for Voxel's ASR pipeline.

Uses the CDLI Ugandan English non-standard speech dataset to measure
how accurately the local Whisper model transcribes impaired speech.

Usage:
    python evaluate_asr.py --samples 100 --split test
    python evaluate_asr.py --samples 200 --hf_token YOUR_TOKEN_HERE

Requirements:
    pip install jiwer --break-system-packages
"""

import argparse
import logging
import numpy as np
import torch
import re
from transformers import WhisperForConditionalGeneration, WhisperProcessor
from datasets import load_dataset
from jiwer import wer, cer

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

MODEL_ID   = "cdli/whisper-small_finetuned_ugandan_english_nonstandard_speech_v1.0"
DATASET_ID = "cdli/ugandan_english_nonstandard_speech_v1.0"
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
    logger.info(f"Loading model: {MODEL_ID}")
    processor = WhisperProcessor.from_pretrained(MODEL_ID, cache_dir=CACHE_DIR)
    model = WhisperForConditionalGeneration.from_pretrained(
        MODEL_ID, cache_dir=CACHE_DIR
    ).to(device)
    model.eval()
    logger.info("Model loaded.\n")
    return model, processor


def transcribe(audio_array: np.ndarray, model, processor, device: str) -> str:
    inputs = processor(
        audio_array,
        sampling_rate  = TARGET_SR,
        return_tensors = "pt",
    )
    input_features = inputs.input_features.to(device)

    with torch.no_grad():
        forced_ids = processor.get_decoder_prompt_ids(
            language="english", task="transcribe"
        )
        predicted_ids = model.generate(
            input_features,
            forced_decoder_ids          = forced_ids,
            no_speech_threshold         = 0.6,
            logprob_threshold           = -1.0,
            compression_ratio_threshold = 2.4,
            condition_on_prev_tokens    = False,
        )

    return processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples",   type=int, default=100,
                        help="Number of samples to evaluate (default: 100)")
    parser.add_argument("--split",     type=str, default="test",
                        help="Dataset split: test / train / validation")
    parser.add_argument("--hf_token",  type=str, default=None,
                        help="HuggingFace token (required for gated dataset)")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Device: {device}\n")

    model, processor = load_model(device)

    logger.info(f"Loading dataset: {DATASET_ID} ({args.split} split)…")
    dataset = load_dataset(
        DATASET_ID,
        split     = args.split,
        cache_dir = CACHE_DIR,
        token     = args.hf_token,
        streaming = True,   # streams so we don't download all 4.43GB upfront
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

        # The dataset column holding the correct transcript
        ref = (
            sample.get("transcription")
            or sample.get("transcript")
            or sample.get("text")
            or sample.get("sentence")
            or ""
        )
        if not ref:
            skipped += 1
            continue

        audio_info  = sample.get("audio")
        if audio_info is None:
            skipped += 1
            continue

        audio_array = np.array(audio_info["array"], dtype=np.float32)

        # Resample if the dataset sample rate differs from 16kHz
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

        # Per-sample WER
        sample_wer = wer([ref_norm], [hyp_norm]) * 100
        flag = "✓" if sample_wer == 0 else f"{sample_wer:.0f}%"
        logger.info(f"{count+1:<5} {ref[:43]:<45} {hyp[:43]:<45} {flag}")
        count += 1

    # ── Aggregate results ─────────────────────────────────────────────────────

    if not references:
        logger.error(
            "\nNo samples evaluated. Possible causes:\n"
            "  - Dataset requires a HuggingFace token: pass --hf_token YOUR_TOKEN\n"
            "  - Transcript column name is different — check the dataset card\n"
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
    print("  VOXEL ASR EVALUATION RESULTS")
    print("=" * 60)
    print(f"  Model    : {MODEL_ID.split('/')[-1]}")
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

    if errors:
        print(f"\n  {len(errors)} inference error(s):")
        for e in errors[:3]:
            print(f"    - {e}")


if __name__ == "__main__":
    main()