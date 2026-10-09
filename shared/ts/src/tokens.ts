import { getEncoding, type Tiktoken } from "js-tiktoken";
import type { Message } from "./types";

// Loaded lazily, on first use, so scripts that never count tokens don't pay for it.
// o200k_base is the tokenizer of recent OpenAI models; for newer models it is an approximation.
let encoder: Tiktoken | null = null;

export function countTokens(text: string): number {
  encoder ??= getEncoding("o200k_base");
  return encoder.encode(text).length;
}

/** Rough local estimate: system prompt + each message + ~4 formatting tokens per message. */
export function estimateTokens(messages: Message[], systemPrompt = ""): number {
  return messages.reduce(
    (sum, m) => sum + countTokens(m.content) + 4,
    countTokens(systemPrompt),
  );
}
