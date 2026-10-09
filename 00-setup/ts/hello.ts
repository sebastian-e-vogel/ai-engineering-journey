import OpenAI from "openai";

process.loadEnvFile("../../.env");

// USD per 1M tokens (standard tier). Source: https://developers.openai.com/api/docs/pricing
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, output: 0.5 },
  "gpt-6.1-sol": { input: 2, output: 10 },
};

// Choose model and output limit from the environment:
//   MODEL=gpt-6.1-sol pnpm tsx hello.ts "..."
//   MAX_OUTPUT_TOKENS=50 pnpm tsx hello.ts "..."
const MODEL = process.env.MODEL ?? "gpt-6-luna";
const MAX_OUTPUT_TOKENS = process.env.MAX_OUTPUT_TOKENS
  ? Number(process.env.MAX_OUTPUT_TOKENS)
  : undefined;

const client = new OpenAI();
const prompt = process.argv[2] ?? "Explain in three sentences what an LLM is.";

const start = performance.now();
let ttft: number | null = null;

const response = await client.responses.create({
  model: MODEL,
  input: prompt,
  stream: true,
  max_output_tokens: MAX_OUTPUT_TOKENS,
});

for await (const event of response) {
  if (event.type === "response.output_text.delta") {
    // first text chunk: measure time-to-first-token (TTFT)
    if (ttft === null) ttft = performance.now() - start;
    process.stdout.write(event.delta);
  } else if (
    event.type === "response.completed" ||
    event.type === "response.incomplete"
  ) {
    // "incomplete" means the answer was cut, e.g. by max_output_tokens
    if (event.type === "response.incomplete") {
      console.log(
        `\n[truncated: ${event.response.incomplete_details?.reason ?? "unknown reason"}]`,
      );
    }

    const usage = event.response.usage;
    if (!usage) continue;
    const total = performance.now() - start;
    const price = PRICES[MODEL];

    console.log("\n\n--- metrics ---");
    console.log(`model: ${MODEL}`);
    console.log(
      `tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`,
    );
    console.log(`TTFT: ${ttft?.toFixed(0) ?? "-"} ms | total: ${total.toFixed(0)} ms`);
    if (price) {
      const cost =
        (usage.input_tokens * price.input + usage.output_tokens * price.output) /
        1_000_000;
      console.log(`cost: USD ${cost.toFixed(6)}`);
    } else {
      console.log(`cost: unknown (add "${MODEL}" to PRICES)`);
    }
  } else if (event.type === "error") {
    console.error(event.message);
  }
}
