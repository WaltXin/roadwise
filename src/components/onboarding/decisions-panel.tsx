"use client";

import { BotIcon, ChevronDownIcon, ExternalLinkIcon, FlagIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { Decision, Implementation } from "@/db/schema";
import { chooseDecision } from "@/lib/onboarding/actions";
import { cn } from "@/lib/utils";

import { RichText, type RefMap } from "./rich-text";
import { KnowledgeLinks } from "./roadmap-panel";

const CHAIN = [
  { key: "observed", label: "What we observed" },
  { key: "whyItMatters", label: "Why it matters here" },
  { key: "recommendation", label: "What we recommend" },
  { key: "howToTest", label: "How to test it" },
  { key: "acceptanceCriteria", label: "Acceptance criteria (set before testing)" },
  { key: "wouldChangeConclusion", label: "What would change our conclusion" },
] as const;

function Levels({ d }: { d: Decision }) {
  const items = [
    ["Impact", d.impact],
    ["Uncertainty", d.uncertainty],
    ["Cost to test", d.costToTest],
  ] as const;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map(([label, value]) => (
        <li key={label} className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {label}: <span className="font-medium text-foreground">{value}</span>
        </li>
      ))}
    </ul>
  );
}

function Chain({ d, refs }: { d: Decision; refs: RefMap }) {
  return (
    <ol className="relative flex flex-col gap-3">
      <span aria-hidden className="absolute top-2 bottom-2 left-[9px] w-px bg-border" />
      {CHAIN.map((step, i) => (
        <li key={step.key} className="relative flex gap-3">
          <span className="z-10 flex size-5 shrink-0 items-center justify-center rounded-full bg-background font-mono text-[0.65rem] font-medium ring-1 ring-foreground/15">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
            <RichText text={d[step.key]} refs={refs} className="gap-1.5 text-sm" />
          </div>
        </li>
      ))}
    </ol>
  );
}

const DATE = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

function ImplementationReports({ reports }: { reports: Implementation[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-background p-3 ring-1 ring-foreground/10">
      <p className="text-xs font-medium text-muted-foreground">
        Reported by a coding agent · not yet evaluated against the acceptance criteria
      </p>
      <ul className="flex flex-col gap-3">
        {reports.map((r) => (
          <li key={r.id} className="flex flex-col gap-1 text-sm">
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <BotIcon className="size-3.5" />
              <span className="font-medium text-foreground">{r.reportedBy}</span>
              <span>{DATE.format(r.createdAt)}</span>
              {r.prUrl && (
                <a
                  href={r.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
                >
                  Pull request <ExternalLinkIcon className="size-3" />
                </a>
              )}
              {!r.prUrl && r.commitSha && <span className="font-mono">{r.commitSha.slice(0, 7)}</span>}
            </p>
            <p className="whitespace-pre-line text-foreground/90">{r.summary}</p>
            {r.verification && (
              <p className="text-xs whitespace-pre-line text-muted-foreground">
                <span className="font-medium text-foreground/70">Verified by: </span>
                {r.verification}
              </p>
            )}
            {r.filesChanged.length > 0 && (
              <p className="truncate font-mono text-xs text-muted-foreground" title={r.filesChanged.join(", ")}>
                {r.filesChanged.join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DecisionsPanel({
  productId,
  decisions,
  implementations,
  refs,
}: {
  productId: string;
  decisions: Decision[];
  implementations: Implementation[];
  refs: RefMap;
}) {
  const selected = decisions.find((d) => d.status === "selected");
  const reports = selected ? implementations.filter((i) => i.decisionId === selected.id) : [];
  const candidates = decisions.filter((d) => d.status === "candidate");

  return (
    <section aria-labelledby="decisions-heading" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="border-b px-4 py-3">
        <h2 id="decisions-heading" className="font-medium">
          First decision
        </h2>
        <p className="text-xs text-muted-foreground">
          The one roadmap decision most worth investigating first, recorded as a full chain.
        </p>
      </header>

      {decisions.length === 0 && (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          After the roadmap review, Roadwise proposes two or three candidates. You choose one.
        </p>
      )}

      {selected && (
        <div className="flex flex-col gap-4 border-b bg-brand-soft/40 p-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                <FlagIcon className="size-3.5" /> Decision record · chosen
              </p>
              {reports.length > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2 py-px text-xs font-medium text-amber-700 dark:text-amber-400">
                  Implemented · awaiting evaluation
                </span>
              )}
            </div>
            <h3 className="font-semibold text-pretty">{selected.title}</h3>
            <Levels d={selected} />
          </div>
          <Chain d={selected} refs={refs} />
          <KnowledgeLinks refs={selected.refs} />
          {reports.length > 0 && <ImplementationReports reports={reports} />}
        </div>
      )}

      {candidates.length > 0 && (
        <ul className="flex flex-col gap-2 p-4">
          {selected && <li className="text-xs font-medium text-muted-foreground">Other candidates</li>}
          {candidates.map((d) => (
            <Candidate key={d.id} d={d} productId={productId} refs={refs} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Candidate({ d, productId, refs }: { d: Decision; productId: string; refs: RefMap }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10">
      <h3 className="text-sm font-medium text-pretty">{d.title}</h3>
      <Levels d={d} />
      <RichText text={d.recommendation} refs={refs} className="text-sm text-foreground/90" />
      {open && (
        <div className="flex flex-col gap-3 pt-1">
          <Chain d={d} refs={refs} />
          <KnowledgeLinks refs={d.refs} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <ChevronDownIcon data-icon="inline-start" className={cn("transition-transform", open && "rotate-180")} />
          {open ? "Hide the full chain" : "See the full chain"}
        </Button>
        <Button
          size="xs"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await chooseDecision(productId, d.id);
            })
          }
        >
          {pending ? "Choosing…" : "Choose this decision"}
        </Button>
      </div>
    </li>
  );
}
