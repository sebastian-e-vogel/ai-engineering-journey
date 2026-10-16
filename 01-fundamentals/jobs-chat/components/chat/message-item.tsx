import { isToolUIPart, type UIMessage } from "ai";
import { LinkedText } from "@/components/linked-text";
import { ToolCard } from "@/components/tool-card/tool-card";

type MessageItemProps = {
  message: UIMessage;
  live: boolean;
};

export function MessageItem({ message, live }: MessageItemProps) {
  return (
    <article className={`message ${message.role}`}>
      {message.parts.map((part, index) => {
        if (part.type === "text")
          return <LinkedText key={index} text={part.text} />;
        if (isToolUIPart(part))
          return <ToolCard key={part.toolCallId} part={part} live={live} />;
        return null;
      })}
    </article>
  );
}
