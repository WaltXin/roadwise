import type { EvalRun, EvalScenario } from "@/db/schema";
import { cn } from "@/lib/utils";

import { RichText, type RefMap } from "../onboarding/rich-text";

export function scenarioRole(s: EvalScenario) {
  if (/guardrail/i.test(s.title)) return "Guardrail";
  if (/control/i.test(s.title)) return "Control";
  return "Target";
}

const ROLE_STYLE = {
  Target: "bg-brand-soft text-brand",
  Control: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Guardrail: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
} as const;

const STATUS_STYLE: Record<string, string> = {
  improved: "text-emerald-700 dark:text-emerald-400",
  pass: "text-emerald-700 dark:text-emerald-400",
  regressed: "text-red-700 dark:text-red-400",
  fail: "text-red-700 dark:text-red-400",
  flaky: "text-amber-700 dark:text-amber-400",
  unchanged: "text-muted-foreground",
};

function Dots({ results }: { results: { passed: boolean }[] }) {
  return (
    <span
      className="inline-flex gap-1"
      aria-label={`${results.filter((r) => r.passed).length} of ${results.length} passed`}
    >
      {results.map((r, i) => (
        <span
          key={i}
          className={cn("size-3.5 rounded-full", r.passed ? "bg-emerald-500" : "bg-red-500/85")}
          title={r.passed ? "passed" : "failed"}
        />
      ))}
    </span>
  );
}

/** One row per scenario; each dot is one simulated call, before and after the change. */
export function DotGrid({ run, scenarios, refs }: { run: EvalRun; scenarios: EvalScenario[]; refs: RefMap }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-2 text-left font-medium">Simulated call</th>
            <th className="pb-2 text-left font-medium">Before</th>
            <th className="pb-2 text-left font-medium">After</th>
            <th className="pb-2 text-left font-medium">Finding</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const role = scenarioRole(s);
            const v = run.verdict.scenarios.find((x) => x.id === s.id);
            return (
              <tr key={s.id} className="border-t align-top">
                <td className="py-2.5 pr-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn("rounded px-1.5 py-px text-[0.65rem] font-semibold uppercase", ROLE_STYLE[role])}
                    >
                      {role}
                    </span>
                    <span className="font-medium">{s.title}</span>
                  </div>
                  {s.refs.length > 0 && (
                    <RichText
                      text={`Why: ${s.refs.map((r) => `[${r}]`).join(" ")} ${s.refs
                        .map((r) => refs[r]?.label)
                        .filter(Boolean)
                        .slice(0, 1)
                        .join("")}`}
                      refs={refs}
                      className="mt-1 text-xs text-muted-foreground"
                    />
                  )}
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  <Dots results={run.base.results.filter((r) => r.scenario === s.id)} />
                </td>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  <Dots results={(run.head?.results ?? []).filter((r) => r.scenario === s.id)} />
                </td>
                <td className="py-2.5 text-xs text-foreground/80">
                  {v && <span className={cn("mr-1 font-semibold capitalize", STATUS_STYLE[v.status])}>{v.status}</span>}
                  {v?.finding}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
