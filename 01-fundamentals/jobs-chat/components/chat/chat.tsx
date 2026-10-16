"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { ChatHeader } from "./chat-header";
import { Composer } from "./composer";
import { ErrorBanner } from "./error-banner";
import { MessageItem } from "./message-item";
import { Suggestions } from "./suggestions";

const transport = new DefaultChatTransport({ api: "/api/chat" });

export function Chat() {
  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const endRef = useScrollToBottom<HTMLDivElement>([messages, status]);

  const onSendMessage = (text: string) => sendMessage({ text });

  return (
    <main className="chat">
      <ChatHeader />

      <section className="messages" aria-live="polite">
        {messages.length === 0 ? (
          <Suggestions onSelect={onSendMessage} />
        ) : null}

        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            live={busy && index === messages.length - 1}
          />
        ))}

        {status === "submitted" && <div className="thinking">Thinking…</div>}
        {error && <ErrorBanner error={error} onRetry={regenerate} />}

        <div ref={endRef} />
      </section>

      <Composer busy={busy} onSend={onSendMessage} onStop={stop} />
    </main>
  );
}
