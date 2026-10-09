import os

from . import env  # noqa: F401  (loads .env before reading os.environ)

# USD per 1M tokens (standard tier). Source: https://developers.openai.com/api/docs/pricing
PRICES: dict[str, dict[str, float]] = {
    "gpt-6-luna": {"input": 0.10, "output": 0.50},
    "gpt-6.1-sol": {"input": 2.00, "output": 10.00},
}

# MODEL=gpt-6.1-sol uv run <script>  → pick the model (can also live in .env)
MODEL = os.environ.get("MODEL", "gpt-6-luna")


def get_env_int(name: str) -> int | None:
    """Reads a numeric env var: MAX_HISTORY=4 → 4, unset → None."""
    raw = os.environ.get(name)
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        raise ValueError(f'{name} must be a number, got "{raw}"') from None
