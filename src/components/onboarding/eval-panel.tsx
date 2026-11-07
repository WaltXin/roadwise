"use client";

import { ChevronDownIcon, FlaskConicalIcon, PresentationIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import type { EvalRun, EvalRunResult, EvalScenario, EvalSuite } from "@/db/schema";
import { generateEvalSuite } from "@/lib/evals/actions";
import { cn } from "@/lib/utils";

import { RichText, type RefMap } from "./rich-text";
import { KnowledgeLinks } from "./roadmap-panel";

const OUTCOME = {
  merge: { label: "Merge", style: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  do_not_merge: { label: "Don't merge", style: "bg-red-500/10 text-red-700 dark:text-red-400" },
  inconclusive: { label: "Inconclusive", style: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  baseline: { label: "Baseline", style: "bg-muted text-foreground/80" },
} as const;

const STATUS: Record<string, string> = {
  improved: "text-emerald-700 dark:text-emerald-400",
  pass: "text-emerald-700 dark:text-emerald-400",
  regressed: "text-red-700 dark:text-red-400",
  fail: "text-red-700 dark:text-red-400",
  flaky: "text-amber-700 dark:text-amber-400",
  unchanged: "text-muted-foreground",
};

const DATE = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function rate(results: EvalRunResult[], id: string) {
  const mine = results.filter((r) => r.scenario === id);
  if (mine.length === 0) return null;
  return { passed: mine.filter((r) => r.passed).length, total: mine.length };
}

function Rate({ value }: { value: { passed: number; total: number } | null }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const all = value.passed === value.total;
  const none = value.passed === 0;
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        all
          ? "text-emerald-700 dark:text-emerald-400"
          : none
            ? "text-red-700 dark:text-red-400"
            : "text-amber-700 dark:text-amber-400",
      )}
    >
      {value.passed}/{value.total}
    </span>
  );
}

function Transcript({ result }: { result: EvalRunResult }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted/60 p-2 text-xs">
      {result.transcript.map((t, i) =>
        t.role === "user" || t.role === "assistant" ? (
          <p key={i}>
            <span className="font-medium text-muted-foreground">{t.role === "user" ? "Caller" : "Agent"}: </span>
            {t.text}
          </p>
        ) : t.role === "tool_call" ? (
          <p key={i} className="font-mono text-[0.7rem] text-muted-foreground">
            → {t.tool}({JSON.stringify(t.args)})
          </p>
        ) : null,
      )}
      {result.error && <p className="font-medium text-destructive">{result.error}</p>}
      {result.checks
        .filter((c) => !c.passed)
        .map((c, i) => (
          <p key={`c${i}`} className="font-medium text-red-700 dark:text-red-400">
            ✗ {c.type === "judge" ? `judge: ${c.intent}` : `${c.type} ${c.tool}`}
            {c.reason ? ` — ${c.reason}` : ""}
          </p>
        ))}
    </div>
  );
}

function ScenarioRow({ scenario, run, refs }: { scenario: EvalScenario; run?: EvalRun; refs: RefMap }) {
  const [open, setOpen] = useState(false);
  const verdict = run?.verdict.scenarios.find((s) => s.id === scenario.id);
  const failed =
    run?.head?.results.find((r) => r.scenario === scenario.id && !r.passed) ??
    run?.base.results.find((r) => r.scenario === scenario.id && !r.passed);
  const sample =
    failed ??
    run?.head?.results.find((r) => r.scenario === scenario.id) ??
    run?.base.results.find((r) => r.scenario === scenario.id);
  return (
    <Fragment>
      <tr className="border-t align-top">
        <td className="py-2 pr-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-start gap-1.5 text-left hover:underline"
          >
            <ChevronDownIcon className={cn("mt-0.5 size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
            <span>
              <span className="font-mono text-xs text-muted-foreground">{scenario.id}</span>{" "}
              <span className="text-sm font-medium">{scenario.title}</span>
            </span>
          </button>
          {verdict && (
            <p className="mt-1 pl-5 text-xs text-muted-foreground">
              <span className={cn("font-medium", STATUS[verdict.status])}>{verdict.status}</span> · {verdict.finding}
            </p>
          )}
        </td>
        <td className="py-2 pr-2 text-right">{run ? <Rate value={rate(run.base.results, scenario.id)} /> : null}</td>
        <td className="py-2 text-right">{run?.head ? <Rate value={rate(run.head.results, scenario.id)} /> : null}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={3} className="pb-3 pl-5">
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-xs">
                <span className="font-medium text-muted-foreground">Measures: </span>
                {scenario.measures}
              </p>
              <RichText text={scenario.rationale} refs={refs} className="text-xs text-foreground/85" />
              <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                {scenario.checks.map((c, i) => (
                  <li key={i}>
                    ✓{" "}
                    {c.type === "judge"
                      ? `Judge: ${c.intent}`
                      : c.type === "tool_arg_equals"
                        ? `${c.tool}.${c.arg} = "${c.value}"`
                        : `${c.type === "tool_called" ? "Calls" : "Never calls"} ${c.tool}`}
                  </li>
                ))}
              </ul>
              {sample ? (
                <>
                  <p className="text-xs font-medium text-muted-foreground">
                    {failed ? "A failing run" : "A sample run"} (
                    {run?.head && run.head.results.includes(sample) ? "head" : "base"})
                  </p>
                  <Transcript result={sample} />
                </>
              ) : (
                <div className="flex flex-col gap-1 rounded-md bg-muted/60 p-2 text-xs">
                  {scenario.turns.map((t, i) => (
                    <p key={i}>
                      <span className="font-medium text-muted-foreground">Caller: </span>
                      {t}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function EvalPanel({
  productId,
  connectorLabel,
  suite,
  runs,
  refs,
}: {
  productId: string;
  connectorLabel: string;
  suite: EvalSuite | null;
  runs: EvalRun[];
  refs: RefMap;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const latest = runs[0];

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateEvalSuite(productId);
      if (result.error) setError(result.error);
    });
  }

  const command = `npm run verify -- --product ${productId} --repo ~/Dev/orangechat --base main --head working`;

  return (
    <section aria-labelledby="eval-heading" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex items-start gap-3 border-b px-4 py-3">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <h2 id="eval-heading" className="font-medium">
            Verification · held-out evaluation
          </h2>
          <p className="text-xs text-muted-foreground">
            Scenarios Roadwise wrote from industry knowledge and this product, run on {connectorLabel}. The coding agent
            never sees them.
          </p>
        </div>
        {runs.some((r) => r.head) && (
          <Link href={`/products/${productId}/verify`} className={buttonVariants({ variant: "outline", size: "xs" })}>
            <PresentationIcon data-icon="inline-start" />
            Report
          </Link>
        )}
        {suite && (
          <Button variant="ghost" size="xs" onClick={generate} disabled={pending} aria-label="Rewrite the suite">
            <RefreshCwIcon data-icon="inline-start" className={cn(pending && "animate-spin")} />
            {pending ? "Writing…" : "Rewrite"}
          </Button>
        )}
      </header>

      {!suite ? (
        <div className="flex flex-col items-start gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Roadwise writes the evaluation a Voice AI expert would: failure modes and priorities from the knowledge
            base, applied to how this agent actually works.
          </p>
          <Button onClick={generate} disabled={pending}>
            <FlaskConicalIcon data-icon="inline-start" />
            {pending ? "Writing scenarios from the knowledge base… (about a minute)" : "Write the evaluation suite"}
          </Button>
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
          {latest ? (
            <div className="flex flex-col gap-2 rounded-lg bg-background p-3 ring-1 ring-foreground/10">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn("rounded-full px-2 py-px text-xs font-semibold", OUTCOME[latest.verdict.outcome].style)}
                >
                  {OUTCOME[latest.verdict.outcome].label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {latest.head
                    ? `${latest.base.ref} (${latest.base.commit}) vs ${latest.head.ref} (${latest.head.commit})`
                    : `${latest.base.ref} (${latest.base.commit})`}{" "}
                  · {latest.base.runs} runs per scenario · verdict by {latest.judge} · {DATE.format(latest.createdAt)}
                </span>
              </div>
              <p className="text-sm text-pretty">{latest.verdict.summary}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 rounded-lg bg-background p-3 text-sm ring-1 ring-foreground/10">
              <p className="text-muted-foreground">Not run yet. Run the verifier where the agent&apos;s code lives:</p>
              <pre className="rounded-md bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap">{command}</pre>
            </div>
          )}

          <p className="text-sm text-foreground/85">{suite.summary}</p>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="pb-1 text-left font-medium">Scenario</th>
                <th className="w-14 pb-1 text-right font-medium">{latest?.head ? "Base" : latest ? "Pass" : ""}</th>
                <th className="w-14 pb-1 text-right font-medium">{latest?.head ? "Head" : ""}</th>
              </tr>
            </thead>
            <tbody>
              {suite.scenarios.map((s) => (
                <ScenarioRow key={s.id} scenario={s} run={latest} refs={refs} />
              ))}
            </tbody>
          </table>

          {suite.unresolved.length > 0 && (
            <div className="flex flex-col gap-1 rounded-lg bg-amber-500/5 p-3 ring-1 ring-amber-500/20">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Unresolved: this harness can&apos;t check these
              </p>
              <ul className="flex flex-col gap-0.5 text-xs text-foreground/80">
                {suite.unresolved.map((u, i) => (
                  <li key={i}>
                    <span className="font-medium">{u.criterion}</span> — {u.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <KnowledgeLinks refs={suite.refs} />
          {latest && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Run the verifier again</summary>
              <pre className="mt-1 rounded-md bg-muted p-2 font-mono break-all whitespace-pre-wrap">{command}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
