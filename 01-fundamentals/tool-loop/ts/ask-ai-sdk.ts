import { openai as openaiProvider } from "@ai-sdk/openai";
import { generateText, isStepCount } from "ai";
import { MODEL } from "@journey/shared";
import { INSTRUCTIONS, MAX_STEPS, aiSdkTools } from "@journey/job-tools";
import { readQuestion } from "./cli";
import { createTrace, type ToolCall } from "./trace";

const question = readQuestion("pnpm ask:ai-sdk");
const trace = createTrace("ai-sdk", question);

const result = await generateText({
  model: openaiProvider(MODEL),
  instructions: INSTRUCTIONS,
  prompt: question,
  tools: aiSdkTools(),
  stopWhen: [isStepCount(MAX_STEPS)],
  onStepEnd: (step) =>
    trace.step({
      usage: {
        inputTokens: step.usage.inputTokens ?? 0,
        outputTokens: step.usage.outputTokens ?? 0,
        reasoningTokens: step.usage.outputTokenDetails?.reasoningTokens ?? 0,
      },
      ms: step.performance.responseTimeMs,
      toolCalls: step.content.flatMap((part): ToolCall[] => {
        if (part.type === "tool-result") {
          return [
            {
              callId: part.toolCallId,
              name: part.toolName,
              args: part.input,
              output: part.output,
            },
          ];
        }
        if (part.type === "tool-error") {
          const error =
            part.error instanceof Error
              ? part.error.message
              : String(part.error);
          return [
            {
              callId: part.toolCallId,
              name: part.toolName,
              args: part.input,
              output: { error },
            },
          ];
        }
        return [];
      }),
    }),
});

trace.finish(result.text, result.finishReason === "tool-calls");
