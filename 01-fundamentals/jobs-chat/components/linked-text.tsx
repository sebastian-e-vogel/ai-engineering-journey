const URL_PATTERN = /(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])/;

export function LinkedText({ text }: { text: string }) {
  return (
    <div className="text">
      {text.split(URL_PATTERN).map((piece, index) =>
        index % 2 ? (
          <a key={index} href={piece} target="_blank" rel="noreferrer">
            {piece}
          </a>
        ) : (
          piece
        ),
      )}
    </div>
  );
}
