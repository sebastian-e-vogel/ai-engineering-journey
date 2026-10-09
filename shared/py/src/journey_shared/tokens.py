from functools import cache

import tiktoken

from .types import Message


@cache
def _encoder() -> tiktoken.Encoding:
    # Loaded lazily, on first use: the first time it downloads the tokenizer file (then cached),
    # so scripts that never count tokens don't pay for it.
    # o200k_base is the tokenizer of recent OpenAI models; for newer models it is an approximation.
    return tiktoken.get_encoding("o200k_base")


def count_tokens(text: str) -> int:
    return len(_encoder().encode(text))


def estimate_tokens(messages: list[Message], system_prompt: str = "") -> int:
    """Rough local estimate: system prompt + each message + ~4 formatting tokens per message."""
    return count_tokens(system_prompt) + sum(count_tokens(m["content"]) + 4 for m in messages)
