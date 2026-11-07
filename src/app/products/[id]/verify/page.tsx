import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { RichText } from "@/components/onboarding/rich-text";
import { buttonVariants } from "@/components/ui/button";
import { CallCompare } from "@/components/verify/call-compare";
import { DotGrid } from "@/components/verify/dot-grid";
import { LoopStrip, type LoopStage } from "@/components/verify/loop-strip";
import { RunHistory } from "@/components/verify/run-history";
import { getVerificationReport, passRate, type VerificationReport } from "@/lib/evals/report";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Verification report" };

export default function VerifyPage({ params }: PageProps<"/products/[id]/verify">) {
  return (
    <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />}>
      <Report params={params} />
    </Suspense>
  );
}

const OUTCOME = {
  merge: { label: "Merge", style: "bg-emerald-600 text-white" },
  do_not_merge: { label: "Don't merge", style: "bg-red-600 text-white" },
  inconclusive: { label: "Inconclusive", style: "bg-amber-500 text-white" },
  baseline: { label: "Baseline", style: "bg-foreground text-background" },
} as const;

function firstSentence(text: string, max = 140) {
  const s = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function stagesFor(r: VerificationReport): LoopStage[] {
  const d = r.decision;
  const base = passRate(r.featured?.base);
  const head = passRate(r.featured?.head);
  const baseline = passRate(r.baseline?.base);
  return [
    {
      key: "signal",
      label: "Industry signal",
      // A concrete failure mode from industry context reads better than a priority's name.
      title: (d?.refs.find((x) => x.section === "context") ?? d?.refs[0])?.label ?? "Voice AI knowledge base",
      detail: d
        ? `${d.refs.length} knowledge entries cited in the decision`
        : "Curated sources, failure modes, priorities",
      done: true,
    },
    {
      key: "finding",
      label: "Product finding",
      title: baseline
        ? `Held-out eval on ${r.baseline!.base.ref}: ${baseline.passed}/${baseline.total}`
        : "No baseline yet",
      detail: r.baseline ? firstSentence(r.baseline.verdict.summary) : "Run the verifier on the current code",
      done: Boolean(r.baseline),
    },
    {
      key: "decision",
      label: "Decision",
      title: r.roadmapTitle ?? d?.title ?? "Not chosen yet",
      detail: d ? "Chosen by the founder · acceptance criteria set before testing" : "Founder chooses one candidate",
      done: Boolean(d),
    },
    {
      key: "implemented",
      label: "Coding agent",
      title: r.implementation
        ? `${r.implementation.reportedBy} · ${r.implementation.commitSha?.slice(0, 7) ?? r.implementation.branch ?? "reported"}`
        : "Not implemented yet",
      detail: r.implementation
        ? `Read the decision over MCP · ${r.implementation.filesChanged.length || "some"} files changed${r.implementation.branch ? ` on ${r.implementation.branch}` : ""} · reported back`
        : "Reads the decision over MCP",
      done: Boolean(r.implementation),
    },
    {
      key: "verified",
      label: "Verified",
      title:
        r.featured && base && head
          ? `${OUTCOME[r.featured.verdict.outcome].label}: ${base.passed} → ${head.passed} of ${head.total}`
          : "Not verified yet",
      detail: r.featured ? firstSentence(r.featured.verdict.summary, 120) : "Held-out scenarios, before vs after",
      done: Boolean(r.featured),
      tone:
        r.featured?.verdict.outcome === "merge"
          ? "good"
          : r.featured?.verdict.outcome === "do_not_merge"
            ? "bad"
            : "neutral",
    },
  ];
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const r = await getVerificationReport(id);
  if (!r) notFound();
  const run = r.featured;
  const suite = r.featuredSuite;
  const base = passRate(run?.base);
  const head = passRate(run?.head);
  const delta =
    base && head && base.total && head.total
      ? Math.round((head.passed / head.total - base.passed / base.total) * 100)
      : 0;
  const mostImproved = suite?.scenarios
    .map((s) => ({
      id: s.id,
      gain:
        (run?.head?.results.filter((x) => x.scenario === s.id && x.passed).length ?? 0) -
        (run?.base.results.filter((x) => x.scenario === s.id && x.passed).length ?? 0),
    }))
    .sort((a, b) => b.gain - a.gain)[0]?.id;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/products/${r.product.id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" /> {r.product.name} workspace
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Verification report</h1>
          <p className="text-sm text-muted-foreground">
            {r.product.name} · did the change the coding agent shipped do what the decision promised, without breaking
            anything?
          </p>
        </div>
      </div>

      <LoopStrip stages={stagesFor(r)} />

      {run && suite && base && head ? (
        <>
          <Section
            title="Before vs after"
            sub="Held-out scenarios Roadwise wrote from Voice AI knowledge and this decision. Each dot is one simulated call on OrangeChat's real prompt and tools."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto_auto_minmax(0,1fr)] md:items-center">
              <div className="rounded-xl bg-muted/60 px-5 py-3 text-center">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Before</p>
                <p className="font-mono text-4xl font-semibold tabular-nums">
                  {base.passed}
                  <span className="text-xl text-muted-foreground">/{base.total}</span>
                </p>
                <p className="font-mono text-xs text-muted-foreground">{run.base.commit}</p>
              </div>
              <div className="rounded-xl bg-brand-soft px-5 py-3 text-center ring-1 ring-brand/20">
                <p className="text-xs font-medium tracking-wide text-brand uppercase">After</p>
                <p className="font-mono text-4xl font-semibold text-brand tabular-nums">
                  {head.passed}
                  <span className="text-xl opacity-60">/{head.total}</span>
                </p>
                <p className="font-mono text-xs text-brand/80">
                  {run.head!.commit} · {delta >= 0 ? "+" : ""}
                  {delta} pts
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <span
                  className={cn(
                    "self-start rounded-full px-3 py-1 text-sm font-semibold",
                    OUTCOME[run.verdict.outcome].style,
                  )}
                >
                  Verdict: {OUTCOME[run.verdict.outcome].label}
                </span>
                <p className="text-sm text-pretty">{run.verdict.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {run.base.runs} runs per scenario · text mode · verdict by {run.judge}, which sees only the measured
                  results, not Roadwise&apos;s reasoning
                </p>
              </div>
            </div>
            <DotGrid run={run} scenarios={suite.scenarios} refs={r.refs} />
          </Section>

          <Section
            title="Same call, before and after"
            sub="The caller says the same thing. Highlighted chips are the actions that matter."
          >
            <CallCompare
              scenarios={suite.scenarios}
              base={run.base.results}
              head={run.head!.results}
              initial={mostImproved ?? suite.scenarios[0].id}
            />
          </Section>

          {suite.unresolved.length > 0 && (
            <Section title="What this can't tell you" sub="Kept explicitly unresolved instead of guessed.">
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {suite.unresolved.map((u, i) => (
                  <li key={i} className="rounded-lg bg-amber-500/5 p-3 text-sm ring-1 ring-amber-500/20">
                    <RichText text={`**${u.criterion}**`} refs={r.refs} className="text-sm" />
                    <p className="mt-1 text-xs text-muted-foreground">{u.reason}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      ) : (
        <Section title="No comparison yet">
          <p className="text-sm text-muted-foreground">
            Once the coding agent reports a change, run the verifier on base vs head to see the before/after here.
          </p>
        </Section>
      )}

      {r.history.length > 0 && (
        <Section title="Every run" sub="Each verifier run, oldest first. Grey: before; green: what was tested.">
          <RunHistory history={r.history} />
        </Section>
      )}

      <Link href={`/products/${r.product.id}`} className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
        <ArrowLeftIcon data-icon="inline-start" /> Back to the workspace
      </Link>
    </div>
  );
}
