import { openai as openaiProvider } from "@ai-sdk/openai"; // the AI SDK provider, not our shared client
import { generateText, NoObjectGeneratedError, Output, type LanguageModelUsage } from "ai";
import { MODEL } from "@journey/shared";
import { ExtractionError, INSTRUCTIONS, JobExtraction, runExtraction } from "./common";

const toTokens = (usage: LanguageModelUsage | undefined) => ({
  inputTokens: usage?.inputTokens ?? 0,
  outputTokens: usage?.outputTokens ?? 0,
  reasoningTokens: usage?.outputTokenDetails?.reasoningTokens ?? 0,
});

await runExtraction("ai-sdk", async (messages) => {
  try {
    const { output, usage } = await generateText({
      model: openaiProvider(MODEL),
      instructions: INSTRUCTIONS,
      messages,
      output: Output.object({ schema: JobExtraction }),
    });
    return { data: output, usage: toTokens(usage) };
  } catch (err) {
    // Invalid JSON or schema mismatch: the detail is in err.cause, and it still has the usage
    if (NoObjectGeneratedError.isInstance(err)) {
      const reason = err.cause instanceof Error ? err.cause.message : err.message;
      throw new ExtractionError(reason, toTokens(err.usage));
    }
    throw err;
  }
});
