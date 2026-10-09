import os
import sys
import time

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv("../../.env")

# USD per 1M tokens (standard tier). Source: https://developers.openai.com/api/docs/pricing
PRICES = {
    "gpt-6-luna": {"input": 0.10, "output": 0.50},
    "gpt-6.1-sol": {"input": 2.00, "output": 10.00},
}

# Choose model and output limit from the environment:
#   MODEL=gpt-6.1-sol uv run hello.py "..."
#   MAX_OUTPUT_TOKENS=50 uv run hello.py "..."
MODEL = os.environ.get("MODEL", "gpt-6-luna")
MAX_OUTPUT_TOKENS = os.environ.get("MAX_OUTPUT_TOKENS")

client = OpenAI()
prompt = sys.argv[1] if len(sys.argv) > 1 else "Explain in three sentences what an LLM is."

# only send max_output_tokens when it is set
extra = {"max_output_tokens": int(MAX_OUTPUT_TOKENS)} if MAX_OUTPUT_TOKENS else {}

start = time.perf_counter()
ttft = None

stream = client.responses.create(model=MODEL, input=prompt, stream=True, **extra)

for event in stream:
    if event.type == "response.output_text.delta":
        # first text chunk: measure time-to-first-token (TTFT)
        if ttft is None:
            ttft = (time.perf_counter() - start) * 1000
        print(event.delta, end="", flush=True)
    elif event.type in ("response.completed", "response.incomplete"):
        # "incomplete" means the answer was cut, e.g. by max_output_tokens
        if event.type == "response.incomplete":
            details = event.response.incomplete_details
            reason = details.reason if details else "unknown reason"
            print(f"\n[truncated: {reason}]")

        usage = event.response.usage
        if usage is None:
            continue
        total = (time.perf_counter() - start) * 1000
        price = PRICES.get(MODEL)

        print("\n\n--- metrics ---")
        print(f"model: {MODEL}")
        print(f"tokens: {usage.input_tokens} in / {usage.output_tokens} out")
        ttft_text = f"{ttft:.0f}" if ttft is not None else "-"
        print(f"TTFT: {ttft_text} ms | total: {total:.0f} ms")
        if price:
            cost = (usage.input_tokens * price["input"] + usage.output_tokens * price["output"]) / 1_000_000
            print(f"cost: USD {cost:.6f}")
        else:
            print(f'cost: unknown (add "{MODEL}" to PRICES)')
    elif event.type == "error":
        print(event.message)
