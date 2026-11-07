import "server-only";

import { z } from "zod";

import { contextEntries, evaluationPriorities, researchQuestions, sources } from "@/db/schema";

import type { FieldDef, SectionDef, SectionKey } from "./sections";

const SECTION_TABLES = {
  sources,
  context: contextEntries,
  evaluation: evaluationPriorities,
  questions: researchQuestions,
} as const;

/**
 * All section tables share `id`, `domainId`, and timestamp columns. Drizzle's builders
 * don't accept a union of tables, so generic CRUD code treats them through one
 * representative table type. Column-specific values are validated by `parseEntry`.
 */
export type KnowledgeTable = typeof sources;

export function tableFor(key: SectionKey): KnowledgeTable {
  return SECTION_TABLES[key] as unknown as KnowledgeTable;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const nullIfEmpty = (v: string) => (v === "" ? null : v);

function fieldSchema(field: FieldDef): z.ZodType {
  const required = (s: z.ZodString) => s.min(1, `${field.label} is required`);

  switch (field.kind) {
    case "text":
    case "textarea": {
      const base = z
        .string()
        .trim()
        .max(field.kind === "text" ? 300 : 5000, `${field.label} is too long`);
      return field.required ? required(base) : base.transform(nullIfEmpty);
    }
    case "url": {
      const base = z.string().trim().max(2000, "URL is too long");
      const checked = (field.required ? required(base) : base).refine(
        (v) => v === "" || isHttpUrl(v),
        "Enter a full URL starting with https://",
      );
      return checked.transform(nullIfEmpty);
    }
    case "number": {
      const base = z
        .string()
        .trim()
        .refine((v) => v === "" || /^\d{1,6}$/.test(v), "Enter a whole number")
        .refine((v) => v === "" || field.min === undefined || Number(v) >= field.min, `Must be at least ${field.min}`);
      return (field.required ? base.refine((v) => v !== "", `${field.label} is required`) : base).transform((v) =>
        v === "" ? null : Number(v),
      );
    }
    case "select": {
      const values = field.options.map((o) => o.value) as [string, ...string[]];
      const choice = z.enum(values, { error: `Choose a ${field.label.toLowerCase()}` });
      return field.required ? choice : z.union([z.literal(""), choice]).transform(nullIfEmpty);
    }
    case "source":
      return z
        .string()
        .trim()
        .refine((v) => v === "" || z.uuid().safeParse(v).success, "Choose a source from the list")
        .transform(nullIfEmpty);
  }
}

export type ParseResult =
  { ok: true; data: Record<string, string | number | null> } | { ok: false; fieldErrors: Record<string, string> };

/** Validates a submitted form against the section's field definitions. */
export function parseEntry(section: SectionDef, formData: FormData): ParseResult {
  const shape = Object.fromEntries(section.fields.map((f) => [f.name, fieldSchema(f)]));
  const raw = Object.fromEntries(section.fields.map((f) => [f.name, String(formData.get(f.name) ?? "")]));
  const result = z.object(shape).safeParse(raw);

  if (result.success) {
    return { ok: true, data: result.data as Record<string, string | number | null> };
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_form");
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}
