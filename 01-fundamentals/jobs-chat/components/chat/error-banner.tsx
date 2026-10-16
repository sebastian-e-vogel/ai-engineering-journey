const UNREACHABLE = "Couldn't reach the server. Check the `pnpm dev` console.";

function readableMessage(error: Error): string {
  const message = error.message.trim();
  if (!message || message.startsWith("<") || message.length > 300)
    return UNREACHABLE;
  return message;
}

type ErrorBannerProps = {
  error: Error;
  onRetry: () => void;
};

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div className="error" role="alert">
      <p>{readableMessage(error)}</p>
      <button onClick={onRetry}>Retry</button>
    </div>
  );
}
