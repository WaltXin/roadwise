// Imports AI-researched knowledge from a reviewed JSON file into a domain.
// Everything imported is marked origin = "ai" so the expert can verify it in the console.
// Idempotent and non-destructive: skips entries that already exist and never overwrites
// text an expert has written (evaluation priorities only get empty fields filled in).
//
// Usage: npm run db:import -- data/voice-ai/knowledge.json [--dry-run]

import { readFileSync } from "node:fs";

import { neon } from "@neondatabase/serverless";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { z } from "zod";

import { contextEntries, domains, evaluationPriorities, researchQuestions, sources } from "../src/db/schema";
import { CONTEXT_CATEGORY_VALUES, SOURCE_KIND_VALUES, SOURCE_TREATMENT_VALUES } from "../src/lib/knowledge/enums";

const text = z.string().trim().min(1);

const fileSchema = z.object({
  domain: text,
  researchedAt: text,
  sources: z.array(
    z.object({
      key: text,
      name: text,
      url: z.url(),
      kind: z.enum(SOURCE_KIND_VALUES),
      treatment: z.enum(SOURCE_TREATMENT_VALUES),
      notes: z.string().trim().optional(),
    }),
  ),
  context: z.array(
    z.object({
      category: z.enum(CONTEXT_CATEGORY_VALUES),
      title: text,
      description: z.string().trim().optional(),
      sourceKey: text.optional(),
    }),
  ),
  evaluation: z.array(
    z.object({
      name: text,
      description: z.string().trim().optional(),
      measure: z.string().trim().optional(),
      guardrail: z.string().trim().optional(),
    }),
  ),
  questions: z.array(
    z.object({
      question: text,
      rationale: z.string().trim().optional(),
      sourceKey: text.optional(),
    }),
  ),
});

const norm = (s: string) => s.trim().toLowerCase();

async function main() {
  const [path, ...flags] = process.argv.slice(2);
  if (!path) throw new Error("Usage: npm run db:import -- <file.json> [--dry-run]");
  const dryRun = flags.includes("--dry-run");

  const data = fileSchema.parse(JSON.parse(readFileSync(path, "utf8")));

  // Every sourceKey must resolve to a source in the file.
  const keys = new Set(data.sources.map((s) => s.key));
  if (keys.size !== data.sources.length) throw new Error("Duplicate source keys in file");
  for (const ref of [...data.context, ...data.questions]) {
    if (ref.sourceKey && !keys.has(ref.sourceKey)) throw new Error(`Unknown sourceKey: ${ref.sourceKey}`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = drizzle(neon(url));

  const [domain] = await db.select().from(domains).where(eq(domains.slug, data.domain)).limit(1);
  if (!domain) throw new Error(`Domain "${data.domain}" not found — run npm run db:seed first`);
  const domainId = domain.id;
  const stats = { sources: 0, context: 0, evaluationFilled: 0, evaluationAdded: 0, questions: 0, skipped: 0 };

  // Sources: match existing by URL (then name) so re-runs and expert-added sources are reused.
  const existingSources = await db.select().from(sources).where(eq(sources.domainId, domainId));
  const sourceIdByKey = new Map<string, string>();
  for (const s of data.sources) {
    const match = existingSources.find((e) => (e.url && e.url === s.url) || norm(e.name) === norm(s.name));
    if (match) {
      sourceIdByKey.set(s.key, match.id);
      stats.skipped++;
      continue;
    }
    stats.sources++;
    if (dryRun) {
      sourceIdByKey.set(s.key, "dry-run");
      continue;
    }
    const [row] = await db
      .insert(sources)
      .values({
        domainId,
        name: s.name,
        url: s.url,
        kind: s.kind,
        treatment: s.treatment,
        notes: s.notes || null,
        origin: "ai",
      })
      .returning({ id: sources.id });
    sourceIdByKey.set(s.key, row.id);
  }
  const sourceId = (key?: string) => {
    const id = key ? sourceIdByKey.get(key) : undefined;
    return id && id !== "dry-run" ? id : null;
  };

  // Industry context: skip titles that already exist in the domain.
  const existingContext = await db.select().from(contextEntries).where(eq(contextEntries.domainId, domainId));
  const contextTitles = new Set(existingContext.map((c) => norm(c.title)));
  for (const c of data.context) {
    if (contextTitles.has(norm(c.title))) {
      stats.skipped++;
      continue;
    }
    contextTitles.add(norm(c.title));
    stats.context++;
    if (!dryRun) {
      await db.insert(contextEntries).values({
        domainId,
        category: c.category,
        title: c.title,
        description: c.description || null,
        sourceId: sourceId(c.sourceKey),
        origin: "ai",
      });
    }
  }

  // Evaluation priorities: fill only empty fields of existing priorities; add new ones at the end.
  const existingEval = await db.select().from(evaluationPriorities).where(eq(evaluationPriorities.domainId, domainId));
  let nextRank = Math.max(0, ...existingEval.map((e) => e.rank ?? 0)) + 1;
  for (const e of data.evaluation) {
    const match = existingEval.find((x) => norm(x.name) === norm(e.name));
    if (!match) {
      stats.evaluationAdded++;
      if (!dryRun) {
        await db.insert(evaluationPriorities).values({
          domainId,
          name: e.name,
          rank: nextRank++,
          description: e.description || null,
          measure: e.measure || null,
          guardrail: e.guardrail || null,
          origin: "ai",
        });
      }
      continue;
    }
    const patch = Object.fromEntries(
      (["description", "measure", "guardrail"] as const)
        .filter((field) => !match[field] && e[field])
        .map((field) => [field, e[field]]),
    );
    if (Object.keys(patch).length === 0) {
      stats.skipped++;
      continue;
    }
    stats.evaluationFilled++;
    if (!dryRun) {
      await db
        .update(evaluationPriorities)
        .set({ ...patch, origin: "ai" })
        .where(and(eq(evaluationPriorities.id, match.id), eq(evaluationPriorities.domainId, domainId)));
    }
  }

  // Research questions: skip questions that already exist.
  const existingQuestions = await db.select().from(researchQuestions).where(eq(researchQuestions.domainId, domainId));
  const questionTexts = new Set(existingQuestions.map((q) => norm(q.question)));
  for (const q of data.questions) {
    if (questionTexts.has(norm(q.question))) {
      stats.skipped++;
      continue;
    }
    questionTexts.add(norm(q.question));
    stats.questions++;
    if (!dryRun) {
      await db.insert(researchQuestions).values({
        domainId,
        question: q.question,
        rationale: q.rationale || null,
        sourceId: sourceId(q.sourceKey),
        origin: "ai",
      });
    }
  }

  console.log(`${dryRun ? "[dry run] Would import" : "Imported"} into ${domain.name}:`, stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
