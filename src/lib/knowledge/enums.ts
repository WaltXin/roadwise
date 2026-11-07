// Shared option lists for the domain knowledge base.
// Used by the database schema (pgEnum values), validation, and the UI.

type Option<V extends string> = { value: V; label: string; hint: string };

function values<V extends string>(options: readonly Option<V>[]) {
  return options.map((o) => o.value) as [V, ...V[]];
}

export const SOURCE_KINDS = [
  { value: "company", label: "Company", hint: "Vendor announcements, changelogs, docs" },
  { value: "technical_blog", label: "Technical blog", hint: "Engineering write-ups and deep dives" },
  { value: "researcher", label: "Researcher", hint: "People whose work shapes the field" },
  { value: "research_paper", label: "Research paper", hint: "Papers, benchmarks, preprints" },
  { value: "event", label: "Industry event", hint: "Conferences, talks, demos" },
  { value: "customer", label: "Customer perspective", hint: "Reviews, forums, interviews" },
  { value: "community", label: "Community", hint: "Discords, newsletters, podcasts" },
  { value: "other", label: "Other", hint: "Anything else worth watching" },
] as const satisfies readonly Option<string>[];
export const SOURCE_KIND_VALUES = values(SOURCE_KINDS);

export const SOURCE_TREATMENTS = [
  {
    value: "evidence",
    label: "Evidence",
    hint: "Reliable enough to support conclusions",
  },
  {
    value: "lead",
    label: "Research lead",
    hint: "Claims to investigate — never accepted as fact on their own",
  },
] as const satisfies readonly Option<string>[];
export const SOURCE_TREATMENT_VALUES = values(SOURCE_TREATMENTS);

export const CONTEXT_CATEGORIES = [
  { value: "buyer", label: "Buyers", hint: "Who purchases, who uses, and what they are accountable for" },
  { value: "workflow", label: "Workflows", hint: "The jobs the product is deployed into, end to end" },
  { value: "alternative", label: "Alternatives", hint: "What customers would use instead, including doing nothing" },
  {
    value: "purchasing_criterion",
    label: "Purchasing criteria",
    hint: "What decides whether a buyer chooses, keeps, or churns",
  },
  { value: "failure_mode", label: "Failure modes", hint: "How products in this space commonly break" },
] as const satisfies readonly Option<string>[];
export const CONTEXT_CATEGORY_VALUES = values(CONTEXT_CATEGORIES);

export const QUESTION_STATUSES = [
  { value: "open", label: "Open", hint: "Not yet investigated" },
  { value: "investigating", label: "Investigating", hint: "Research in progress" },
  { value: "answered", label: "Answered", hint: "Resolved with evidence" },
  { value: "parked", label: "Parked", hint: "Deliberately set aside" },
] as const satisfies readonly Option<string>[];
export const QUESTION_STATUS_VALUES = values(QUESTION_STATUSES);
