import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import { domains, sources } from "@/db/schema";

import { SECTION_KEYS, type EntryValues, type SectionKey } from "./sections";
import { tableFor } from "./server";

export type SectionCounts = Record<SectionKey, number>;

function emptyCounts(): SectionCounts {
  return { sources: 0, context: 0, evaluation: 0, questions: 0 };
}

/** Dates become ISO strings so rows can be passed to client components. */
function toEntry(row: Record<string, unknown>): EntryValues {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (v as string | number | null)]),
  ) as EntryValues;
}

export async function listDomains() {
  await connection();
  const db = getDb();

  const [rows, ...countRows] = await Promise.all([
    db.select().from(domains).orderBy(asc(domains.name)),
    ...SECTION_KEYS.map((key) => {
      const t = tableFor(key);
      return db.select({ domainId: t.domainId, n: count() }).from(t).groupBy(t.domainId);
    }),
  ]);

  return rows.map((domain) => {
    const counts = emptyCounts();
    SECTION_KEYS.forEach((key, i) => {
      counts[key] = countRows[i].find((r) => r.domainId === domain.id)?.n ?? 0;
    });
    return { ...domain, counts };
  });
}

export async function getDomain(slug: string) {
  await connection();
  const [domain] = await getDb().select().from(domains).where(eq(domains.slug, slug)).limit(1);
  return domain ?? null;
}

export async function getSectionCounts(
  domainId: string,
  { needsReview = false }: { needsReview?: boolean } = {},
): Promise<SectionCounts> {
  await connection();
  const db = getDb();
  const results = await Promise.all(
    SECTION_KEYS.map((key) => {
      const t = tableFor(key);
      const where = needsReview ? and(eq(t.domainId, domainId), eq(t.origin, "ai")) : eq(t.domainId, domainId);
      return db.select({ n: count() }).from(t).where(where);
    }),
  );
  const counts = emptyCounts();
  SECTION_KEYS.forEach((key, i) => (counts[key] = results[i][0]?.n ?? 0));
  return counts;
}

const ORDER: Record<SectionKey, string[]> = {
  sources: ["kind", "name"],
  context: ["category", "created_at"],
  evaluation: ["rank", "created_at"],
  questions: ["created_at"],
};

export async function getSectionEntries(domainId: string, key: SectionKey): Promise<EntryValues[]> {
  await connection();
  const t = tableFor(key);
  const orderBy = ORDER[key].map((col) => sql`${sql.identifier(col)} asc nulls last`);
  const rows = await getDb()
    .select()
    .from(t)
    .where(eq(t.domainId, domainId))
    .orderBy(...orderBy);
  return rows.map((r) => toEntry(r));
}

export async function getSourceOptions(domainId: string) {
  await connection();
  const rows = await getDb()
    .select({ id: sources.id, name: sources.name, url: sources.url })
    .from(sources)
    .where(eq(sources.domainId, domainId))
    .orderBy(asc(sources.name));
  return rows.map((r) => ({ value: r.id, label: r.name, href: r.url }));
}
