from dataclasses import dataclass
from typing import Literal, TypedDict


class Message(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass
class TokenUsage:
    """Token usage of one request, normalized from the API response."""

    input_tokens: int
    output_tokens: int
    reasoning_tokens: int = 0  # hidden "thinking" tokens: billed as output, never shown

    @classmethod
    def from_openai(cls, usage) -> "TokenUsage":
        details = getattr(usage, "output_tokens_details", None)
        return cls(
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            reasoning_tokens=getattr(details, "reasoning_tokens", 0) or 0,
        )
