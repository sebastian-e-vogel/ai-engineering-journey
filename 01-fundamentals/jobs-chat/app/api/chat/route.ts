import { openai } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { MODEL } from "@journey/shared";
import { MAX_STEPS, aiSdkTools } from "@journey/job-tools";
import { CHAT_INSTRUCTIONS, CHAT_TOOL_NAMES } from "@/lib/chat/config";
import { toUserMessage } from "@/lib/chat/errors";
import { createChatMetrics } from "@/lib/chat/metrics";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const metrics = createChatMetrics();

  const result = streamText({
    model: openai(MODEL),
    instructions: CHAT_INSTRUCTIONS,
    messages: await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    }),
    tools: aiSdkTools(CHAT_TOOL_NAMES),
    stopWhen: [isStepCount(MAX_STEPS)],
    abortSignal: req.signal,
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") metrics.markFirstToken();
    },
    onEnd: ({ usage, steps }) => metrics.logEnd(usage, steps),
    onAbort: ({ steps }) => metrics.logAbort(steps.length),
    onError: ({ error }) => console.error("[chat error]", error),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: toUserMessage,
    }),
  });
}
