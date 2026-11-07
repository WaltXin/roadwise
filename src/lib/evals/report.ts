import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { decisions, evalRuns, evalSuites, implementations, products, roadmapItems, type EvalSide } from "@/db/schema";
import { loadDomainKnowledge } from "@/lib/onboarding/knowledge-context";

export function passRate(side: EvalSide | null | undefined) {
  if (!side) return null;
  return { passed: side.results.filter((r) => r.passed).length, total: side.results.length };
}

/** Everything the verification report shows for a product's chosen decision. */
export async function getVerificationReport(productId: string) {
  await connection();
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) return null;

  const [[decision], suites, runs, knowledge] = await Promise.all([
    db
      .select({ decision: decisions, roadmapTitle: roadmapItems.title })
      .from(decisions)
      .leftJoin(roadmapItems, eq(roadmapItems.id, decisions.roadmapItemId))
      .where(and(eq(decisions.productId, productId), eq(decisions.status, "selected"))),
    db.select().from(evalSuites).where(eq(evalSuites.productId, productId)).orderBy(asc(evalSuites.createdAt)),
    db.select().from(evalRuns).where(eq(evalRuns.productId, productId)).orderBy(asc(evalRuns.createdAt)),
    loadDomainKnowledge(product.domainId),
  ]);

  const impl = decision
    ? (
        await db
          .select()
          .from(implementations)
          .where(eq(implementations.decisionId, decision.decision.id))
          .orderBy(desc(implementations.createdAt))
          .limit(1)
      )[0]
    : undefined;

  const suiteNumber = new Map(suites.map((s, i) => [s.id, i + 1]));
  // The comparison to feature: the latest base-vs-head run for the chosen decision.
  const featured =
    [...runs].reverse().find((r) => r.head && decision && r.decisionId === decision.decision.id) ??
    [...runs].reverse().find((r) => r.head);
  const featuredSuite = featured ? suites.find((s) => s.id === featured.suiteId) : undefined;
  const baseline = runs.find((r) => !r.head);

  const refs: Record<string, { label: string; url?: string | null }> = {};
  for (const [key, ref] of Object.entries(knowledge.refs)) refs[key] = { label: ref.label, url: ref.url };

  return {
    product,
    decision: decision?.decision,
    roadmapTitle: decision?.roadmapTitle ?? null,
    implementation: impl,
    featured,
    featuredSuite,
    baseline,
    history: runs.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      suite: suiteNumber.get(r.suiteId) ?? 0,
      suiteFocus: suites.find((s) => s.id === r.suiteId)?.decisionId ? "decision" : "baseline",
      base: { ref: r.base.ref, commit: r.base.commit, rate: passRate(r.base) },
      head: r.head ? { ref: r.head.ref, commit: r.head.commit, rate: passRate(r.head) } : null,
      outcome: r.verdict.outcome,
    })),
    refs,
  };
}

export type VerificationReport = NonNullable<Awaited<ReturnType<typeof getVerificationReport>>>;
