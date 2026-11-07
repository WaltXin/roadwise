import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { asc, desc, eq } from "drizzle-orm";
import { connection } from "next/server";

import { getDb } from "@/db";
import {
  decisions,
  domains,
  implementations,
  onboardingMessages,
  productInputs,
  products,
  roadmapItems,
} from "@/db/schema";

import { loadDomainKnowledge } from "./knowledge-context";

export async function listProducts() {
  await connection();
  return getDb()
    .select({
      id: products.id,
      name: products.name,
      summary: products.summary,
      updatedAt: products.updatedAt,
      domainName: domains.name,
    })
    .from(products)
    .innerJoin(domains, eq(domains.id, products.domainId))
    .orderBy(desc(products.updatedAt));
}

export async function listDomainOptions() {
  await connection();
  return getDb().select({ id: domains.id, name: domains.name }).from(domains).orderBy(asc(domains.name));
}

/** What the chat panel shows for one stored turn. */
export type ChatItem =
  | { id: string; type: "kickoff"; text: string }
  | { id: string; type: "user"; text: string }
  | { id: string; type: "note"; text: string }
  | { id: string; type: "assistant"; text: string; actions: string[]; refused: boolean };

type Block = Anthropic.Beta.BetaContentBlock;

function describeToolUse(block: Anthropic.Beta.BetaToolUseBlock): string {
  const input = (block.input ?? {}) as Record<string, unknown>;
  const name = typeof input.title === "string" ? input.title : typeof input.field === "string" ? input.field : "";
  switch (block.name) {
    case "update_profile":
      return `Updated profile · ${name}`;
    case "save_roadmap_item":
      return `${input.id ? "Updated" : "Added"} roadmap hypothesis · ${name}`;
    case "propose_decision":
      return `Proposed decision · ${name}`;
    default:
      return block.name;
  }
}

function toChatItems(rows: { id: string; kind: string; content: unknown }[]): ChatItem[] {
  const items: ChatItem[] = [];
  for (const row of rows) {
    if (row.kind === "tool_result") continue;
    if (row.kind !== "reply") {
      const text = typeof row.content === "string" ? row.content : "";
      const type = row.kind === "kickoff" ? "kickoff" : row.kind === "note" ? "note" : "user";
      items.push({ id: row.id, type, text });
      continue;
    }
    const blocks = (Array.isArray(row.content) ? row.content : []) as Block[];
    const text = blocks
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n\n")
      .trim();
    const actions = blocks
      .filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use")
      .map(describeToolUse);
    // Consecutive Roadwise turns within one response (tool loop) read as one message.
    const prev = items.at(-1);
    if (prev?.type === "assistant") {
      prev.text = [prev.text, text].filter(Boolean).join("\n\n");
      prev.actions.push(...actions);
      continue;
    }
    items.push({ id: row.id, type: "assistant", text, actions, refused: false });
  }
  for (const item of items) {
    if (item.type === "assistant" && !item.text && item.actions.length === 0) item.refused = true;
  }
  return items;
}

export async function getWorkspace(productId: string) {
  await connection();
  const db = getDb();
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      summary: products.summary,
      repoUrl: products.repoUrl,
      profile: products.profile,
      domainId: products.domainId,
      domainName: domains.name,
    })
    .from(products)
    .innerJoin(domains, eq(domains.id, products.domainId))
    .where(eq(products.id, productId));
  if (!product) return null;

  const [inputs, items, decisionRows, messageRows, knowledge, implementationRows] = await Promise.all([
    db
      .select({ id: productInputs.id, kind: productInputs.kind, title: productInputs.title })
      .from(productInputs)
      .where(eq(productInputs.productId, productId))
      .orderBy(asc(productInputs.createdAt)),
    db.select().from(roadmapItems).where(eq(roadmapItems.productId, productId)).orderBy(asc(roadmapItems.createdAt)),
    db.select().from(decisions).where(eq(decisions.productId, productId)).orderBy(asc(decisions.createdAt)),
    db
      .select({ id: onboardingMessages.id, kind: onboardingMessages.kind, content: onboardingMessages.content })
      .from(onboardingMessages)
      .where(eq(onboardingMessages.productId, productId))
      .orderBy(asc(onboardingMessages.seq)),
    loadDomainKnowledge(product.domainId),
    db
      .select()
      .from(implementations)
      .where(eq(implementations.productId, productId))
      .orderBy(asc(implementations.createdAt)),
  ]);

  const chat = toChatItems(messageRows);

  // Only the refs cited in the conversation and panels, for rendering citation chips.
  const texts = [
    ...chat.map((c) => (c.type === "assistant" ? c.text : "")),
    ...items.flatMap((i) => [i.hypothesis, i.evidence ?? ""]),
    ...decisionRows.flatMap((d) => [
      d.observed,
      d.whyItMatters,
      d.recommendation,
      d.howToTest,
      d.acceptanceCriteria,
      d.wouldChangeConclusion,
    ]),
  ];
  const used = new Set(texts.flatMap((t) => t.match(/\[[SCEQ]\d+\]/g) ?? []));
  const refs: Record<string, { label: string; url?: string | null }> = {};
  for (const token of used) {
    const key = token.slice(1, -1);
    const ref = knowledge.refs[key];
    if (ref) refs[key] = { label: ref.label, url: ref.url };
  }

  return { product, inputs, roadmap: items, decisions: decisionRows, implementations: implementationRows, chat, refs };
}

export type Workspace = NonNullable<Awaited<ReturnType<typeof getWorkspace>>>;
