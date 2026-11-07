import "server-only";

import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { getDb } from "@/db";
import { contextEntries, evaluationPriorities, researchQuestions, sources, type KnowledgeRef } from "@/db/schema";
import { CONTEXT_CATEGORIES } from "@/lib/knowledge/enums";

const PREFIX = { sources: "S", context: "C", evaluation: "E", questions: "Q" } as const;

export type DomainKnowledge = {
  /** Compact text block for the system prompt; stable while the knowledge is unchanged (cache-friendly). */
  prompt: string;
  /** Short ref ("C12") → knowledge entry, for resolving citations in tool calls. */
  refs: Record<string, KnowledgeRef>;
  priorityNames: string[];
};

const one = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Cache tag for a domain's rendered knowledge; expire it when knowledge changes. */
export function knowledgeTag(domainId: string) {
  return `knowledge:${domainId}`;
}

/**
 * Loads a domain's whole knowledge base and renders it with short, citable refs.
 * Cached: expert edits expire it via knowledgeTag; script imports show up within minutes.
 */
export async function loadDomainKnowledge(domainId: string): Promise<DomainKnowledge> {
  "use cache";
  cacheTag(knowledgeTag(domainId));
  cacheLife("minutes");

  const db = getDb();
  const [srcRows, ctxRows, evalRows, qRows] = await Promise.all([
    db.select().from(sources).where(eq(sources.domainId, domainId)).orderBy(asc(sources.createdAt), asc(sources.id)),
    db
      .select()
      .from(contextEntries)
      .where(eq(contextEntries.domainId, domainId))
      .orderBy(asc(contextEntries.createdAt), asc(contextEntries.id)),
    db
      .select()
      .from(evaluationPriorities)
      .where(eq(evaluationPriorities.domainId, domainId))
      .orderBy(asc(evaluationPriorities.rank), asc(evaluationPriorities.createdAt)),
    db
      .select()
      .from(researchQuestions)
      .where(eq(researchQuestions.domainId, domainId))
      .orderBy(asc(researchQuestions.createdAt), asc(researchQuestions.id)),
  ]);

  const refs: Record<string, KnowledgeRef> = {};
  const sourceRef = new Map<string, string>();
  const review = (origin: string) => (origin === "ai" ? " [unreviewed]" : "");
  const lines: string[] = [];

  lines.push("## Sources");
  srcRows.forEach((s, i) => {
    const ref = `${PREFIX.sources}${i + 1}`;
    refs[ref] = { section: "sources", id: s.id, label: s.name, url: s.url };
    sourceRef.set(s.id, ref);
    lines.push(`[${ref}] ${s.name} (${s.kind}; treat as ${s.treatment})${review(s.origin)} — ${one(s.notes)}`);
  });

  const cite = (sourceId: string | null) =>
    sourceId && sourceRef.get(sourceId) ? ` (source ${sourceRef.get(sourceId)})` : "";

  lines.push("", "## Industry context");
  let contextIndex = 0;
  for (const category of CONTEXT_CATEGORIES) {
    const rows = ctxRows.filter((c) => c.category === category.value);
    if (rows.length === 0) continue;
    lines.push(`### ${category.label}`);
    for (const c of rows) {
      const ref = `${PREFIX.context}${++contextIndex}`;
      refs[ref] = { section: "context", id: c.id, label: c.title };
      lines.push(`[${ref}] ${c.title}${review(c.origin)} — ${one(c.description)}${cite(c.sourceId)}`);
    }
  }

  lines.push("", "## Evaluation priorities (ranked)");
  evalRows.forEach((e, i) => {
    const ref = `${PREFIX.evaluation}${i + 1}`;
    refs[ref] = { section: "evaluation", id: e.id, label: e.name };
    lines.push(
      `[${ref}] ${e.rank ?? "-"}. ${e.name}${review(e.origin)} — Why: ${one(e.description)} Measure: ${one(e.measure)} Guardrail: ${one(e.guardrail)}`,
    );
  });

  lines.push("", "## Research questions");
  qRows.forEach((q, i) => {
    const ref = `${PREFIX.questions}${i + 1}`;
    refs[ref] = { section: "questions", id: q.id, label: q.question };
    lines.push(`[${ref}] (${q.status})${review(q.origin)} ${one(q.question)} — ${one(q.rationale)}${cite(q.sourceId)}`);
  });

  return { prompt: lines.join("\n"), refs, priorityNames: evalRows.map((e) => e.name) };
}

/** Resolves model-supplied refs ("C12", "[S3]") to knowledge entries, dropping unknown ones. */
export function resolveRefs(knowledge: DomainKnowledge, raw: string[]): KnowledgeRef[] {
  const seen = new Set<string>();
  const out: KnowledgeRef[] = [];
  for (const r of raw) {
    const key = r.replace(/[[\]\s]/g, "").toUpperCase();
    const ref = knowledge.refs[key];
    if (ref && !seen.has(ref.id)) {
      seen.add(ref.id);
      out.push(ref);
    }
  }
  return out;
}
