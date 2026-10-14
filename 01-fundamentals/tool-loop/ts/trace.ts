import path from "node:path";
import {
  MODEL,
  costOf,
  createSessionLog,
  fromHere,
  usd,
  type TokenUsage,
} from "@journey/shared";
import { MAX_STEPS, TOOLS } from "./tools";

export type ToolCall = {
  callId: string;
  name: string;
  args: unknown;
  output: unknown;
};

type Step = { usage: TokenUsage; ms: number; toolCalls: ToolCall[] };

function describe({ name, output }: ToolCall): string {
  if (output && typeof output === "object" && "error" in output)
    return `error: ${output.error}`;
  return TOOLS[name]?.summarize(output) ?? "ok";
}

export function createTrace(impl: string, question: string) {
  const sessionLog = createSessionLog({
    dir: fromHere(import.meta.url, "./sessions/"),
    label: `${MODEL}_${impl}`,
  });
  const steps: (Step & { step: number; at: string; costUsd: string | null })[] =
    [];
  const total: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
  };
  let latencyMs = 0;
  let toolCalls = 0;
  let answer: string | null = null;
  let limitReached: boolean | null = null;

  function save() {
    sessionLog.save({
      impl,
      model: MODEL,
      question,
      maxSteps: MAX_STEPS,
      startedAt: sessionLog.startedAt,
      limitReached,
      answer,
      totals: {
        steps: steps.length,
        toolCalls,
        usage: total,
        latencyMs: Math.round(latencyMs),
        costUsd: usd(costOf(MODEL, total)),
      },
      steps,
    });
  }

  return {
    step({ usage, ms, toolCalls: calls }: Step) {
      total.inputTokens += usage.inputTokens;
      total.outputTokens += usage.outputTokens;
      total.reasoningTokens += usage.reasoningTokens;
      latencyMs += ms;
      toolCalls += calls.length;
      steps.push({
        step: steps.length + 1,
        at: new Date().toISOString(),
        toolCalls: calls,
        usage,
        ms: Math.round(ms),
        costUsd: usd(costOf(MODEL, usage)),
      });
      save();

      const detail = calls.length
        ? calls
            .map(
              (call) =>
                `${call.name}(${JSON.stringify(call.args)}) → ${describe(call)}`,
            )
            .join(" · ")
        : "answer";
      console.log(`[step ${steps.length}] ${detail}`);
    },

    finish(finalAnswer: string, stepLimitReached: boolean) {
      answer = finalAnswer;
      limitReached = stepLimitReached;
      save();

      if (limitReached) console.log("\n[step limit reached]");
      console.log(`\n${answer || "(no answer)"}\n`);
      const reasoning = total.reasoningTokens
        ? ` (reasoning ${total.reasoningTokens})`
        : "";
      console.log(
        `[metrics] ${MODEL} · ${steps.length} steps · ${toolCalls} tool calls · in: ${total.inputTokens} · out: ${total.outputTokens}${reasoning} · ${latencyMs.toFixed(0)} ms · USD ${usd(costOf(MODEL, total)) ?? "?"}`,
      );
      console.log(`Trace: ${path.relative(process.cwd(), sessionLog.file)}`);
    },
  };
}
