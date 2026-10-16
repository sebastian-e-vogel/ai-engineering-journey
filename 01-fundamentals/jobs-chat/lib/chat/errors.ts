import { APICallError, RetryError } from "ai";

export function toUserMessage(error: unknown): string {
  const cause = RetryError.isInstance(error) ? error.lastError : error;

  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === 401)
      return "The OpenAI API key is invalid or missing (401). Check OPENAI_API_KEY in the root .env.";
    if (cause.statusCode === 429)
      return "OpenAI rejected the request because of a rate limit or quota (429). Wait a moment and retry.";
    if (cause.statusCode !== undefined && cause.statusCode >= 500)
      return `OpenAI is not responding properly (${cause.statusCode}). Retry in a while.`;
  }

  return "Something went wrong while generating the answer. Retry; if it keeps failing, check the server console.";
}
