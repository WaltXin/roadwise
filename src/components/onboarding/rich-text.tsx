import { Fragment } from "react";

import { cn } from "@/lib/utils";

export type RefMap = Record<string, { label: string; url?: string | null }>;

/** A citation to a knowledge entry, e.g. [C12]. */
export function RefChip({ id, refs }: { id: string; refs: RefMap }) {
  const ref = refs[id];
  const className =
    "mx-0.5 inline-flex items-center rounded-md bg-brand-soft px-1.5 py-px align-baseline font-mono text-[0.7rem] font-medium text-brand ring-1 ring-brand/20";
  if (!ref) return <span className={className}>{id}</span>;
  if (ref.url) {
    return (
      <a
        href={ref.url}
        target="_blank"
        rel="noreferrer"
        title={ref.label}
        className={cn(className, "hover:ring-brand/50")}
      >
        {id}
      </a>
    );
  }
  return (
    <span title={ref.label} className={className}>
      {id}
    </span>
  );
}

function inline(text: string, refs: RefMap) {
  // Split on citations ([C12]) and **bold**, keeping the delimiters.
  return text.split(/(\[[SCEQ]\d+\]|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (/^\[[SCEQ]\d+\]$/.test(part)) return <RefChip key={i} id={part.slice(1, -1)} refs={refs} />;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Renders Roadwise's plain-text replies: paragraphs, simple lists, bold, and citation chips. */
export function RichText({ text, refs, className }: { text: string; refs: RefMap; className?: string }) {
  const blocks = text.split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const isList = lines.length > 0 && lines.every((l) => /^\s*([-•*]|\d+[.)])\s+/.test(l));
        if (isList) {
          const ordered = /^\s*\d/.test(lines[0]);
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={cn("flex flex-col gap-1 pl-5", ordered ? "list-decimal" : "list-disc")}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-•*]|\d+[.)])\s+/, ""), refs)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} className="whitespace-pre-line">
            {inline(block, refs)}
          </p>
        );
      })}
    </div>
  );
}
