const SUGGESTIONS = [
  "Which senior remote jobs require Python?",
  "What are the top 5 most in-demand technologies?",
  "Which job posts are from Anthropic?",
];

export function Suggestions({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="empty">
      {SUGGESTIONS.map((suggestion) => (
        <button key={suggestion} onClick={() => onSelect(suggestion)}>
          {suggestion}
        </button>
      ))}
    </div>
  );
}
