import json
import sys
from typing import Literal

from journey_shared import MODEL, ROOT_DIR, TokenUsage, client, cost_of, get_env_int, usd
from pydantic import BaseModel

POSTS_DIR = ROOT_DIR / "data" / "job-posts"
OUT_FILE = ROOT_DIR / "data" / "extractions" / "openai-py.json"
MAX_ATTEMPTS = 2  # first try + one retry


class JobExtraction(BaseModel):
    seniority: Literal["junior", "mid", "senior", "staff", "unknown"]
    remote: bool | None  
    stack: list[str]
    required_skills: list[str]


INSTRUCTIONS = """Extract structured data from the job post.
- seniority: "check the title for seniority first", "junior" (0-2 yrs), "mid" (3-5), "senior" (5+), "staff" (staff/principal), "unknown".
- remote: true only if remote work is stated, false if on-site/hybrid is stated, null if not mentioned.
- stack: concrete technologies mentioned anywhere (languages, frameworks, platforms, tools).
- required_skills: only from the required qualifications section, not the preferred ones.
Do not infer: if something is not in the text, use null or "unknown"."""


class ExtractionError(Exception):
    """A failed attempt that still used tokens, so its cost is counted."""

    def __init__(self, message: str, usage: TokenUsage):
        super().__init__(message)
        self.usage = usage


def is_fatal(err: Exception) -> bool:
    """Bad API key, no permission or no credit: retrying won't help."""
    status = getattr(err, "status_code", None)
    code = getattr(err, "code", None)
    return status in (401, 403) or code == "insufficient_quota"


def error_message(err: Exception) -> str:
    return " ".join(str(err).split())[:400]


def add_usage(total: TokenUsage, usage: TokenUsage) -> None:
    total.input_tokens += usage.input_tokens
    total.output_tokens += usage.output_tokens
    total.reasoning_tokens += usage.reasoning_tokens


def extract_once(messages: list[dict[str, str]]) -> tuple[JobExtraction, TokenUsage]:
    # If the JSON doesn't match the schema, responses.parse raises a pydantic ValidationError
    response = client.responses.parse(
        model=MODEL,
        instructions=INSTRUCTIONS,
        input=messages,
        text_format=JobExtraction,
    )

    usage = TokenUsage.from_openai(response.usage) if response.usage else TokenUsage(0, 0)

    # Refusals and truncated answers don't raise: we have to check them ourselves
    refusal = next(
        (
            part
            for item in response.output
            if item.type == "message"
            for part in item.content
            if part.type == "refusal"
        ),
        None,
    )
    if refusal:
        raise ExtractionError(f"model refused: {refusal.refusal}", usage)

    if response.status == "incomplete":
        reason = response.incomplete_details.reason if response.incomplete_details else "unknown"
        raise ExtractionError(f"incomplete: {reason}", usage)

    if response.output_parsed is None:
        raise ExtractionError("no structured output returned", usage)

    return response.output_parsed, usage


def main() -> None:
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    index = json.loads((POSTS_DIR / "index.json").read_text(encoding="utf-8"))

    # LIMIT=5 uv run extract-openai.py → only the first 5 posts (cheaper while testing)
    limit = get_env_int("LIMIT")
    posts = index[:limit] if limit else index
    results = []

    for i, job_post in enumerate(posts, start=1):
        print(f"{i}/{len(posts)} {job_post['file']}")
        text = (POSTS_DIR / job_post["file"]).read_text(encoding="utf-8")

        extracted: JobExtraction | None = None
        last_error: str | None = None
        attempts = 0
        tokens = TokenUsage(input_tokens=0, output_tokens=0)

        while extracted is None and attempts < MAX_ATTEMPTS:
            attempts += 1

            messages = [{"role": "user", "content": text}]
            if last_error:
                messages.append({
                    "role": "user",
                    "content": f"Your previous answer was rejected: {last_error}\n"
                    "Answer again, following the schema exactly.",
                })

            try:
                data, usage = extract_once(messages)
                add_usage(tokens, usage)
                extracted = data
            except Exception as err:
                if is_fatal(err):
                    print(f"\nStopped: {error_message(err)}. Check your OPENAI_API_KEY and your credit.")
                    sys.exit(1)
                if isinstance(err, ExtractionError):
                    add_usage(tokens, err.usage)
                last_error = error_message(err)
                print(f"   ⚠ attempt {attempts} failed: {last_error}")

        results.append({
            "file": job_post["file"],
            "source": job_post["source"],
            "extracted": extracted.model_dump() if extracted else None,
            "attempts": attempts,
            "error": None if extracted else last_error,
            "costUsd": usd(cost_of(MODEL, tokens)),
        })

        OUT_FILE.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")

    failed = [r for r in results if r["error"]]
    retried = [r for r in results if r["attempts"] > 1 and not r["error"]]
    print(
        f"\nDone: {len(results) - len(failed)}/{len(results)} ok"
        f" · {len(retried)} needed a retry · {len(failed)} failed"
    )
    for r in failed:
        print(f"   ✗ {r['file']}: {r['error']}")
    print("Saved to data/extractions/openai-py.json")


if __name__ == "__main__":
    main()
