"use client";

import { CheckIcon, PhoneIcon, XIcon } from "lucide-react";
import { useState } from "react";

import type { EvalRunResult, EvalScenario } from "@/db/schema";
import { cn } from "@/lib/utils";

type Entry = EvalRunResult["transcript"][number];

/** Splits a transcript into one segment per caller turn: what the agent did in response. */
function segments(transcript: Entry[], turns: string[]) {
  if (!transcript.some((t) => t.role === "user")) {
    // Older runs didn't record caller turns: show the agent's side as one block.
    return [{ caller: turns.join(" / "), agent: transcript }];
  }
  const out: { caller: string; agent: Entry[] }[] = [];
  for (const t of transcript) {
    if (t.role === "user") out.push({ caller: t.text ?? "", agent: [] });
    else out.at(-1)?.agent.push(t);
  }
  return out;
}

const HIGHLIGHT = new Set(["label_call_is_urgent", "transfer_call", "book_appointment"]);

function AgentSide({ entries }: { entries: Entry[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      {entries.map((e, i) =>
        e.role === "assistant" ? (
          <p key={i} className="rounded-lg rounded-tl-sm bg-muted px-3 py-2 text-sm leading-snug">
            {e.text}
          </p>
        ) : e.role === "tool_call" ? (
          <span
            key={i}
            className={cn(
              "self-start rounded-md px-2 py-0.5 font-mono text-[0.7rem]",
              HIGHLIGHT.has(e.tool ?? "")
                ? "bg-brand-soft font-semibold text-brand ring-1 ring-brand/30"
                : "bg-muted/60 text-muted-foreground",
            )}
          >
            ⚙ {e.tool}
            {e.tool === "label_call_is_urgent" ? " ⚑" : ""}
          </span>
        ) : null,
      )}
      {entries.length === 0 && <p className="text-xs text-muted-foreground italic">(no reply)</p>}
    </div>
  );
}

function Checks({ result }: { result?: EvalRunResult }) {
  if (!result) return null;
  return (
    <ul className="flex flex-col gap-1 border-t pt-2">
      {result.checks.map((c, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs">
          {c.passed ? (
            <CheckIcon className="mt-px size-3.5 shrink-0 text-emerald-600" />
          ) : (
            <XIcon className="mt-px size-3.5 shrink-0 text-red-600" />
          )}
          <span className={cn(!c.passed && "text-red-700 dark:text-red-400")}>
            {c.type === "judge"
              ? c.intent
              : c.type === "tool_arg_equals"
                ? `${c.tool}.${c.arg} = ${c.value}`
                : `${c.type === "tool_called" ? "Calls" : "Never calls"} ${c.tool}`}
          </span>
        </li>
      ))}
      {result.error && <li className="text-xs text-destructive">{result.error}</li>}
    </ul>
  );
}

/** The same simulated call, before and after the change, aligned by caller turn. */
export function CallCompare({
  scenarios,
  base,
  head,
  initial,
}: {
  scenarios: EvalScenario[];
  base: EvalRunResult[];
  head: EvalRunResult[];
  initial: string;
}) {
  const [id, setId] = useState(initial);
  const scenario = scenarios.find((s) => s.id === id) ?? scenarios[0];
  // Show a failing "before" run and a passing "after" run when they exist: the typical change.
  const before =
    base.find((r) => r.scenario === scenario.id && !r.passed) ?? base.find((r) => r.scenario === scenario.id);
  const after =
    head.find((r) => r.scenario === scenario.id && r.passed) ?? head.find((r) => r.scenario === scenario.id);
  const left = segments(before?.transcript ?? [], scenario.turns);
  const right = segments(after?.transcript ?? [], scenario.turns);
  const rows = Math.max(left.length, right.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Simulated calls">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === scenario.id}
            onClick={() => setId(s.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium ring-1 transition",
              s.id === scenario.id
                ? "bg-foreground text-background ring-foreground"
                : "bg-background text-muted-foreground ring-foreground/10 hover:text-foreground",
            )}
          >
            {s.id} · {s.title.length > 38 ? `${s.title.slice(0, 36)}…` : s.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs font-semibold tracking-wide uppercase">
        <p className="flex items-center gap-2 text-muted-foreground">
          Before <span className="font-mono normal-case">{before?.passed ? "✓ passed" : "✗ failed"}</span>
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          After <span className="font-mono normal-case">{after?.passed ? "✓ passed" : "✗ failed"}</span>
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="flex items-start gap-2 text-sm font-medium">
              <PhoneIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span>“{left[i]?.caller ?? right[i]?.caller}”</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <AgentSide entries={left[i]?.agent ?? []} />
              <AgentSide entries={right[i]?.agent ?? []} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Checks result={before} />
        <Checks result={after} />
      </div>
    </div>
  );
}
