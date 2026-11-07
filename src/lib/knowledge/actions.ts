"use server";

import { and, eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { domains, sources } from "@/db/schema";
import { requireExpert } from "@/lib/auth/server";
import { knowledgeTag } from "@/lib/onboarding/knowledge-context";

import { isSectionKey, SECTIONS } from "./sections";
import { parseEntry, tableFor } from "./server";

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values, so a failed form can be re-filled. */
  values?: Record<string, string>;
  /** Changes on every submission; used to reset/close forms. */
  submittedAt?: number;
};

const uuid = z.uuid();

function submitted(formData: FormData) {
  const values: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (!k.startsWith("$") && typeof v === "string") values[k] = v;
  });
  return values;
}

function fail(formData: FormData, message: string, fieldErrors?: Record<string, string>): FormState {
  return { status: "error", message, fieldErrors, values: submitted(formData), submittedAt: Date.now() };
}

/** Create (no `_id`) or update (with `_id`) an entry in one of the knowledge sections. */
export async function saveEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireExpert();

  const sectionKey = String(formData.get("_section") ?? "");
  const domainId = String(formData.get("_domainId") ?? "");
  const id = String(formData.get("_id") ?? "");

  if (!isSectionKey(sectionKey) || !uuid.safeParse(domainId).success || (id && !uuid.safeParse(id).success)) {
    return fail(formData, "This form is out of date. Reload the page and try again.");
  }

  const section = SECTIONS[sectionKey];
  const parsed = parseEntry(section, formData);
  if (!parsed.ok) return fail(formData, "Please fix the highlighted fields.", parsed.fieldErrors);

  const db = getDb();

  // A referenced source must belong to the same domain.
  for (const field of section.fields) {
    const value = parsed.data[field.name];
    if (field.kind !== "source" || typeof value !== "string") continue;
    const [match] = await db
      .select({ id: sources.id })
      .from(sources)
      .where(and(eq(sources.id, value), eq(sources.domainId, domainId)))
      .limit(1);
    if (!match)
      return fail(formData, "Please fix the highlighted fields.", { [field.name]: "Choose a source from the list" });
  }

  const table = tableFor(sectionKey);
  // Values are validated against the section's own fields; see KnowledgeTable.
  const data = parsed.data as never;

  if (id) {
    const updated = await db
      .update(table)
      .set(data)
      .where(and(eq(table.id, id), eq(table.domainId, domainId)))
      .returning({ id: table.id });
    if (updated.length === 0) return fail(formData, "This entry no longer exists.");
  } else {
    await db.insert(table).values({ ...(data as object), domainId } as never);
  }

  updateTag(knowledgeTag(domainId));
  refresh();
  return { status: "success", submittedAt: Date.now() };
}

export async function deleteEntry(formData: FormData) {
  await requireExpert();

  const sectionKey = String(formData.get("_section") ?? "");
  const domainId = String(formData.get("_domainId") ?? "");
  const id = String(formData.get("_id") ?? "");
  if (!isSectionKey(sectionKey) || !uuid.safeParse(domainId).success || !uuid.safeParse(id).success) return;

  const table = tableFor(sectionKey);
  await getDb()
    .delete(table)
    .where(and(eq(table.id, id), eq(table.domainId, domainId)));
  updateTag(knowledgeTag(domainId));
  refresh();
}

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and dashes")
  .max(60, "Keep it under 60 characters");

const domainSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  summary: z.string().trim().max(2000, "Summary is too long"),
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function fieldErrorsOf(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "_form")] ??= issue.message;
  return out;
}

export async function createDomain(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireExpert();

  const parsed = domainSchema.safeParse({
    name: formData.get("name") ?? "",
    summary: formData.get("summary") ?? "",
  });
  if (!parsed.success) return fail(formData, "Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  const rawSlug = String(formData.get("slug") ?? "").trim() || slugify(parsed.data.name);
  const slug = slugSchema.safeParse(rawSlug);
  if (!slug.success)
    return fail(formData, "Please fix the highlighted fields.", { slug: slug.error.issues[0].message });

  const [created] = await getDb()
    .insert(domains)
    .values({ ...parsed.data, slug: slug.data })
    .onConflictDoNothing({ target: domains.slug })
    .returning({ slug: domains.slug });
  if (!created)
    return fail(formData, "Please fix the highlighted fields.", { slug: "A domain with this URL already exists" });

  redirect(`/expert/${created.slug}`);
}

export async function updateDomain(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireExpert();

  const id = String(formData.get("_id") ?? "");
  if (!uuid.safeParse(id).success) return fail(formData, "This form is out of date. Reload the page and try again.");

  const parsed = domainSchema.safeParse({
    name: formData.get("name") ?? "",
    summary: formData.get("summary") ?? "",
  });
  if (!parsed.success) return fail(formData, "Please fix the highlighted fields.", fieldErrorsOf(parsed.error));

  await getDb().update(domains).set(parsed.data).where(eq(domains.id, id));
  refresh();
  return { status: "success", message: "Saved", submittedAt: Date.now() };
}
