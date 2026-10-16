import type OpenAI from "openai";
import { MODEL, openai } from "@journey/shared";
import { INSTRUCTIONS, MAX_STEPS, TOOLS } from "@journey/job-tools";
import { readQuestion } from "./cli";
import { createTrace, type ToolCall } from "./trace";

const question = readQuestion("pnpm ask");
const trace = createTrace("openai-ts", question);

const tools: OpenAI.Responses.FunctionTool[] = Object.entries(TOOLS).map(
  ([name, { description, parameters }]) => ({
    type: "function",
    name,
    description,
    parameters,
    strict: true,
  }),
);

function runTool(call: OpenAI.Responses.ResponseFunctionToolCall): ToolCall {
  const base = { callId: call.call_id, name: call.name };
  let args: unknown;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    return {
      ...base,
      args: call.arguments,
      output: { error: "arguments are not valid JSON" },
    };
  }
  const tool = TOOLS[call.name];
  const output = tool
    ? tool.execute(args)
    : { error: `unknown tool ${call.name}` };
  return { ...base, args, output };
}

const input: OpenAI.Responses.ResponseInputItem[] = [
  { role: "user", content: question },
];
let answer = "";
let pending = true;
let step = 0;

while (pending && step < MAX_STEPS) {
  step++;
  const start = performance.now();
  const response = await openai.responses.create({
    model: MODEL,
    instructions: INSTRUCTIONS,
    input,
    tools,
  });
  const ms = performance.now() - start;

  input.push(...(response.output as OpenAI.Responses.ResponseInputItem[]));

  const calls = response.output.filter((item) => item.type === "function_call");
  const results = calls.map(runTool);
  for (const { callId, output } of results) {
    input.push({
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(output),
    });
  }

  trace.step({
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      reasoningTokens:
        response.usage?.output_tokens_details?.reasoning_tokens ?? 0,
    },
    ms,
    toolCalls: results,
  });

  answer = response.output_text;
  pending = calls.length > 0;
}

trace.finish(answer, pending);
