import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { decisions, evalRuns, evalSuites, products, type EvalSide } from "@/db/schema";
import { rejectUnauthorized } from "@/lib/api-auth";
import { appUrl } from "@/lib/app-url";
import { JUDGE_MODEL, writeVerdict } from "@/lib/evals/verdict";
import { appendNote } from "@/lib/onboarding/notes";
import { OnboardingError } from "@/lib/onboarding/agent";

// The verdict is one model call over the measured results.
export const maxDuration = 300;

const Side = z.object({
  ref: z.string().min(1).max(200),
  commit: z.string().max(64),
  runs: z.number().int().min(1).max(20),
  results: z.array(z.looseObject({ scenario: z.string(), passed: z.boolean() })).max(500),
});

const Body = z.object({ suite_id: z.uuid(), base: Side, head: Side.nullable().optional() });

export async function POST(req: Request) {
  const denied = rejectUnauthorized(req);
  if (denied) return denied;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const body = parsed.data;
  const base = body.base as unknown as EvalSide;
  const head = (body.head ?? null) as unknown as EvalSide | null;

  const db = getDb();
  const [suite] = await db.select().from(evalSuites).where(eq(evalSuites.id, body.suite_id));
  if (!suite) return Response.json({ error: "Unknown suite." }, { status: 404 });
  const [product] = await db.select({ name: products.name }).from(products).where(eq(products.id, suite.productId));
  const [decision] = suite.decisionId
    ? await db.select().from(decisions).where(eq(decisions.id, suite.decisionId))
    : [undefined];

  try {
    const verdict = await writeVerdict({
      productName: product?.name ?? "the product",
      scenarios: suite.scenarios,
      unresolved: suite.unresolved,
      acceptanceCriteria: decision?.acceptanceCriteria,
      base,
      head,
    });
    const [run] = await db
      .insert(evalRuns)
      .values({
        productId: suite.productId,
        suiteId: suite.id,
        decisionId: suite.decisionId,
        base,
        head,
        verdict,
        judge: JUDGE_MODEL,
      })
      .returning({ id: evalRuns.id });

    const scope = head ? `${base.ref} vs ${head.ref}` : base.ref;
    await appendNote(
      suite.productId,
      `The Roadwise verifier ran the held-out eval suite (${suite.scenarios.length} scenarios × ${base.runs} runs, text mode) on ${scope}. Outcome: ${verdict.outcome}. ${verdict.summary}`,
    );
    return Response.json({
      run_id: run.id,
      verdict,
      url: appUrl(`/products/${suite.productId}`),
    });
  } catch (err) {
    if (err instanceof OnboardingError) return Response.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
