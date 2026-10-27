# AI Engineering Journey

**Learning AI engineering by building real LLM-powered applications, one experiment at a time.**

I'm a software engineer with 6+ years of experience in full-stack and frontend development, currently expanding my expertise into Applied AI Engineering.

This repository documents my hands-on journey into building AI-powered applications with **TypeScript, Python, OpenAI APIs, and Vercel AI SDK**.

My goal is to understand what happens behind the abstractions: how LLMs interact with tools, how conversations maintain context, how to handle unreliable outputs, and how to measure latency, token usage, and costs.

## What I've Built

| Project | What I explored |
|---|---|
| [API Fundamentals](./00-setup/) | OpenAI Responses API, streaming, token usage, latency, and cost tracking |
| [Multi-turn Chat CLI](./01-fundamentals/chat-cli/) | Conversation history, context windows, token estimation, and session logging |
| [Structured Extraction](./01-fundamentals/job-extraction/) | Structured outputs using Zod and Pydantic, schema validation, retries, and SDK comparisons |
| [Tool Calling](./01-fundamentals/tool-loop/) | Manual function-calling loops, tool execution, multi-step orchestration, and execution traces |
| [AI Jobs Chat](./01-fundamentals/jobs-chat/) | Next.js conversational application with streamed responses, tool execution, error handling, and metrics |

## Featured Project: AI Jobs Chat

A conversational application built with **Next.js, React, OpenAI, and Vercel AI SDK**, allowing users to explore job postings through natural language.

Key capabilities:

- Streaming conversational responses.
- Function calling to search and inspect job postings.
- Multi-step tool execution with bounded iteration.
- Interactive rendering of tool execution states.
- Conversation context management.
- Cancellation, retry, and error handling.
- Token usage, latency, and cost monitoring.

[Explore the implementation](./01-fundamentals/jobs-chat/)

## Engineering Approach

I focus on understanding how AI applications work internally rather than relying exclusively on frameworks.

For example, I implemented a function-calling loop manually in TypeScript and Python before comparing it with Vercel AI SDK.

I also experiment with:

- Model behavior and non-deterministic outputs.
- Structured response validation.
- Context-window management.
- Tool execution and tracing.
- Streaming and perceived latency.
- API usage and cost optimization.
- Error handling and reliability.

My experiments, findings, and technical decisions are documented in [NOTES.md](./NOTES.md).

## Learning Roadmap

| Topic | Status |
|---|---|
| LLM APIs, streaming, and structured outputs | Completed |
| Function calling and tool orchestration | Completed |
| Conversational AI applications | Completed |
| RAG with PostgreSQL and pgvector | Planned |
| Model Context Protocol (MCP) | Planned |
| AI agents and memory | Planned |
| Human-in-the-loop workflows | Planned |
| Production deployment, observability, and evaluations | Planned |

This is an ongoing learning project. Planned topics are not yet implemented.

## Tech Stack

**Languages:** TypeScript, Python

**AI:** OpenAI Responses API, OpenAI SDK, Vercel AI SDK, Function Calling, Structured Outputs

**Frontend:** Next.js, React

**Validation:** Zod, Pydantic

**Tooling:** pnpm, uv, Git

**Engineering:** Streaming, Context Management, Token Usage Tracking, Cost Monitoring, Latency Measurement, Execution Tracing

## Getting Started

### Prerequisites

- Node.js and pnpm
- Python 3.13+ and uv
- OpenAI API key

Clone the repository:

```bash
git clone https://github.com/sebastian-e-vogel/ai-engineering-journey.git
cd ai-engineering-journey
```

Install dependencies:

```bash
pnpm install
uv sync --all-packages
```

Create a `.env` file in the repository root:

```env
OPENAI_API_KEY=your_api_key_here
MODEL=your_supported_model
```

Run the TypeScript exercises:

```bash
pnpm --filter 00-setup hello
pnpm --filter chat-cli chat
pnpm --filter job-extraction extract
pnpm --filter tool-loop ask
pnpm --filter jobs-chat dev
```

For the web chat, open `http://localhost:3000`.

Some job-posting exercises require local source files that are intentionally excluded from Git. The committed sample data alone does not fully reproduce those workflows.

## What's Next?

I'm currently extending this journey toward Retrieval-Augmented Generation, MCP integrations, agentic workflows, and production AI engineering practices.

My long-term goal is to combine my software engineering background with practical AI capabilities to build reliable, maintainable, real-world AI-powered products.

---

**Author:** [Sebastian Vogel](https://www.linkedin.com/in/sebastian-e-vogel/)

[GitHub Profile](https://github.com/sebastian-e-vogel) | [LinkedIn](https://www.linkedin.com/in/sebastian-e-vogel/)
