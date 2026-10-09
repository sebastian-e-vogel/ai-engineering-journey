import { PRICES } from "./config";
import type { TokenUsage } from "./types";

const ONE_MILLION = 1_000_000;

/** Cost in USD of one request, or null when the model has no price in PRICES. */
export function costOf(model: string, usage: TokenUsage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  return (
    (usage.inputTokens * price.input + usage.outputTokens * price.output) /
    ONE_MILLION
  );
}

/** Readable USD amount for logs: 6.72e-7 → "0.00000067" (no scientific notation). */
export function usd(value: number | null): string | null {
  if (value === null) return null;
  return value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "") || "0";
}
