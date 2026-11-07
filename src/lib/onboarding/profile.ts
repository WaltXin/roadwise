// What Roadwise needs to understand about a product before it can recommend anything.
// Domain-agnostic; the domain's knowledge base decides which questions get asked.
// Client-safe.

export const PROFILE_FIELDS = [
  { key: "product", label: "What it does", hint: "The product in a sentence or two" },
  { key: "users", label: "Users and buyers", hint: "Who uses it, who pays, what they're accountable for" },
  { key: "journeys", label: "Key journeys", hint: "The end-to-end jobs users rely on it for" },
  { key: "stack", label: "How it's built", hint: "Architecture, providers, integrations" },
  { key: "goals", label: "Goals, ranked", hint: "What 'better' means for this product right now" },
  { key: "constraints", label: "Constraints", hint: "Compliance, budget, team, deadlines" },
  { key: "measurement", label: "How quality is measured", hint: "Evals, metrics, reviews in place today" },
  { key: "evidence", label: "Evidence available", hint: "Recordings, transcripts, test results, analytics" },
  { key: "known_issues", label: "Known problems", hint: "What users or the team already complain about" },
] as const;

export type ProfileKey = (typeof PROFILE_FIELDS)[number]["key"];

export const PROFILE_KEYS = PROFILE_FIELDS.map((f) => f.key) as [ProfileKey, ...ProfileKey[]];

export function profileLabel(key: string) {
  return PROFILE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

export const BASIS_LABELS = {
  stated: "Founder said",
  inferred: "Roadwise inferred",
  confirmed: "Founder confirmed",
} as const;

export const EVIDENCE_LABELS = {
  supported: "Supported",
  contradicted: "Contradicted",
  unknown: "Unknown",
} as const;

export const INPUT_KIND_LABELS = {
  roadmap: "Roadmap",
  code: "Code or config",
  evidence: "Evidence",
  other: "Other",
} as const;
