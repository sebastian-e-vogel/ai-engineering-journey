export type Message = { role: "user" | "assistant"; content: string };

/** Token usage of one request, normalized from the API response. */
export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Hidden "thinking" tokens: billed as output, never shown. */
  reasoningTokens: number;
};
