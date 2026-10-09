import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  MODEL,
  costOf,
  createSessionLog,
  estimateTokens,
  formatMetrics,
  fromHere,
  getEnvNumber,
  streamResponse,
  type Message,
  type TokenUsage,
  usd,
} from "@journey/shared";

// MAX_HISTORY=4 pnpm chat  → sliding window: send only the last 4 messages
const MAX_HISTORY = getEnvNumber("MAX_HISTORY");
const SYSTEM_PROMPT =
  "You are a concise assistant for a React Native developer.";
const COMMANDS = "/history, /reset (or /clear), /exit";

// One JSON file per run in ./sessions (see createSessionLog)
const sessionLog = createSessionLog({
  dir: fromHere(import.meta.url, "./sessions/"),
  label: `${MODEL}_${MAX_HISTORY ? `window-${MAX_HISTORY}` : "full"}`,
});

// Two different things:
//  - history:    what the model "remembers" right now. /reset empties it.
//  - transcript: everything that happened in this run, for the log. Never emptied.
type TranscriptEntry = {
  at: string;
  event: "user" | "assistant" | "reset" | "error";
  turn?: number;
  content?: string;
  usage?: TokenUsage;
  costUsd?: string | null; // e.g. "0.0000672"
};

let history: Message[] = [];
const transcript: TranscriptEntry[] = [];
let turn = 0;
let sessionCost = 0;

function record(entry: Omit<TranscriptEntry, "at">) {
  transcript.push({ at: new Date().toISOString(), ...entry });
}

function saveLog(toSend: Message[] | null) {
  sessionLog.save({
    model: MODEL,
    maxHistory: MAX_HISTORY ?? null,
    startedAt: sessionLog.startedAt,
    instructions: SYSTEM_PROMPT,
    turn,
    sessionCostUsd: usd(sessionCost), // string, e.g. "0.0000672"
    history, // the model's current memory (empties on /reset)
    lastSent: toSend, // exactly what the last request sent (null after /reset)
    transcript, // everything that happened in this run
  });
}

const rl = readline.createInterface({ input: stdin, output: stdout });
console.log(
  `Chat with ${MODEL}${MAX_HISTORY ? ` (window: last ${MAX_HISTORY} messages)` : ""}.`,
);
console.log(`Commands: ${COMMANDS}`);

while (true) {
  let text: string;
  try {
    text = (await rl.question("\n[user input] > ")).trim();
  } catch {
    break; // input closed (Ctrl+D): exit cleanly
  }
  if (!text) continue;

  // --- commands: handled locally, never sent to the model ---
  if (text === "/exit") break;
  if (text === "/reset" || text === "/clear") {
    history = [];
    turn = 0;
    record({ event: "reset" });
    saveLog(null);
    console.log("History cleared.");
    continue;
  }
  if (text === "/history") {
    console.log(
      `${history.length} messages · ~${estimateTokens(history, SYSTEM_PROMPT)} tokens (local estimate)`,
    );
    continue;
  }
  if (text.startsWith("/")) {
    // a typo like "/clera" must not reach the model as a normal message
    console.log(`Unknown command "${text}". Commands: ${COMMANDS}`);
    continue;
  }

  // --- a new turn ---
  history.push({ role: "user", content: text });
  turn++;
  record({ event: "user", turn, content: text });

  // The API is stateless: we send the conversation again on every turn.
  // Always a COPY, so pushing the assistant reply later doesn't change what we logged as "sent".
  const toSend = MAX_HISTORY ? history.slice(-MAX_HISTORY) : [...history];
  const estimated = estimateTokens(toSend, SYSTEM_PROMPT);
  saveLog(toSend); // before the request: what we are about to send

  const result = await streamResponse(
    { model: MODEL, instructions: SYSTEM_PROMPT, input: toSend },
    {
      onFirstText: () => stdout.write("\n[assistant output]: "),
      onText: (delta) => stdout.write(delta),
    },
  );

  if (result.truncatedReason)
    console.log(`\n[truncated: ${result.truncatedReason}]`);

  const cost = result.usage ? costOf(MODEL, result.usage) : null;
  if (cost !== null) sessionCost += cost;
  if (result.usage) {
    console.log(
      "\n\n" +
        formatMetrics({
          turn,
          model: MODEL,
          usage: result.usage,
          estimatedInput: estimated,
          ttftMs: result.ttftMs,
          totalMs: result.totalMs,
          cost,
          sessionCost,
        }),
    );
  }

  if (result.error || !result.text) {
    // don't keep a question without an answer in the history (the transcript keeps it)
    const reason = result.error ?? "no answer received";
    console.error(`\n[error] ${reason} · message removed from history`);
    record({ event: "error", turn, content: reason, usage: result.usage ?? undefined, costUsd: usd(cost) });
    history.pop();
    turn--;
    saveLog(toSend);
    continue;
  }

  history.push({ role: "assistant", content: result.text });
  record({ event: "assistant", turn, content: result.text, usage: result.usage ?? undefined, costUsd: usd(cost) });
  saveLog(toSend); // after the answer: history and transcript include the reply
}

rl.close();
