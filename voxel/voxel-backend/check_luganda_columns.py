"""Quick column inspector for the CDLI Luganda dataset."""
from datasets import load_dataset
import sys

token = sys.argv[1] if len(sys.argv) > 1 else None

dataset = load_dataset(
    "cdli/ugandan_luganda_nonstandard_speech_v1.0",
    split     = "test",
    streaming = True,
    token     = token,
    cache_dir = "D:/app/models",
)

for sample in dataset:
    print("Column names:", list(sample.keys()))
    print("\nSample values (non-audio):")
    for k, v in sample.items():
        if k != "audio":
            print(f"  {k}: {repr(v)}")
    break