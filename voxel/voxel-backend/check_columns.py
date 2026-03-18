"""
Quick script to inspect the dataset columns and show a sample row.
Run this first to find the correct transcript column name.
"""
from datasets import load_dataset

dataset = load_dataset(
    "cdli/ugandan_english_nonstandard_speech_v1.0",
    split     = "test",
    streaming = True,
    token     = __import__('sys').argv[1] if len(__import__('sys').argv) > 1 else None,
    cache_dir = "D:/app/models",
)

for sample in dataset:
    print("Column names:", list(sample.keys()))
    print("\nSample values (non-audio):")
    for k, v in sample.items():
        if k != "audio":
            print(f"  {k}: {repr(v)}")
    break