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
