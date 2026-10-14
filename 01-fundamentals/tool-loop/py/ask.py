import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from journey_shared import MODEL, ROOT_DIR, SessionLog, TokenUsage, client, cost_of, get_env_int, usd

POSTS_DIR = ROOT_DIR / "data" / "job-posts"
EXTRACTIONS_FILE = ROOT_DIR / "data" / "extractions" / "openai-ts.json"
MAX_STEPS = get_env_int("MAX_STEPS") or 5
MAX_RESULTS = 10
TEXT_CHARS = 1500
SENIORITIES = ["junior", "mid", "senior", "staff", "unknown"]

INSTRUCTIONS = """You answer questions about a fixed set of AI engineering job posts. You only know what the tools return.
- Use only data returned by the tools: never invent jobs, ids, fields or numbers.
- Cite the id of every job you mention, e.g. "Applied AI Engineer (id 08)".
- If a search returns no results, say so.
- If the data doesn't cover what is asked (e.g. salary), say you don't know.
- If the question is not about these job posts, say so without calling any tool."""

ALIASES = {
    "huggingface": "hugging face",
    "claude api": "claude",
    "claude platform": "claude",
    "claude developer platform": "claude",
    "node": "node.js",
    "nodejs": "node.js",
    "postgres": "postgresql",
    "k8s": "kubernetes",
    "golang": "go",
    "gcp": "google cloud",
    "google cloud platform": "google cloud",
}


def load_jobs() -> list[dict]:
    index = json.loads((POSTS_DIR / "index.json").read_text(encoding="utf-8"))
    extractions = {e["file"]: e["extracted"] for e in json.loads(EXTRACTIONS_FILE.read_text(encoding="utf-8"))}
    return [
        {
            "id": post["file"].split("-")[0],
            "file": post["file"],
            "title": post["title"].strip(),
            "company": post["company"],
            "location": post["location"],
            "url": post["url"],
            **extractions[post["file"]],
        }
        for post in index
        if extractions.get(post["file"])
    ]


JOBS = load_jobs()


def normalize(tech: str) -> str:
    key = tech.strip().lower()
    return ALIASES.get(key, key)


def techs_of(job: dict) -> set[str]:
    return {normalize(tech) for tech in job["stack"]}


def find_job(job_id: str) -> dict | None:
    return next((job for job in JOBS if job["id"] == job_id.strip().zfill(2)), None)


def summary(job: dict) -> dict:
    return {key: job[key] for key in ("id", "title", "company", "seniority", "remote", "location")}


def search_jobs(seniority: str | None, remote: bool | None, technologies: list[str] | None, company: str | None) -> dict:
    wanted = {normalize(tech) for tech in technologies or []}
    matches = [
        job
        for job in JOBS
        if (seniority is None or job["seniority"] == seniority)
        and (remote is None or job["remote"] is remote)
        and (company is None or company.lower() in job["company"].lower())
        and wanted <= techs_of(job)
    ]
    return {"total": len(matches), "jobs": [summary(job) for job in matches[:MAX_RESULTS]]}


def get_job_details(id: str) -> dict:
    job = find_job(id)
    if job is None:
        return {"error": f"job {id} not found"}

    raw = (POSTS_DIR / job["file"]).read_text(encoding="utf-8")
    _, separator, rest = raw.partition("\n---\n")
    body = (rest if separator else raw).strip()
    details = {key: value for key, value in job.items() if key != "file"}
    return {**details, "text": body[:TEXT_CHARS]}


def count_technologies(seniority: str | None, top_n: int) -> dict:
    jobs = [job for job in JOBS if seniority is None or job["seniority"] == seniority]
    counts: dict[str, int] = {}
    for job in jobs:
        for tech in techs_of(job):
            counts[tech] = counts.get(tech, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)[: max(1, top_n)]
    return {"jobs": len(jobs), "technologies": [{"name": name, "count": count} for name, count in ranked]}


def compare_jobs(ids: list[str]) -> dict:
    if len(ids) < 2:
        return {"error": "compare_jobs needs at least 2 ids"}
    missing = [job_id for job_id in ids if find_job(job_id) is None]
    if missing:
        return {"error": f"job {', '.join(missing)} not found"}

    jobs = [find_job(job_id) for job_id in ids]
    shared = [tech for tech in techs_of(jobs[0]) if all(tech in techs_of(job) for job in jobs)]
    return {
        "jobs": [{**summary(job), "stack": job["stack"]} for job in jobs],
        "shared_technologies": shared,
    }


NULLABLE_SENIORITY = {
    "anyOf": [{"type": "string", "enum": SENIORITIES}, {"type": "null"}],
    "description": "junior, mid, senior, staff or unknown (not stated). null = any.",
}

TOOLS = {
    "search_jobs": {
        "description": "Search the job posts. Every filter is optional: pass null to skip it. "
        "Returns the total number of matches and up to 10 jobs (id, title, company, seniority, remote, location).",
        "parameters": {
            "type": "object",
            "properties": {
                "seniority": NULLABLE_SENIORITY,
                "remote": {
                    "type": ["boolean", "null"],
                    "description": "true = remote, false = on-site or hybrid. null = any, including posts that don't say.",
                },
                "technologies": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "description": 'The job must list all of them, e.g. ["python", "mcp"]. Case-insensitive. null = any.',
                },
                "company": {
                    "type": ["string", "null"],
                    "description": "Company name or part of it, case-insensitive. null = any.",
                },
            },
            "required": ["seniority", "remote", "technologies", "company"],
            "additionalProperties": False,
        },
        "execute": search_jobs,
        "summarize": lambda output: f"{output['total']} results",
    },
    "get_job_details": {
        "description": "Get everything about one job post: seniority, remote, stack, required skills, "
        "URL and the first 1,500 characters of the post.",
        "parameters": {
            "type": "object",
            "properties": {"id": {"type": "string", "description": 'Job id, e.g. "08".'}},
            "required": ["id"],
            "additionalProperties": False,
        },
        "execute": get_job_details,
        "summarize": lambda output: f"job {output['id']}",
    },
    "count_technologies": {
        "description": "Count how many job posts mention each technology and return the most frequent ones.",
        "parameters": {
            "type": "object",
            "properties": {
                "seniority": NULLABLE_SENIORITY,
                "top_n": {"type": "integer", "description": "How many technologies to return."},
            },
            "required": ["seniority", "top_n"],
            "additionalProperties": False,
        },
        "execute": count_technologies,
        "summarize": lambda output: f"{len(output['technologies'])} technologies",
    },
    "compare_jobs": {
        "description": "Compare two or more job posts side by side: seniority, remote, location, stack "
        "and the technologies they share.",
        "parameters": {
            "type": "object",
            "properties": {
                "ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": 'Job ids to compare, e.g. ["01", "08"].',
                },
            },
            "required": ["ids"],
            "additionalProperties": False,
        },
        "execute": compare_jobs,
        "summarize": lambda output: f"{len(output['jobs'])} jobs",
    },
}

TOOL_DEFINITIONS = [
    {"type": "function", "name": name, "description": tool["description"], "parameters": tool["parameters"], "strict": True}
    for name, tool in TOOLS.items()
]


def compact(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def run_tool(call) -> dict:
    base = {"call_id": call.call_id, "name": call.name}
    try:
        args = json.loads(call.arguments)
    except json.JSONDecodeError:
        return {**base, "args": call.arguments, "output": {"error": "arguments are not valid JSON"}}
    tool = TOOLS.get(call.name)
    output = tool["execute"](**args) if tool else {"error": f"unknown tool {call.name}"}
    return {**base, "args": args, "output": output}


def describe(call: dict) -> str:
    output = call["output"]
    if isinstance(output, dict) and "error" in output:
        return f"error: {output['error']}"
    tool = TOOLS.get(call["name"])
    return tool["summarize"](output) if tool else "ok"


class Trace:
    def __init__(self, impl: str, question: str):
        self.impl = impl
        self.question = question
        self.session_log = SessionLog(Path(__file__).resolve().parent / "sessions", f"{MODEL}_{impl}")
        self.steps: list[dict] = []
        self.total = TokenUsage(input_tokens=0, output_tokens=0)
        self.latency_ms = 0.0
        self.tool_calls = 0
        self.answer: str | None = None
        self.limit_reached: bool | None = None

    def save(self) -> None:
        self.session_log.save({
            "impl": self.impl,
            "model": MODEL,
            "question": self.question,
            "max_steps": MAX_STEPS,
            "started_at": self.session_log.started_at,
            "limit_reached": self.limit_reached,
            "answer": self.answer,
            "totals": {
                "steps": len(self.steps),
                "tool_calls": self.tool_calls,
                "usage": vars(self.total),
                "latency_ms": round(self.latency_ms),
                "cost_usd": usd(cost_of(MODEL, self.total)),
            },
            "steps": self.steps,
        })

    def step(self, usage: TokenUsage, ms: float, tool_calls: list[dict]) -> None:
        self.total.input_tokens += usage.input_tokens
        self.total.output_tokens += usage.output_tokens
        self.total.reasoning_tokens += usage.reasoning_tokens
        self.latency_ms += ms
        self.tool_calls += len(tool_calls)
        self.steps.append({
            "step": len(self.steps) + 1,
            "at": datetime.now(timezone.utc).isoformat(),
            "tool_calls": tool_calls,
            "usage": vars(usage),
            "ms": round(ms),
            "cost_usd": usd(cost_of(MODEL, usage)),
        })
        self.save()

        detail = " · ".join(f"{call['name']}({compact(call['args'])}) → {describe(call)}" for call in tool_calls)
        print(f"[step {len(self.steps)}] {detail or 'answer'}")

    def finish(self, answer: str, limit_reached: bool) -> None:
        self.answer = answer
        self.limit_reached = limit_reached
        self.save()

        if limit_reached:
            print("\n[step limit reached]")
        print(f"\n{answer or '(no answer)'}\n")
        reasoning = f" (reasoning {self.total.reasoning_tokens})" if self.total.reasoning_tokens else ""
        print(
            f"[metrics] {MODEL} · {len(self.steps)} steps · {self.tool_calls} tool calls"
            f" · in: {self.total.input_tokens} · out: {self.total.output_tokens}{reasoning}"
            f" · {self.latency_ms:.0f} ms · USD {usd(cost_of(MODEL, self.total)) or '?'}"
        )
        print(f"Trace: {self.session_log.file.relative_to(Path.cwd(), walk_up=True)}")


def main() -> None:
    question = sys.argv[1].strip() if len(sys.argv) > 1 else ""
    if not question:
        print('Usage: uv run ask.py "<question>"')
        sys.exit(1)

    trace = Trace("openai-py", question)
    input_items: list = [{"role": "user", "content": question}]
    answer = ""
    pending = True
    step = 0

    while pending and step < MAX_STEPS:
        step += 1
        start = time.perf_counter()
        response = client.responses.create(
            model=MODEL,
            instructions=INSTRUCTIONS,
            input=input_items,
            tools=TOOL_DEFINITIONS,
        )
        ms = (time.perf_counter() - start) * 1000

        input_items += response.output

        calls = [item for item in response.output if item.type == "function_call"]
        results = [run_tool(call) for call in calls]
        for result in results:
            input_items.append({
                "type": "function_call_output",
                "call_id": result["call_id"],
                "output": compact(result["output"]),
            })

        usage = TokenUsage.from_openai(response.usage) if response.usage else TokenUsage(0, 0)
        trace.step(usage, ms, results)

        answer = response.output_text
        pending = bool(calls)

    trace.finish(answer, pending)


if __name__ == "__main__":
    main()
