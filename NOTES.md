# Learning Journal

Daily log of my AI engineering journey: from fullstack JS to AI Engineer in 16 weeks.

## Structure

- `00-setup/` — first API call with streaming, token usage, latency and cost (TS + Python)
- `01-fundamentals/` — LLM fundamentals, structured outputs, tool calling, first evals
- `02-rag/` — retrieval-augmented generation with Postgres + pgvector
- `03-mcp/` — MCP servers and security
- `04-agents/` — agent loop by hand, memory, human-in-the-loop, then a framework
- `05-production/` — deploy, observability, cost and latency, evals in CI
- `python/` — parallel Python track (FastAPI service + evals)

---

## Log

### 2026-10-09 — 00-setup

- **What I did:**
  - Set up the monorepo with a shared, git-ignored `.env` and one folder per stage.
  - Called the OpenAI Responses API with streaming from TypeScript (`openai` SDK + `tsx`) and from Python (`openai` SDK + `uv`).
  - Printed token usage, time-to-first-token (TTFT), total latency and cost for each request.
  - Refactored both scripts: per-model price map, `MODEL` and `MAX_OUTPUT_TOKENS` env vars, and handling of `response.incomplete` (truncated answers).
- **What I learned:**
  - The API is stateless: every call is independent, so a conversation means resending the full history each time.
  - Streaming arrives as events: `response.output_text.delta` carries text chunks and `response.completed` carries the final usage.
  - Cost = (input tokens × input price + output tokens × output price) / 1M. `gpt-6-luna`: USD 0.10 in / USD 0.50 out per 1M tokens.
  - TTFT is the latency the user actually feels; total time matters less once text is flowing.
- **Experiments:**

| #   | Experiment                                          | Result                   | Takeaway |
| --- | --------------------------------------------------- | ------------------------ | -------- |
| 1   | Same prompt in Spanish vs English (input tokens), `gpt-6-luna` | EN "What is react native?": 11 · ES "¿Qué es React Native?": 11 | No difference: for a prompt this short, the fixed overhead the API adds around each message dominates the count. To compare languages, the same long paragraph has to be counted in both. |
| 2   | Same prompt in Spanish vs English (output tokens), `gpt-6-luna` | EN (3 runs): 133 / 122 / 143 · ES (2 runs): 92 / 88 | The Spanish answers were shorter, so output cost depends more on how long the model decides to answer than on the language. Spanish TTFT varied a lot: 1294 vs 2432 ms. |
| 3   | Same prompt 3 times with `gpt-6-luna` ("What is react native?") | TTFT: 2711 / 2775 / 2400 ms · total: 3525 / 4144 / 3445 ms · output: 133 / 122 / 143 tokens | Same prompt, different answer every time: output length varied ~17% and TTFT ~375 ms. LLM output is non-deterministic, so one run proves nothing. |
| 4   | `gpt-6-luna` vs `gpt-6.1-sol` (cost, latency) | luna (TS + Py): 141 / 146 out, TTFT 1881 / 1931 ms, total 2907 / 2789 ms, USD 0.000072 / 0.000074 · sol (TS + Py): 207 / 229 out, TTFT 1709 / 4367 ms, total 6552 / 9780 ms, USD 0.002092 / 0.002312 | Sol costs ~30x more per call (20x the price per token, plus longer answers with code samples and markdown) and takes 2–3x longer in total. For a simple factual question, luna is enough. Earlier runs with `gpt-6-sol` (no .1, not on the pricing page) printed a wrong cost because prices were hardcoded to luna; fixed with a per-model price map. |
| 5   | `max_output_tokens: 50` | Run 1 (old script): text cut mid-sentence ("...for iOS and Android using"), no metrics printed · Runs 2–3 (fixed script, TS + Py): `[truncated: max_output_tokens]`, 50 out, TTFT "-", **no visible text at all** | The limit counts every output token, including the hidden reasoning the model does before answering: in runs 2–3 the whole budget went to reasoning and nothing was left for the answer. A truncated stream ends with `response.incomplete`, which the script now handles. |
| 6   | API input tokens vs Tiktokenizer count | API: 11 · Tiktokenizer (gpt-4o tokenizer): 12 | Close but not equal: each model family has its own tokenizer and its own message formatting. The `usage` returned by the API is the source of truth for billing. |

- **Next steps:** exercise 1.1 (token and cost probe) and 1.2 (multi-turn chat CLI).
