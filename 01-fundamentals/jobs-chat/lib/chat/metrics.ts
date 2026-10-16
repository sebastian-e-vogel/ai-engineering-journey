import type { LanguageModelUsage } from "ai";
import { MODEL, costOf, formatMetrics, type TokenUsage } from "@journey/shared";

type Step = { toolCalls: readonly unknown[] };

export function createChatMetrics() {
  const startedAt = performance.now();
  let ttftMs: number | null = null;
  const elapsedMs = () => performance.now() - startedAt;

  return {
    markFirstToken() {
      ttftMs ??= elapsedMs();
    },

    logEnd(total: LanguageModelUsage, steps: readonly Step[]) {
      const usage: TokenUsage = {
        inputTokens: total.inputTokens ?? 0,
        outputTokens: total.outputTokens ?? 0,
        reasoningTokens: total.outputTokenDetails?.reasoningTokens ?? 0,
      };
      const toolCalls = steps.flatMap((step) => step.toolCalls).length;
      const metrics = formatMetrics({
        model: MODEL,
        usage,
        ttftMs,
        totalMs: elapsedMs(),
        cost: costOf(MODEL, usage),
      });
      console.log(`${metrics} · steps ${steps.length} · tool calls ${toolCalls}`);
    },

    logAbort(finishedSteps: number) {
      console.log(
        `[aborted] after ${finishedSteps} finished steps, ${elapsedMs().toFixed(0)} ms`,
      );
    },
  };
}
