from .types import TokenUsage


def format_metrics(
    *,
    model: str,
    usage: TokenUsage,
    ttft_ms: float | None,
    total_ms: float,
    cost: float | None,
    turn: int | None = None,
    estimated_input: int | None = None,
    session_cost: float | None = None,
) -> str:
    """One line with everything we measure for a request."""
    label = f"[turn {turn}]" if turn is not None else "[metrics]"
    estimate = f" (est. {estimated_input})" if estimated_input is not None else ""
    reasoning = f" (reasoning {usage.reasoning_tokens})" if usage.reasoning_tokens else ""
    parts = [
        model,
        f"in: {usage.input_tokens}{estimate}",
        f"out: {usage.output_tokens}{reasoning}",
        f"TTFT {ttft_ms:.0f} ms" if ttft_ms is not None else "TTFT - ms",
        f"total {total_ms:.0f} ms",
        f"USD {cost:.6f}" if cost is not None else f'cost unknown (add "{model}" to PRICES)',
    ]
    if session_cost is not None:
        parts.append(f"session USD {session_cost:.6f}")
    return f"{label} {' · '.join(parts)}"
