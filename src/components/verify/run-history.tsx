import type { VerificationReport } from "@/lib/evals/report";
import { cn } from "@/lib/utils";

const OUTCOME = {
  merge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  do_not_merge: "bg-red-500/10 text-red-700 dark:text-red-400",
  inconclusive: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  baseline: "bg-muted text-foreground/80",
} as const;

const DATE = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

function pct(rate: { passed: number; total: number } | null | undefined) {
  return rate && rate.total ? Math.round((rate.passed / rate.total) * 100) : 0;
}

/** Every verifier run, oldest first: the pass rate of what was tested (head, or base for a baseline). */
export function RunHistory({ history }: { history: VerificationReport["history"] }) {
  return (
    <ol className="flex flex-col gap-2">
      {history.map((h, i) => {
        const tested = h.head ?? h.base;
        const p = pct(tested.rate);
        return (
          <li key={h.id} className="grid grid-cols-[2rem_minmax(0,1fr)_7rem] items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="font-medium">
                  {h.head ? `${h.head.ref} vs ${h.base.ref}` : `${h.base.ref} (baseline)`}
                </span>
                <span className="text-muted-foreground">
                  suite v{h.suite} · {h.suiteFocus === "decision" ? "decision tests" : "baseline tests"} ·{" "}
                  {DATE.format(h.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  {h.head && (
                    <div
                      className="absolute inset-y-0 left-0 bg-foreground/15"
                      style={{ width: `${pct(h.base.rate)}%` }}
                    />
                  )}
                  <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${p}%` }} />
                </div>
                <span className="w-24 text-right font-mono text-xs tabular-nums">
                  {h.head && h.base.rate ? `${h.base.rate.passed}→` : ""}
                  {tested.rate?.passed}/{tested.rate?.total}
                </span>
              </div>
            </div>
            <span className={cn("justify-self-end rounded-full px-2 py-px text-[0.7rem] font-semibold", OUTCOME[h.outcome])}>
              {h.outcome.replaceAll("_", " ")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
