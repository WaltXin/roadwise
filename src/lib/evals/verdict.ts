import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { EvalRunResult, EvalScenario, EvalSide, EvalVerdict } from "@/db/schema";
import { getClient, OnboardingError } from "@/lib/onboarding/agent";

// The verdict model is deliberately separate from the advice: it sees only the suite, the
// acceptance criteria and the measured results — never Roadwise's own reasoning.
export const JUDGE_MODEL = process.env.ROADWISE_JUDGE_MODEL || "claude-opus-5-5";

export type ScenarioStats = { id: string; title: string; base: string; head?: string; failures: string[] };

function rate(results: EvalRunResult[], id: string) {
  const mine = results.filter((r) => r.scenario === id);
  return { passed: mine.filter((r) => r.passed).length, total: mine.length };
}

function failureReasons(results: EvalRunResult[], id: string) {
  return results
    .filter((r) => r.scenario === id && !r.passed)
    .map(
      (r) =>
        r.error ??
        r.checks
          .filter((c) => !c.passed)
          .map((c) => `${c.type}${"tool" in c ? ` ${c.tool}` : ""}: ${c.reason}`)
          .join("; "),
    )
    .slice(0, 3);
}

export function scenarioStats(scenarios: EvalScenario[], base: EvalSide, head?: EvalSide | null): ScenarioStats[] {
  return scenarios.map((s) => {
    const b = rate(base.results, s.id);
    const h = head ? rate(head.results, s.id) : null;
    return {
      id: s.id,
      title: s.title,
      base: `${b.passed}/${b.total}`,
      head: h ? `${h.passed}/${h.total}` : undefined,
      failures: [
        ...failureReasons(base.results, s.id).map((f) => `base: ${f}`),
        ...(head ? failureReasons(head.results, s.id).map((f) => `head: ${f}`) : []),
      ],
    };
  });
}

const Verdict = z.object({
  outcome: z.enum(["merge", "do_not_merge", "inconclusive", "baseline"]),
  summary: z.string(),
  scenarios: z.array(
    z.object({
      id: z.string(),
      finding: z.string(),
      status: z.enum(["improved", "regressed", "unchanged", "pass", "fail", "flaky"]),
    }),
  ),
});

const INSTRUCTIONS = `You are Roadwise's independent verifier. You judge measured evaluation results — nothing else. You did not write the recommendation and must not defend it.

- Base your verdict only on the pass rates and failure reasons given. Small samples are noisy: with 3 runs per scenario, 2/3 vs 3/3 is not a real difference unless failures show a consistent cause. Say "flaky" when a scenario passes some runs and fails others without a clear pattern.
- For a comparison (base vs head): "merge" only if the change improves what it targets and nothing regresses; "do_not_merge" if anything that worked now fails or the target didn't improve; "inconclusive" if the evidence can't tell.
- For a single run: outcome "baseline"; status per scenario is pass/fail/flaky; the summary names the most consequential failures for this product's callers.
- Criteria listed as unresolved stay unresolved: never claim them.
- Plain language, short. The summary is 2–4 sentences a founder can act on. Each finding is one sentence and names the concrete behavior (e.g. "booked without the caller's email in 2 of 3 runs").`;

export async function writeVerdict(input: {
  productName: string;
  scenarios: EvalScenario[];
  unresolved: { criterion: string; reason: string }[];
  acceptanceCriteria?: string;
  base: EvalSide;
  head?: EvalSide | null;
}): Promise<EvalVerdict> {
  const stats = scenarioStats(input.scenarios, input.base, input.head);
  const lines = stats.map((s) => {
    const scenario = input.scenarios.find((x) => x.id === s.id)!;
    return [
      `## ${s.id} ${s.title}`,
      `Measures: ${scenario.measures}`,
      `Checks: ${scenario.checks.map((c) => (c.type === "judge" ? `judge "${c.intent}"` : `${c.type} ${c.tool}${c.type === "tool_arg_equals" ? ` ${c.arg}=${c.value}` : ""}`)).join("; ")}`,
      `Base (${input.base.ref}): ${s.base} passed`,
      s.head ? `Head (${input.head!.ref}): ${s.head} passed` : "",
      s.failures.length ? `Failure reasons:\n${s.failures.map((f) => `- ${f}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const anthropic = getClient();
  const message = await anthropic.messages
    .stream({
      model: JUDGE_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(Verdict) },
      system: INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: `Product: ${input.productName}\nMode: ${input.head ? "comparison (base vs head)" : "single baseline run"}\n${
            input.acceptanceCriteria ? `Acceptance criteria agreed before testing: ${input.acceptanceCriteria}\n` : ""
          }Unresolved (not checkable here): ${input.unresolved.map((u) => `${u.criterion} (${u.reason})`).join("; ") || "none"}\n\n${lines.join("\n\n")}`,
        },
      ],
    })
    .finalMessage();
  if (message.stop_reason === "refusal") throw new OnboardingError("The verifier declined to judge these results.");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = Verdict.safeParse(JSON.parse(text));
  if (!parsed.success) throw new OnboardingError("The verdict didn't match the expected format.");
  const verdict = parsed.data;
  if (!input.head) verdict.outcome = "baseline";
  else if (verdict.outcome === "baseline") verdict.outcome = "inconclusive";
  return verdict;
}
