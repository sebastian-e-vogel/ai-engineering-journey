import { zodTextFormat } from "openai/helpers/zod";
import { MODEL, openai } from "@journey/shared";
import {
  ExtractionError,
  INSTRUCTIONS,
  JobExtraction,
  runExtraction,
} from "./common";

await runExtraction("openai-ts", async (messages) => {
  // If the JSON doesn't match the schema, responses.parse throws a ZodError
  const response = await openai.responses.parse({
    model: MODEL,
    instructions: INSTRUCTIONS,
    input: messages,
    text: { format: zodTextFormat(JobExtraction, "job_extraction") },
  });

  const usage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    reasoningTokens:
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };

  const refusal = response.output
    .flatMap((item) => (item.type === "message" ? item.content : []))
    .find((part) => part.type === "refusal");
  if (refusal)
    throw new ExtractionError(`model refused: ${refusal.refusal}`, usage);

  if (response.status === "incomplete") {
    throw new ExtractionError(
      `incomplete: ${response.incomplete_details?.reason ?? "unknown"}`,
      usage,
    );
  }

  if (!response.output_parsed)
    throw new ExtractionError("no structured output returned", usage);

  return { data: response.output_parsed, usage };
});
