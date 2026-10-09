import type OpenAI from "openai";
import { openai } from "./client";
import type { TokenUsage } from "./types";

type StreamParams = Omit<OpenAI.Responses.ResponseCreateParamsStreaming, "stream">;

type StreamHandlers = {
  /** Called once, when the first text chunk arrives (TTFT). */
  onFirstText?: () => void;
  /** Called for every text chunk. */
  onText?: (delta: string) => void;
};

export type StreamResult = {
  text: string;
  usage: TokenUsage | null;
  ttftMs: number | null;
  totalMs: number;
  /** Why the answer was cut (e.g. "max_output_tokens"), or null if it finished. */
  truncatedReason: string | null;
  /** Error message if the request failed, or null. */
  error: string | null;
};

/**
 * Sends one streaming request to the Responses API and collects everything we measure:
 * full text, token usage, TTFT, total time, truncation and errors. It never throws.
 */
export async function streamResponse(
  params: StreamParams,
  handlers: StreamHandlers = {},
): Promise<StreamResult> {
  const start = performance.now();
  let ttftMs: number | null = null;
  let text = "";
  let usage: TokenUsage | null = null;
  let truncatedReason: string | null = null;
  let error: string | null = null;

  try {
    const stream = await openai.responses.create({ ...params, stream: true });

    for await (const event of stream) {
      switch (event.type) {
        case "response.output_text.delta":
          if (ttftMs === null) {
            ttftMs = performance.now() - start;
            handlers.onFirstText?.();
          }
          text += event.delta;
          handlers.onText?.(event.delta);
          break;

        case "response.completed":
        case "response.incomplete":
          // "incomplete" = the answer was cut, e.g. by max_output_tokens
          if (event.type === "response.incomplete") {
            truncatedReason = event.response.incomplete_details?.reason ?? "unknown";
          }
          if (event.response.usage) {
            const u = event.response.usage;
            usage = {
              inputTokens: u.input_tokens,
              outputTokens: u.output_tokens,
              reasoningTokens: u.output_tokens_details?.reasoning_tokens ?? 0,
            };
          }
          break;

        case "error":
          error = event.message;
          break;
      }
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return { text, usage, ttftMs, totalMs: performance.now() - start, truncatedReason, error };
}
