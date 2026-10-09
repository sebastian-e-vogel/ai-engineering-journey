import type { TokenUsage } from "./types";

type MetricsInput = {
  model: string;
  usage: TokenUsage;
  ttftMs: number | null;
  totalMs: number;
  cost: number | null;
  turn?: number;
  estimatedInput?: number;
  sessionCost?: number;
};

/** One line with everything we measure for a request. */
export function formatMetrics(m: MetricsInput): string {
  const label = m.turn !== undefined ? `[turn ${m.turn}]` : "[metrics]";
  const parts = [
    m.model,
    `in: ${m.usage.inputTokens}${m.estimatedInput !== undefined ? ` (est. ${m.estimatedInput})` : ""}`,
    `out: ${m.usage.outputTokens}${m.usage.reasoningTokens ? ` (reasoning ${m.usage.reasoningTokens})` : ""}`,
    `TTFT ${m.ttftMs !== null ? m.ttftMs.toFixed(0) : "-"} ms`,
    `total ${m.totalMs.toFixed(0)} ms`,
    m.cost !== null ? `USD ${m.cost.toFixed(6)}` : `cost unknown (add "${m.model}" to PRICES)`,
  ];
  if (m.sessionCost !== undefined) parts.push(`session USD ${m.sessionCost.toFixed(6)}`);
  return `${label} ${parts.join(" · ")}`;
}
