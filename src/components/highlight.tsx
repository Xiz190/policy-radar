type Props = {
  text: string;
  query?: string;
  keywords?: string[];
  className?: string;
};

export function Highlight({ text, query = "", keywords, className }: Props) {
  const terms = (keywords && keywords.length > 0
    ? keywords.map((k) => (typeof k === "string" ? k : (k as { keyword?: string }).keyword ?? "").trim()).filter(Boolean)
    : [query.trim()].filter(Boolean));

  if (terms.length === 0) return <span className={className}>{text}</span>;

  const pattern = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-amber-200/80 px-0.5 text-slate-900">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
}
