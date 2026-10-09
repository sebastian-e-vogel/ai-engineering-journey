import sys

from journey_shared import MODEL, cost_of, format_metrics, get_env_int, stream_response

# MAX_OUTPUT_TOKENS=50 uv run hello.py "..."  → cap the answer length
MAX_OUTPUT_TOKENS = get_env_int("MAX_OUTPUT_TOKENS")
prompt = sys.argv[1] if len(sys.argv) > 1 else "Explain in three sentences what an LLM is."

result = stream_response(
    model=MODEL,
    input=prompt,
    max_output_tokens=MAX_OUTPUT_TOKENS,  # None = not sent
    on_text=lambda delta: print(delta, end="", flush=True),
)

if result.truncated_reason:
    print(f"\n[truncated: {result.truncated_reason}]")
if result.error:
    print(f"\n[error] {result.error}")
if result.usage:
    print(
        "\n\n"
        + format_metrics(
            model=MODEL,
            usage=result.usage,
            ttft_ms=result.ttft_ms,
            total_ms=result.total_ms,
            cost=cost_of(MODEL, result.usage),
        )
    )
if result.error:
    sys.exit(1)
