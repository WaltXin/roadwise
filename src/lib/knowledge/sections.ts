// Single source of truth for the four sections of a domain's knowledge base.
// Drives the expert console's forms, lists, and server-side validation.
// Client-safe: contains no database or server code.

import { CONTEXT_CATEGORIES, ORIGINS, QUESTION_STATUSES, SOURCE_KINDS, SOURCE_TREATMENTS } from "./enums";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
  badge?: "caution" | "hidden";
  /** For source references: where the source lives. */
  href?: string | null;
};

type BaseField = {
  name: string;
  label: string;
  help?: string;
  required?: boolean;
  /** Spans the full width of the form grid. */
  wide?: boolean;
};

export type FieldDef =
  | (BaseField & { kind: "text" | "url" | "textarea"; placeholder?: string })
  | (BaseField & { kind: "number"; placeholder?: string; min?: number })
  | (BaseField & { kind: "select"; options: readonly SelectOption[]; defaultValue?: string })
  /** Reference to one of this domain's sources (provenance). */
  | (BaseField & { kind: "source" });

export const SECTION_KEYS = ["sources", "context", "evaluation", "questions"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export type SectionDef = {
  key: SectionKey;
  title: string;
  singular: string;
  plural: string;
  /** One line on what this section is for. */
  description: string;
  /** Guidance shown to the expert while filling the section in. */
  guidance: string[];
  fields: FieldDef[];
  /** Field rendered as the entry's heading. */
  titleField: string;
  /** Long-form fields rendered under the heading, in order. */
  bodyFields: string[];
  /** Select fields rendered as badges. */
  badgeFields: string[];
  /** Group the list by this select field. */
  groupBy?: string;
};

/** Shared by every section: who put the entry here. */
const ORIGIN_FIELD: FieldDef = {
  name: "origin",
  label: "Provenance",
  kind: "select",
  options: ORIGINS,
  required: true,
  defaultValue: "expert",
  help: "After verifying an AI-researched entry, switch it to Expert-curated.",
};

export const SECTIONS: Record<SectionKey, SectionDef> = {
  sources: {
    key: "sources",
    title: "Sources",
    singular: "source",
    plural: "sources",
    description:
      "Where the consultant looks: key companies, technical blogs, researchers, events, and customer voices.",
    guidance: [
      "Prefer primary sources — changelogs and engineering posts over press coverage.",
      "Mark vendor claims and event presentations as research leads: the consultant investigates them rather than accepting them as fact.",
      "Use notes to say what this source is good for and what to be careful about.",
    ],
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, placeholder: "e.g. a vendor's engineering blog" },
      { name: "url", label: "URL", kind: "url", placeholder: "https://" },
      { name: "kind", label: "Type", kind: "select", options: SOURCE_KINDS, required: true },
      {
        name: "treatment",
        label: "Treat as",
        kind: "select",
        options: SOURCE_TREATMENTS,
        required: true,
        defaultValue: "evidence",
        help: "Leads are investigated, never accepted as fact on their own.",
      },
      {
        name: "notes",
        label: "Notes",
        kind: "textarea",
        wide: true,
        placeholder: "What is this source good for? What should the consultant watch out for?",
      },
      ORIGIN_FIELD,
    ],
    titleField: "name",
    bodyFields: ["notes"],
    badgeFields: ["kind", "treatment", "origin"],
  },

  context: {
    key: "context",
    title: "Industry context",
    singular: "context entry",
    plural: "context entries",
    description:
      "How the industry works: buyers, workflows, alternatives, purchasing criteria, and common failure modes.",
    guidance: [
      "Write what an experienced operator knows but a newcomer would miss.",
      "One idea per entry keeps it citable — the consultant references entries in its recommendations.",
      "Link a source when an entry rests on specific evidence.",
    ],
    fields: [
      { name: "category", label: "Category", kind: "select", options: CONTEXT_CATEGORIES, required: true },
      { name: "title", label: "Title", kind: "text", required: true, placeholder: "A short, specific statement" },
      {
        name: "description",
        label: "Details",
        kind: "textarea",
        wide: true,
        placeholder: "Explain it, with the nuance that matters when making product decisions.",
      },
      { name: "sourceId", label: "Supporting source", kind: "source" },
      ORIGIN_FIELD,
    ],
    titleField: "title",
    bodyFields: ["description"],
    badgeFields: ["origin"],
    groupBy: "category",
  },

  evaluation: {
    key: "evaluation",
    title: "Evaluation priorities",
    singular: "priority",
    plural: "priorities",
    description: "What “better” means in this domain, and the guardrails a change must not break.",
    guidance: [
      "Rank priorities so trade-offs are explicit: a faster call is only better if the task still gets done.",
      "Say how each priority is measured, so recommendations can be tested against it.",
      "Guardrails are conditions that must hold even when optimizing something else.",
    ],
    fields: [
      { name: "name", label: "Priority", kind: "text", required: true, placeholder: "e.g. Task completion" },
      { name: "rank", label: "Rank", kind: "number", min: 1, placeholder: "1 = most important" },
      {
        name: "description",
        label: "Why it matters",
        kind: "textarea",
        wide: true,
        placeholder: "What does this protect for the customer and their users?",
      },
      {
        name: "measure",
        label: "How it is measured",
        kind: "textarea",
        placeholder: "Metric, data source, and how to read it",
      },
      {
        name: "guardrail",
        label: "Guardrail",
        kind: "textarea",
        placeholder: "What must stay true when trading this off against other priorities",
      },
      { ...ORIGIN_FIELD, wide: true },
    ],
    titleField: "name",
    bodyFields: ["description", "measure", "guardrail"],
    badgeFields: ["origin"],
  },

  questions: {
    key: "questions",
    title: "Research questions",
    singular: "question",
    plural: "questions",
    description: "Open questions whose answers could materially change a customer's product or roadmap.",
    guidance: [
      "Good questions are specific enough that evidence could answer them.",
      "Explain the roadmap decision the answer would affect.",
      "Record the answer — and what it rests on — when a question is resolved.",
    ],
    fields: [
      {
        name: "question",
        label: "Question",
        kind: "textarea",
        required: true,
        wide: true,
        placeholder: "Which developments could materially affect a customer's roadmap?",
      },
      {
        name: "rationale",
        label: "Why it matters",
        kind: "textarea",
        wide: true,
        placeholder: "Which product decisions would change depending on the answer?",
      },
      {
        name: "status",
        label: "Status",
        kind: "select",
        options: QUESTION_STATUSES,
        required: true,
        defaultValue: "open",
      },
      ORIGIN_FIELD,
      {
        name: "answer",
        label: "Current answer",
        kind: "textarea",
        wide: true,
        placeholder: "What we know so far, and what it rests on. Leave empty if unresolved.",
      },
      {
        name: "sourceId",
        label: "Prompted by",
        kind: "source",
        help: "The development or source behind this question.",
      },
    ],
    titleField: "question",
    bodyFields: ["rationale", "answer"],
    badgeFields: ["status", "origin"],
  },
};

export function isSectionKey(value: string): value is SectionKey {
  return (SECTION_KEYS as readonly string[]).includes(value);
}

export function fieldLabel(section: SectionDef, name: string) {
  return section.fields.find((f) => f.name === name)?.label ?? name;
}

export function findOption(section: SectionDef, fieldName: string, value: string): SelectOption | undefined {
  const field = section.fields.find((f) => f.name === fieldName);
  if (field?.kind !== "select") return undefined;
  return field.options.find((o) => o.value === value);
}

export function optionLabel(section: SectionDef, fieldName: string, value: string) {
  return findOption(section, fieldName, value)?.label ?? value;
}

/** Plain, serializable shape of an entry as passed to client components. */
export type EntryValues = { id: string } & Record<string, string | number | null>;
