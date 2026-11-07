import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import {
  CONTEXT_CATEGORY_VALUES,
  QUESTION_STATUS_VALUES,
  SOURCE_KIND_VALUES,
  SOURCE_TREATMENT_VALUES,
} from "../lib/knowledge/enums";

export const sourceKind = pgEnum("source_kind", SOURCE_KIND_VALUES);
export const sourceTreatment = pgEnum("source_treatment", SOURCE_TREATMENT_VALUES);
export const contextCategory = pgEnum("context_category", CONTEXT_CATEGORY_VALUES);
export const questionStatus = pgEnum("question_status", QUESTION_STATUS_VALUES);

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
  ...timestamps,
});

export type Domain = typeof domains.$inferSelect;
