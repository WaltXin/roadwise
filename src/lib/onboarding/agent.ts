import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { and, asc, count, eq, max } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { decisions, domains, onboardingMessages, products, roadmapItems, type ProfileValue } from "@/db/schema";

import { loadDomainKnowledge, resolveRefs, type DomainKnowledge } from "./knowledge-context";
import { PROFILE_FIELDS, PROFILE_KEYS } from "./profile";

const MODEL = "claude-opus-5-5";
const MAX_ITERATIONS = 8;
const MAX_CANDIDATES = 3;

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlock;

export class OnboardingError extends Error {}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function instructions(domainName: string) {
  const fields = PROFILE_FIELDS.map((f) => `- ${f.key}: ${f.label} — ${f.hint}`).join("\n");
  return `You are Roadwise, an AI product consultant for ${domainName} products. You are onboarding a founder's existing product. Onboarding ends with one consequential roadmap decision the founder chooses to investigate — not with a generated roadmap.

How Roadwise works:
- Every recommendation records the full chain: what we observed → why it matters here → what we recommend → how to test it → what would change our conclusion.
- Industry developments and vendor claims are reasons to investigate, not reasons to adopt. A new capability matters only if this product's evidence shows the problem it solves.
- Evaluate changes on complete user journeys against ranked priorities and guardrails: a faster agent that books the wrong slot is worse, not better.
- Missing evidence stays explicitly unresolved. Never invent facts about the product, numbers, or customers. Mark anecdotes as anecdotes.
- Knowledge marked [unreviewed] was proposed by AI research and not yet verified by a domain expert; you may use it, but say so when it is central to a recommendation.

The onboarding has three phases. Move through them at the founder's pace; they may skip ahead.

1. Understand the product. Read everything the founder shared first and record what it tells you before asking anything. Then ask what is still missing — one or two pointed questions per turn, chosen using the domain knowledge (common failure modes, what buyers judge, how quality is measured). Follow up on vague or unsupported answers ("how often?", "do you have recordings?") instead of accepting them. Record each fact with update_profile as soon as you learn it: basis "stated" for what the founder said or shared, "inferred" for your own reading (e.g. from their code). Profile fields:
${fields}

2. Turn the roadmap into hypotheses. Once the profile covers most fields (or the founder asks), call save_roadmap_item for each item on the founder's roadmap: rewrite it as "We believe <change> will improve <outcome> for <who>", set evidence_status from what is actually known (supported / contradicted / unknown) and say what the evidence is or what is missing. You may add up to three items of your own (origin "roadwise") when the domain knowledge and this product's evidence point to a gap the roadmap misses. Name the evaluation priorities each item affects and cite knowledge refs.

3. Propose decisions. Call propose_decision for two or three candidates (at most ${MAX_CANDIDATES}), favouring high impact, high uncertainty, and low cost to test — often "investigate before building". Fill every part of the chain, with acceptance criteria fixed before any test. Then briefly explain the trade-offs and ask the founder to choose one in the panel.

Citations: refer to knowledge entries by their ref in brackets, e.g. [C12] or [E2], both in your messages and in the refs arrays of tool calls. Only cite refs that exist in the knowledge base below.

Style: you are talking in a chat panel beside a live profile. Write plain conversational text — short paragraphs, no headings, no tables. Keep turns under about 120 words unless you are summarizing a phase. Do not repeat back everything you recorded; the founder can see the panel.`;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const refsSchema = z.array(z.string()).max(12).default([]);
const levelSchema = z.enum(["high", "medium", "low"]);

const UpdateProfile = z.object({
  field: z.enum(PROFILE_KEYS),
  value: z.string().trim().min(1).max(2000),
  basis: z.enum(["stated", "inferred"]),
});

const SaveRoadmapItem = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  hypothesis: z.string().trim().min(1).max(1000),
  origin: z.enum(["founder", "roadwise"]),
  evidence_status: z.enum(["supported", "contradicted", "unknown"]),
  evidence: z.string().trim().max(1500).default(""),
  priorities: z.array(z.string()).max(6).default([]),
  refs: refsSchema,
});

const ProposeDecision = z.object({
  roadmap_item_id: z.uuid().optional(),
  title: z.string().trim().min(1).max(200),
  observed: z.string().trim().min(1).max(1500),
  why_it_matters: z.string().trim().min(1).max(1500),
  recommendation: z.string().trim().min(1).max(1500),
  how_to_test: z.string().trim().min(1).max(1500),
  acceptance_criteria: z.string().trim().min(1).max(1500),
  would_change_conclusion: z.string().trim().min(1).max(1500),
  impact: levelSchema,
  uncertainty: levelSchema,
  cost_to_test: levelSchema,
  refs: refsSchema,
});

const str = { type: "string" } as const;
const strArray = { type: "array", items: { type: "string" } } as const;
const levelProp = { type: "string", enum: ["high", "medium", "low"] } as const;

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "update_profile",
    description:
      "Record one thing you have learned about the product in the profile panel. Call it as soon as you learn something; calling it again replaces the field's value, so include everything relevant for that field.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", enum: PROFILE_KEYS },
        value: { type: "string", description: "Concise, specific, in the founder's terms." },
        basis: {
          type: "string",
          enum: ["stated", "inferred"],
          description: "stated: the founder said or shared it. inferred: your own reading.",
        },
      },
      required: ["field", "value", "basis"],
    },
  },
  {
    name: "save_roadmap_item",
    description:
      "Create a roadmap hypothesis, or update one by passing its id. Use for each item on the founder's roadmap and for up to three items of your own.",
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Existing roadmap item id, to update it." },
        title: { ...str, description: "Short name of the roadmap item." },
        hypothesis: { ...str, description: 'Phrased as "We believe <change> will improve <outcome> for <who>".' },
        origin: { type: "string", enum: ["founder", "roadwise"] },
        evidence_status: { type: "string", enum: ["supported", "contradicted", "unknown"] },
        evidence: { ...str, description: "What supports or contradicts it — or what evidence is missing." },
        priorities: { ...strArray, description: "Names of the evaluation priorities this affects." },
        refs: { ...strArray, description: "Knowledge refs such as C12 or E2." },
      },
      required: ["title", "hypothesis", "origin", "evidence_status", "evidence", "priorities", "refs"],
    },
  },
  {
    name: "propose_decision",
    description: `Propose a candidate decision for the founder to choose (at most ${MAX_CANDIDATES} open candidates). Record the full chain; acceptance criteria must be fixed before any test.`,
    eager_input_streaming: true,
    input_schema: {
      type: "object",
      properties: {
        roadmap_item_id: { type: "string", description: "The roadmap item this decision is about, if any." },
        title: { ...str, description: "The decision, as a question or choice." },
        observed: { ...str, description: "What we observed (industry signal and/or product evidence)." },
        why_it_matters: { ...str, description: "Why it matters for this product specifically." },
        recommendation: { ...str, description: "What we recommend — often investigate before building." },
        how_to_test: { ...str, description: "How to test it, on this product's own journeys." },
        acceptance_criteria: { ...str, description: "Pass/fail criteria, including guardrails, set before testing." },
        would_change_conclusion: { ...str, description: "Evidence that would change our conclusion." },
        impact: levelProp,
        uncertainty: levelProp,
        cost_to_test: levelProp,
        refs: { ...strArray, description: "Knowledge refs such as C12 or E2." },
      },
      required: [
        "title",
        "observed",
        "why_it_matters",
        "recommendation",
        "how_to_test",
        "acceptance_criteria",
        "would_change_conclusion",
        "impact",
        "uncertainty",
        "cost_to_test",
        "refs",
      ],
    },
  },
];

type ToolContext = { productId: string; knowledge: DomainKnowledge };

async function runTool(
  name: string,
  input: unknown,
  ctx: ToolContext,
): Promise<{ content: string; isError?: boolean }> {
  const db = getDb();

  if (name === "update_profile") {
    const parsed = UpdateProfile.safeParse(input);
    if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues[0]?.message}`, isError: true };
    const { field, value, basis } = parsed.data;
    const [product] = await db
      .select({ profile: products.profile })
      .from(products)
      .where(eq(products.id, ctx.productId));
    const current = product?.profile[field];
    if (current?.basis === "confirmed") {
      return {
        content: `The founder confirmed this field in the panel ("${current.value}"). Ask them before changing it.`,
        isError: true,
      };
    }
    const next: ProfileValue = { value, basis, updatedAt: new Date().toISOString() };
    await db
      .update(products)
      .set({ profile: { ...product?.profile, [field]: next } })
      .where(eq(products.id, ctx.productId));
    return { content: `Saved ${field}.` };
  }

  if (name === "save_roadmap_item") {
    const parsed = SaveRoadmapItem.safeParse(input);
    if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues[0]?.message}`, isError: true };
    const d = parsed.data;
    const values = {
      title: d.title,
      hypothesis: d.hypothesis,
      origin: d.origin,
      evidenceStatus: d.evidence_status,
      evidence: d.evidence || null,
      priorities: d.priorities.filter((p) => ctx.knowledge.priorityNames.includes(p)),
      refs: resolveRefs(ctx.knowledge, d.refs),
    };
    if (d.id) {
      const updated = await db
        .update(roadmapItems)
        .set(values)
        .where(and(eq(roadmapItems.id, d.id), eq(roadmapItems.productId, ctx.productId)))
        .returning({ id: roadmapItems.id });
      if (updated.length === 0) return { content: `No roadmap item with id ${d.id}.`, isError: true };
      return { content: `Updated roadmap item ${d.id}.` };
    }
    const [row] = await db
      .insert(roadmapItems)
      .values({ ...values, productId: ctx.productId })
      .returning({ id: roadmapItems.id });
    return { content: `Saved roadmap item with id ${row.id}.` };
  }

  if (name === "propose_decision") {
    const parsed = ProposeDecision.safeParse(input);
    if (!parsed.success) return { content: `Invalid input: ${parsed.error.issues[0]?.message}`, isError: true };
    const d = parsed.data;
    const [{ n }] = await db
      .select({ n: count() })
      .from(decisions)
      .where(and(eq(decisions.productId, ctx.productId), eq(decisions.status, "candidate")));
    if (n >= MAX_CANDIDATES) {
      return { content: `There are already ${n} open candidates; that is the limit.`, isError: true };
    }
    let roadmapItemId: string | null = null;
    if (d.roadmap_item_id) {
      const [item] = await db
        .select({ id: roadmapItems.id })
        .from(roadmapItems)
        .where(and(eq(roadmapItems.id, d.roadmap_item_id), eq(roadmapItems.productId, ctx.productId)));
      roadmapItemId = item?.id ?? null;
    }
    const [row] = await db
      .insert(decisions)
      .values({
        productId: ctx.productId,
        roadmapItemId,
        title: d.title,
        observed: d.observed,
        whyItMatters: d.why_it_matters,
        recommendation: d.recommendation,
        howToTest: d.how_to_test,
        acceptanceCriteria: d.acceptance_criteria,
        wouldChangeConclusion: d.would_change_conclusion,
        impact: d.impact,
        uncertainty: d.uncertainty,
        costToTest: d.cost_to_test,
        refs: resolveRefs(ctx.knowledge, d.refs),
      })
      .returning({ id: decisions.id });
    return { content: `Proposed decision with id ${row.id}.` };
  }

  return { content: `Unknown tool ${name}.`, isError: true };
}

// ---------------------------------------------------------------------------
// Conversation storage
// ---------------------------------------------------------------------------

type Kind = (typeof onboardingMessages.$inferInsert)["kind"];

async function appendMessage(productId: string, role: "user" | "assistant", kind: Kind, content: unknown) {
  const db = getDb();
  const [{ last }] = await db
    .select({ last: max(onboardingMessages.seq) })
    .from(onboardingMessages)
    .where(eq(onboardingMessages.productId, productId));
  await db.insert(onboardingMessages).values({ productId, role, kind, content, seq: (last ?? 0) + 1 });
}

async function loadHistory(productId: string): Promise<MessageParam[]> {
  const rows = await getDb()
    .select({ role: onboardingMessages.role, content: onboardingMessages.content })
    .from(onboardingMessages)
    .where(eq(onboardingMessages.productId, productId))
    .orderBy(asc(onboardingMessages.seq));
  // Stored turns are exactly what was sent or received, so they replay as-is.
  return rows.map((r) => ({ role: r.role, content: r.content }) as MessageParam);
}

/**
 * After a mid-output refusal fallback, blocks the declined model produced before the
 * last `fallback` boundary must not be echoed back (thinking, tool calls, unknown types);
 * text blocks are kept. Without a fallback block, content is returned unchanged.
 */
function echoable(content: ContentBlock[]): ContentBlock[] {
  const boundary = content.findLastIndex((b) => b.type === "fallback");
  if (boundary === -1) return content;
  return content.filter((b, i) => i >= boundary || b.type === "text");
}

// ---------------------------------------------------------------------------
// Turn loop
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    throw new OnboardingError("Roadwise isn't connected to Claude yet: set ANTHROPIC_API_KEY.");
  }
  client ??= new Anthropic();
  return client;
}

/**
 * Appends the founder's message (or shared material / a panel-edit note) and lets
 * Roadwise respond, running its tools until it finishes the turn.
 */
export async function runTurn(productId: string, kind: "kickoff" | "chat" | "note", text: string) {
  const db = getDb();
  const [row] = await db
    .select({ domainId: products.domainId, domainName: domains.name })
    .from(products)
    .innerJoin(domains, eq(domains.id, products.domainId))
    .where(eq(products.id, productId));
  if (!row) throw new OnboardingError("Product not found.");

  // Fail before storing anything if Claude isn't configured, so the turn can simply be retried.
  const anthropic = getClient();
  const knowledge = await loadDomainKnowledge(row.domainId);
  await appendMessage(productId, "user", kind, text);

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: instructions(row.domainName) },
    {
      type: "text",
      text: `# ${row.domainName} knowledge base\n\n${knowledge.prompt}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  let jsonRetries = 0;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const messages = await loadHistory(productId);

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await anthropic.beta.messages
        .stream({
          model: MODEL,
          max_tokens: 64000,
          system,
          tools: TOOLS,
          messages,
          thinking: { type: "adaptive" },
          output_config: { effort: "medium" },
          // On a policy decline, the API re-runs the request on a fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          // Caches the growing conversation, on top of the system-prompt breakpoint.
          cache_control: { type: "ephemeral" },
        })
        .finalMessage();
      jsonRetries = 0;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        throw new OnboardingError("Roadwise can't reach Claude: the Anthropic API key is missing or invalid.");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new OnboardingError("Claude is rate-limited right now. Try again in a moment.");
      }
      if (err instanceof Anthropic.APIError || err instanceof OnboardingError) throw err;
      // A tool input that could not be parsed at all (eager input streaming): re-issue the turn.
      if (jsonRetries++ >= 2) throw err;
      continue;
    }

    const content = echoable(message.content);
    await appendMessage(productId, "assistant", "reply", content);

    if (message.stop_reason === "refusal" || message.stop_reason === "end_turn") return;
    if (message.stop_reason === "pause_turn") continue;

    const toolUses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) return;
    if (message.stop_reason === "max_tokens") {
      throw new OnboardingError("Roadwise's reply was cut off. Try asking again.");
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of toolUses) {
      try {
        const r = await runTool(use.name, use.input, { productId, knowledge });
        results.push({ type: "tool_result", tool_use_id: use.id, content: r.content, is_error: r.isError });
      } catch (err) {
        console.error("onboarding tool failed", use.name, err);
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: "The tool failed; continue without it.",
          is_error: true,
        });
      }
    }
    await appendMessage(productId, "user", "tool_result", results);
  }
}
