import time
from collections.abc import Callable
from dataclasses import dataclass

from .client import client
from .types import TokenUsage


@dataclass
class StreamResult:
    text: str
    usage: TokenUsage | None
    ttft_ms: float | None
    total_ms: float
    truncated_reason: str | None  # why the answer was cut (e.g. "max_output_tokens"), or None
    error: str | None  # error message if the request failed, or None


def stream_response(
    on_text: Callable[[str], None] | None = None,
    on_first_text: Callable[[], None] | None = None,
    **params,
) -> StreamResult:
    """
    Sends one streaming request to the Responses API and collects everything we measure:
    full text, token usage, TTFT, total time, truncation and errors. It never raises.
    Params set to None are not sent (e.g. max_output_tokens=None).
    """
    params = {key: value for key, value in params.items() if value is not None}
    start = time.perf_counter()
    ttft_ms = None
    text = ""
    usage = None
    truncated_reason = None
    error = None

    try:
        stream = client.responses.create(stream=True, **params)
        for event in stream:
            if event.type == "response.output_text.delta":
                if ttft_ms is None:
                    ttft_ms = (time.perf_counter() - start) * 1000
                    if on_first_text:
                        on_first_text()
                text += event.delta
                if on_text:
                    on_text(event.delta)
            elif event.type in ("response.completed", "response.incomplete"):
                # "incomplete" = the answer was cut, e.g. by max_output_tokens
                if event.type == "response.incomplete":
                    details = event.response.incomplete_details
                    truncated_reason = details.reason if details else "unknown"
                if event.response.usage:
                    usage = TokenUsage.from_openai(event.response.usage)
            elif event.type == "error":
                error = event.message
    except Exception as err:
        error = str(err)

    total_ms = (time.perf_counter() - start) * 1000
    return StreamResult(text, usage, ttft_ms, total_ms, truncated_reason, error)
