import {
  MODEL,
  costOf,
  formatMetrics,
  getEnvNumber,
  streamResponse,
} from "@journey/shared";

// MAX_OUTPUT_TOKENS=50 pnpm hello "..."  → cap the answer length
const MAX_OUTPUT_TOKENS = getEnvNumber("MAX_OUTPUT_TOKENS");
const prompt = process.argv[2] ?? "Explain in three sentences what an LLM is.";

const result = await streamResponse(
  { model: MODEL, input: prompt, max_output_tokens: MAX_OUTPUT_TOKENS },
  { onText: (delta) => process.stdout.write(delta) },
);

if (result.truncatedReason) console.log(`\n[truncated: ${result.truncatedReason}]`);
if (result.error) {
  console.error(`\n[error] ${result.error}`);
  process.exitCode = 1;
}
if (result.usage) {
  console.log(
    "\n\n" +
      formatMetrics({
        model: MODEL,
        usage: result.usage,
        ttftMs: result.ttftMs,
        totalMs: result.totalMs,
        cost: costOf(MODEL, result.usage),
      }),
  );
}
