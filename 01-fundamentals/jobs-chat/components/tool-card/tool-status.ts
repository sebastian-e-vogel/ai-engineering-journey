import type { DynamicToolUIPart, ToolUIPart } from "ai";

export type ToolPart = ToolUIPart | DynamicToolUIPart;
export type ToolStatus = "running" | "done" | "error" | "cancelled";

type ToolLabels = {
  running: (input: any) => string;
  done: (output: any) => string;
};

const LABELS: Record<string, ToolLabels> = {
  search_jobs: {
    running: () => "Searching job posts…",
    done: (output) =>
      `${output.total} ${output.total === 1 ? "result" : "results"}`,
  },
  get_job_details: {
    running: (input) => (input?.id ? `Reading job ${input.id}…` : "Reading job…"),
    done: (output) => `Job ${output.id}`,
  },
  count_technologies: {
    running: () => "Counting technologies…",
    done: (output) => `${output.technologies.length} technologies`,
  },
};

export function describeTool(
  name: string,
  part: ToolPart,
  live: boolean,
): { status: ToolStatus; label: string } {
  const labels = LABELS[name];

  switch (part.state) {
    case "input-streaming":
    case "input-available":
      // Without output and no longer live (Stop or an error), it will never finish.
      if (!live) return { status: "cancelled", label: "Cancelled" };
      return { status: "running", label: labels?.running(part.input) ?? "Running…" };

    case "output-available": {
      const output = part.output as any;
      if (output && typeof output === "object" && "error" in output)
        return { status: "error", label: String(output.error) };
      return { status: "done", label: labels?.done(output) ?? "Done" };
    }

    case "output-error":
      return { status: "error", label: part.errorText };

    default:
      return { status: "cancelled", label: "Not run" };
  }
}

export function formatToolInput(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  return Object.entries(input)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join(" · ");
}
