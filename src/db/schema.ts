import { integer, json, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import {
  CONTEXT_CATEGORY_VALUES,
  ORIGIN_VALUES,
  QUESTION_STATUS_VALUES,
  SOURCE_KIND_VALUES,
  SOURCE_TREATMENT_VALUES,
} from "../lib/knowledge/enums";

export const sourceKind = pgEnum("source_kind", SOURCE_KIND_VALUES);
export const sourceTreatment = pgEnum("source_treatment", SOURCE_TREATMENT_VALUES);
export const contextCategory = pgEnum("context_category", CONTEXT_CATEGORY_VALUES);
export const questionStatus = pgEnum("question_status", QUESTION_STATUS_VALUES);
export const entryOrigin = pgEnum("entry_origin", ORIGIN_VALUES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** An industry the consultant covers (e.g. Voice AI). Curated by a domain expert. */
export const domains = pgTable("domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  ...timestamps,
});

/** Expert-curated vs AI-researched (awaiting expert review). */
const origin = () => entryOrigin("origin").notNull().default("expert");

const domainId = () =>
  uuid("domain_id")
    .notNull()
    .references(() => domains.id, { onDelete: "cascade" });

/** Where the consultant looks: companies, blogs, researchers, events, customer voices. */
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: domainId(),
  name: text("name").notNull(),
  kind: sourceKind("kind").notNull(),
  treatment: sourceTreatment("treatment").notNull().default("evidence"),
  url: text("url"),
  notes: text("notes"),
  origin: origin(),
  ...timestamps,
});

/** How the industry works: buyers, workflows, alternatives, purchasing criteria, failure modes. */
export const contextEntries = pgTable("context_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: domainId(),
  category: contextCategory("category").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
  origin: origin(),
  ...timestamps,
});

/** What "better" means in this domain: task completion, latency, cost, ... */
export const evaluationPriorities = pgTable("evaluation_priorities", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: domainId(),
  name: text("name").notNull(),
  description: text("description"),
  measure: text("measure"),
  guardrail: text("guardrail"),
  rank: integer("rank"),
  origin: origin(),
  ...timestamps,
});

/** Questions that, once answered, could materially change a customer's roadmap. */
export const researchQuestions = pgTable("research_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: domainId(),
  question: text("question").notNull(),
  rationale: text("rationale"),
  status: questionStatus("status").notNull().default("open"),
  answer: text("answer"),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "set null" }),
  origin: origin(),
  ...timestamps,
});

export type Domain = typeof domains.$inferSelect;

// ---------------------------------------------------------------------------
// Product onboarding: a customer's product, what Roadwise has learned about it,
// its roadmap as hypotheses, and candidate decisions. Domain-agnostic.
// ---------------------------------------------------------------------------

export const productInputKind = pgEnum("product_input_kind", ["roadmap", "code", "evidence", "other"]);
export const evidenceStatus = pgEnum("evidence_status", ["supported", "contradicted", "unknown"]);
export const roadmapOrigin = pgEnum("roadmap_origin", ["founder", "roadwise"]);
export const roadmapStatus = pgEnum("roadmap_status", ["proposed", "kept", "dropped"]);
export const decisionStatus = pgEnum("decision_status", ["candidate", "selected", "dismissed"]);
export const level = pgEnum("level", ["high", "medium", "low"]);

/** One value Roadwise has learned about a product, and how it knows it. */
export type ProfileValue = {
  value: string;
  /** stated = founder said it; inferred = Roadwise's reading; confirmed = founder edited it in the panel. */
  basis: "stated" | "inferred" | "confirmed";
  updatedAt: string;
};

/** A link from a roadmap item or decision to a knowledge entry. */
export type KnowledgeRef = {
  section: "sources" | "context" | "evaluation" | "questions";
  id: string;
  label: string;
  url?: string | null;
};

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  domainId: uuid("domain_id")
    .notNull()
    .references(() => domains.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  repoUrl: text("repo_url"),
  /** Which eval connector can run this product's harness (see src/lib/evals/connectors.ts). */
  evalConnector: text("eval_connector"),
  profile: jsonb("profile").$type<Record<string, ProfileValue>>().notNull().default({}),
  ...timestamps,
});

const productId = () =>
  uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" });

/** Material the founder shared at the start: roadmap, code/config, evidence. */
export const productInputs = pgTable("product_inputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: productId(),
  kind: productInputKind("kind").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  ...timestamps,
});

/** A roadmap item rewritten as a testable hypothesis, with its evidence status. */
export const roadmapItems = pgTable("roadmap_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: productId(),
  title: text("title").notNull(),
  hypothesis: text("hypothesis").notNull(),
  origin: roadmapOrigin("origin").notNull(),
  evidenceStatus: evidenceStatus("evidence_status").notNull().default("unknown"),
  evidence: text("evidence"),
  priorities: jsonb("priorities").$type<string[]>().notNull().default([]),
  refs: jsonb("refs").$type<KnowledgeRef[]>().notNull().default([]),
  status: roadmapStatus("status").notNull().default("proposed"),
  ...timestamps,
});

/** A consequential decision, recorded as the full chain the one-pager requires. */
export const decisions = pgTable("decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: productId(),
  roadmapItemId: uuid("roadmap_item_id").references(() => roadmapItems.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  observed: text("observed").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  recommendation: text("recommendation").notNull(),
  howToTest: text("how_to_test").notNull(),
  acceptanceCriteria: text("acceptance_criteria").notNull(),
  wouldChangeConclusion: text("would_change_conclusion").notNull(),
  impact: level("impact").notNull(),
  uncertainty: level("uncertainty").notNull(),
  costToTest: level("cost_to_test").notNull(),
  refs: jsonb("refs").$type<KnowledgeRef[]>().notNull().default([]),
  status: decisionStatus("status").notNull().default("candidate"),
  ...timestamps,
});

/**
 * A coding agent's report (via the Roadwise MCP server) that it implemented a chosen decision.
 * Append-only: a decision can collect several reports (e.g. a follow-up fix). Implemented is
 * not the end of the loop — the change still has to pass the decision's acceptance criteria.
 */
export const implementations = pgTable("implementations", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: productId(),
  decisionId: uuid("decision_id")
    .notNull()
    .references(() => decisions.id, { onDelete: "cascade" }),
  summary: text("summary").notNull(),
  prUrl: text("pr_url"),
  branch: text("branch"),
  commitSha: text("commit_sha"),
  filesChanged: jsonb("files_changed").$type<string[]>().notNull().default([]),
  /** What the agent ran or checked to verify the change, in its own words. */
  verification: text("verification"),
  /** The MCP client that reported it, e.g. "claude-code 2.1". */
  reportedBy: text("reported_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One check the runner applies to a scenario run. */
export type EvalCheck =
  | { type: "tool_called" | "tool_not_called"; tool: string }
  | { type: "tool_arg_equals"; tool: string; arg: string; value: string }
  | { type: "judge"; intent: string };

/** A canned tool reply; `require` makes the mock reject calls missing an argument. */
export type EvalMock = {
  returns?: string;
  raises?: string;
  require?: { arg: string; contains: string; error: string };
};

/** A scenario Roadwise wrote from domain knowledge + the product's profile. Data, not code. */
export type EvalScenario = {
  id: string;
  title: string;
  /** Why this scenario matters for this product, citing knowledge refs like [C29]. */
  rationale: string;
  /** What it measures: an evaluation priority or a decision's acceptance criterion. */
  measures: string;
  refs: string[];
  settings: Record<string, string | boolean>;
  mocks: Record<string, EvalMock>;
  turns: string[];
  checks: EvalCheck[];
};

/**
 * A generated evaluation suite for one product (optionally for one decision). Scenarios are
 * held out: they are never exposed to the coding agent that implements a change.
 */
export const evalSuites = pgTable("eval_suites", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: productId(),
  decisionId: uuid("decision_id").references(() => decisions.id, { onDelete: "set null" }),
  /** The product connector that can run it, e.g. "orangechat-livekit-text". */
  connector: text("connector").notNull(),
  summary: text("summary").notNull(),
  scenarios: jsonb("scenarios").$type<EvalScenario[]>().notNull(),
  /** Criteria this harness can't check (e.g. audio timing), kept explicitly unresolved. */
  unresolved: jsonb("unresolved").$type<{ criterion: string; reason: string }[]>().notNull().default([]),
  refs: jsonb("refs").$type<KnowledgeRef[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EvalRunResult = {
  scenario: string;
  run: number;
  passed: boolean;
  checks: (EvalCheck & { passed: boolean; reason: string })[];
  error: string | null;
  transcript: { role: string; text?: string; tool?: string; args?: unknown }[];
  seconds: number;
};

export type EvalSide = { ref: string; commit: string; runs: number; results: EvalRunResult[] };

export type EvalVerdict = {
  /** merge / do_not_merge / inconclusive for a comparison; baseline for a single run. */
  outcome: "merge" | "do_not_merge" | "inconclusive" | "baseline";
  summary: string;
  scenarios: {
    id: string;
    finding: string;
    status: "improved" | "regressed" | "unchanged" | "pass" | "fail" | "flaky";
  }[];
};

/** One verifier run: the suite on a base ref (and optionally a head ref), plus the verdict. */
export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: productId(),
  suiteId: uuid("suite_id")
    .notNull()
    .references(() => evalSuites.id, { onDelete: "cascade" }),
  decisionId: uuid("decision_id").references(() => decisions.id, { onDelete: "set null" }),
  base: jsonb("base").$type<EvalSide>().notNull(),
  head: jsonb("head").$type<EvalSide>(),
  verdict: jsonb("verdict").$type<EvalVerdict>().notNull(),
  /** Model that wrote the verdict. */
  judge: text("judge").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The onboarding conversation, stored as the exact Messages API turns (append-only),
 * so it can be replayed to the model unchanged — including thinking and tool blocks.
 */
export const onboardingMessages = pgTable(
  "onboarding_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: productId(),
    seq: integer("seq").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    /** kickoff = shared material; chat = founder message; note = panel edit; tool_result = tool outputs; reply = Roadwise turn. */
    kind: text("kind", { enum: ["kickoff", "chat", "note", "tool_result", "reply"] }).notNull(),
    // json (not jsonb) keeps the stored turn byte-identical, so replays stay cache-friendly.
    content: json("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("onboarding_messages_product_seq").on(t.productId, t.seq)],
);

export type Product = typeof products.$inferSelect;
export type RoadmapItem = typeof roadmapItems.$inferSelect;
export type Decision = typeof decisions.$inferSelect;
export type Implementation = typeof implementations.$inferSelect;
export type EvalSuite = typeof evalSuites.$inferSelect;
export type EvalRun = typeof evalRuns.$inferSelect;
