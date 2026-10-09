from .config import PRICES
from .types import TokenUsage


def cost_of(model: str, usage: TokenUsage) -> float | None:
    """Cost in USD of one request, or None when the model has no price in PRICES."""
    price = PRICES.get(model)
    if price is None:
        return None
    return (usage.input_tokens * price["input"] + usage.output_tokens * price["output"]) / 1_000_000


def usd(value: float | None) -> str | None:
    """Readable USD amount for logs: 6.72e-05 → "0.0000672" (no scientific notation)."""
    if value is None:
        return None
    return f"{value:.8f}".rstrip("0").rstrip(".") or "0"
