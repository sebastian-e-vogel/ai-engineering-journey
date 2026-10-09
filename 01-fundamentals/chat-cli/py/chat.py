from datetime import datetime, timezone
from pathlib import Path

from journey_shared import (
    MODEL,
    Message,
    SessionLog,
    cost_of,
    estimate_tokens,
    format_metrics,
    get_env_int,
    stream_response,
    usd,
)

# MAX_HISTORY=4 uv run chat.py  → sliding window: send only the last 4 messages
MAX_HISTORY = get_env_int("MAX_HISTORY")
SYSTEM_PROMPT = "You are a concise assistant for a React Native developer."
COMMANDS = "/history, /reset (or /clear), /exit"


def main() -> None:
    # One JSON file per run in ./sessions (see SessionLog)
    window_label = f"window-{MAX_HISTORY}" if MAX_HISTORY else "full"
    session_log = SessionLog(Path(__file__).resolve().parent / "sessions", f"{MODEL}_{window_label}")

    # Two different things:
    #  - history:    what the model "remembers" right now. /reset empties it.
    #  - transcript: everything that happened in this run, for the log. Never emptied.
    history: list[Message] = []
    transcript: list[dict] = []
    turn = 0
    session_cost = 0.0

    def record(event: str, **fields) -> None:
        transcript.append({"at": datetime.now(timezone.utc).isoformat(), "event": event, **fields})

    def save_log(to_send: list[Message] | None) -> None:
        session_log.save({
            "model": MODEL,
            "max_history": MAX_HISTORY,
            "started_at": session_log.started_at,
            "instructions": SYSTEM_PROMPT,
            "turn": turn,
            "session_cost_usd": usd(session_cost),  # string, e.g. "0.0000672"
            "history": history,  # the model's current memory (empties on /reset)
            "last_sent": to_send,  # exactly what the last request sent (None after /reset)
            "transcript": transcript,  # everything that happened in this run
        })

    window = f" (window: last {MAX_HISTORY} messages)" if MAX_HISTORY else ""
    print(f"Chat with {MODEL}{window}.")
    print(f"Commands: {COMMANDS}")

    while True:
        try:
            text = input("\n[user input] > ").strip()
        except (EOFError, KeyboardInterrupt):
            break  # Ctrl+D / Ctrl+C: exit cleanly
        if not text:
            continue

        # --- commands: handled locally, never sent to the model ---
        if text == "/exit":
            break
        if text in ("/reset", "/clear"):
            history = []
            turn = 0
            record("reset")
            save_log(None)
            print("History cleared.")
            continue
        if text == "/history":
            print(f"{len(history)} messages · ~{estimate_tokens(history, SYSTEM_PROMPT)} tokens (local estimate)")
            continue
        if text.startswith("/"):
            # a typo like "/clera" must not reach the model as a normal message
            print(f'Unknown command "{text}". Commands: {COMMANDS}')
            continue

        # --- a new turn ---
        history.append({"role": "user", "content": text})
        turn += 1
        record("user", turn=turn, content=text)

        # The API is stateless: we send the conversation again on every turn.
        # Always a COPY, so appending the assistant reply later doesn't change what we logged as "sent".
        to_send = history[-MAX_HISTORY:] if MAX_HISTORY else list(history)
        estimated = estimate_tokens(to_send, SYSTEM_PROMPT)
        save_log(to_send)  # before the request: what we are about to send

        result = stream_response(
            model=MODEL,
            instructions=SYSTEM_PROMPT,
            input=to_send,
            on_first_text=lambda: print("\n[assistant output]: ", end=""),
            on_text=lambda delta: print(delta, end="", flush=True),
        )

        if result.truncated_reason:
            print(f"\n[truncated: {result.truncated_reason}]")

        cost = cost_of(MODEL, result.usage) if result.usage else None
        if cost is not None:
            session_cost += cost
        if result.usage:
            print(
                "\n\n"
                + format_metrics(
                    turn=turn,
                    model=MODEL,
                    usage=result.usage,
                    estimated_input=estimated,
                    ttft_ms=result.ttft_ms,
                    total_ms=result.total_ms,
                    cost=cost,
                    session_cost=session_cost,
                )
            )
        usage = vars(result.usage) if result.usage else None

        if result.error or not result.text:
            # don't keep a question without an answer in the history (the transcript keeps it)
            reason = result.error or "no answer received"
            print(f"\n[error] {reason} · message removed from history")
            record("error", turn=turn, content=reason, usage=usage, cost_usd=usd(cost))
            history.pop()
            turn -= 1
            save_log(to_send)
            continue

        history.append({"role": "assistant", "content": result.text})
        record("assistant", turn=turn, content=result.text, usage=usage, cost_usd=usd(cost))
        save_log(to_send)  # after the answer: history and transcript include the reply


if __name__ == "__main__":
    main()
