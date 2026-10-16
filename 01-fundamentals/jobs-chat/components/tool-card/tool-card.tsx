import { getToolName } from "ai";
import { describeTool, formatToolInput, type ToolPart } from "./tool-status";

type ToolCardProps = {
  part: ToolPart;
  live: boolean;
};

export function ToolCard({ part, live }: ToolCardProps) {
  const name = getToolName(part);
  const { status, label } = describeTool(name, part, live);

  return (
    <div className={`tool tool-${status}`}>
      <div className="tool-head">
        <span className="tool-dot" aria-hidden />
        <code className="tool-name">{name}</code>
        <span className="tool-label">{label}</span>
      </div>
      <code className="tool-args">{formatToolInput(part.input) || "no filters"}</code>
      {part.state === "output-available" && (
        <details className="tool-result">
          <summary>Show result</summary>
          <pre>{JSON.stringify(part.output, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
