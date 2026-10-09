import "./env";

// USD per 1M tokens (standard tier). Source: https://developers.openai.com/api/docs/pricing
export const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-6.1-sol": { input: 2, output: 10 },
};

// MODEL=gpt-6.1-sol pnpm <script>  → pick the model (can also live in .env)
export const MODEL = process.env.MODEL ?? "gpt-6-luna";

/** Reads a numeric env var: MAX_HISTORY=4 → 4, unset → undefined. */
export function getEnvNumber(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`${name} must be a number, got "${raw}"`);
  return value;
}
