import "server-only";

import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import {
  decisions,
  evalSuites,
  productInputs,
  products,
  type EvalCheck,
  type EvalMock,
  type EvalScenario,
} from "@/db/schema";
import { getClient, OnboardingError } from "@/lib/onboarding/agent";
import { loadDomainKnowledge, resolveRefs } from "@/lib/onboarding/knowledge-context";
import { PROFILE_FIELDS } from "@/lib/onboarding/profile";

import { connectorFor } from "./connectors";

const MODEL = "claude-opus-5-5";

// What the model returns. Strict structured outputs don't allow free-form maps, so
// settings/mocks/checks are flat; toScenario() converts them to the stored shape.
const GeneratedSuite = z.object({
  summary: z.string().describe("Two or three sentences: what this suite covers and why, for the founder."),
  scenarios: z
    .array(
      z.object({
        title: z.string(),
        rationale: z.string().describe("Why this matters for THIS product, citing knowledge refs like [C29] [E2]."),
        measures: z.string().describe("The evaluation priority or acceptance criterion this measures."),
        refs: z.array(z.string()).describe('Knowledge refs used, e.g. ["C29", "E2"].'),
        booking: z.enum(["none", "internal", "google"]),
        appointment_location: z.enum(["in_person", "video"]),
        transfer: z.boolean(),
        knowledge_base: z.boolean(),
        mocks: z.array(
          z.object({
            tool: z.string(),
            returns: z.string().nullable(),
            raises: z.string().nullable(),
            require_arg: z.string().nullable(),
            require_contains: z.string().nullable(),
            require_error: z.string().nullable(),
          }),
        ),
        turns: z.array(z.string()).describe("The caller's turns, in order, as transcribed text."),
        checks: z.array(
          z.object({
            type: z.enum(["tool_called", "tool_not_called", "tool_arg_equals", "judge"]),
            tool: z.string().nullable(),
            arg: z.string().nullable(),
            value: z.string().nullable(),
            intent: z.string().nullable(),
          }),
        ),
      }),
    )
    .describe("6 to 8 scenarios."),
  unresolved: z
    .array(z.object({ criterion: z.string(), reason: z.string() }))
    .describe("Criteria this harness cannot check, with why (e.g. needs audio)."),
});

type Generated = z.infer<typeof GeneratedSuite>;

function toScenario(s: Generated["scenarios"][number], i: number): EvalScenario {
  const mocks: Record<string, EvalMock> = {};
  for (const m of s.mocks) {
    const mock: EvalMock = {};
    if (m.returns) mock.returns = m.returns;
    if (m.raises) mock.raises = m.raises;
    if (m.require_arg && m.require_error) {
      mock.require = { arg: m.require_arg, contains: m.require_contains ?? "", error: m.require_error };
    }
    mocks[m.tool] = mock;
  }
  const checks: EvalCheck[] = s.checks.flatMap((c): EvalCheck[] => {
    if ((c.type === "tool_called" || c.type === "tool_not_called") && c.tool) return [{ type: c.type, tool: c.tool }];
    if (c.type === "tool_arg_equals" && c.tool && c.arg && c.value !== null)
      return [{ type: c.type, tool: c.tool, arg: c.arg, value: c.value }];
    if (c.type === "judge" && c.intent) return [{ type: c.type, intent: c.intent }];
    return [];
  });
  return {
    id: `S${i + 1}`,
    // The model sometimes prefixes its own numbering ("S1 …"); ids are assigned here.
    title: s.title.replace(/^S\d+[:.)\s-]+/i, "").trim(),
    rationale: s.rationale,
    measures: s.measures,
    refs: s.refs,
    settings: {
      booking: s.booking,
      appointment_location: s.appointment_location,
      transfer: s.transfer,
      knowledge_base: s.knowledge_base,
    },
    mocks,
    turns: s.turns,
    checks,
  };
}

const INSTRUCTIONS = `You are Roadwise's evaluation designer. You write the held-out evaluation a domain expert would write for ONE specific product: scenarios that test the failure modes and evaluation priorities that matter in this industry, applied to how this product actually works.

Rules:
- Ground every scenario in the domain knowledge base AND the product's own context. Cite knowledge refs ([C12], [E2]) in the rationale. Knowledge marked [unreviewed] is AI-researched: you may use it, but say "per unreviewed research" when a scenario depends on a specific claim.
- Evaluate complete jobs, not single replies, where it matters (e.g. a booking only counts if the right data reaches the tool).
- Prefer objective checks (tool_called, tool_arg_equals) and add a judge check for what the caller hears. Every scenario needs at least one check.
- A judge check sees ONLY the agent's LAST message. Write judge intents that the last message alone can satisfy; anything that may happen earlier in the call (empathy, asking for details) must not be required of the last message.
- Every check must trace to a stated acceptance criterion, an evaluation priority, or a cited knowledge entry. Never add requirements of your own (e.g. forbidding the agent from telling the caller what it did, when nothing says that is wrong). When unsure whether behavior is wrong, don't check it.
- Include at least one guardrail scenario (the agent must NOT do something: invent a price, claim a booking that failed, give clinical advice).
- If a decision is in focus, cover each of its acceptance criteria that the harness can check, and list the rest in "unresolved". Never pretend text mode measures audio behavior.
- Scenarios must be runnable by the harness described below exactly as specified: only the listed settings, tools and check types.
- Write realistic caller turns (2–4 turns per scenario usually), in plain transcribed speech.`;

export async function generateSuite(productId: string) {
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) throw new OnboardingError("Product not found.");
  const connector = connectorFor(product.evalConnector);
  if (!connector) throw new OnboardingError("No eval harness is connected for this product yet.");

  const [inputs, [decision], knowledge] = await Promise.all([
    db
      .select({ kind: productInputs.kind, title: productInputs.title, content: productInputs.content })
      .from(productInputs)
      .where(eq(productInputs.productId, productId))
      .orderBy(asc(productInputs.createdAt)),
    db
      .select()
      .from(decisions)
      .where(and(eq(decisions.productId, productId), eq(decisions.status, "selected"))),
    loadDomainKnowledge(product.domainId),
  ]);

  const profile = PROFILE_FIELDS.map((f) => `- ${f.label}: ${product.profile[f.key]?.value ?? "unknown"}`).join("\n");
  const shared = inputs
    .map((i) => `<shared kind="${i.kind}" title="${i.title}">\n${i.content.slice(0, 24000)}\n</shared>`)
    .join("\n\n");
  const focus = decision
    ? `Decision in focus: "${decision.title}"\nRecommendation: ${decision.recommendation}\nAcceptance criteria: ${decision.acceptanceCriteria}`
    : "No decision is in focus: write a baseline suite covering the domain's top evaluation priorities for this product.";

  const anthropic = getClient();
  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(GeneratedSuite) },
    system: [
      { type: "text", text: INSTRUCTIONS },
      { type: "text", text: `# Harness\n\n${connector.spec}` },
      { type: "text", text: knowledge.prompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      {
        role: "user",
        content: `# Product: ${product.name}\n\n${product.summary}\n\n## Profile\n${profile}\n\n## Shared material\n${shared || "(none)"}\n\n## Focus\n${focus}\n\nWrite the evaluation suite.`,
      },
    ],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new OnboardingError("Claude declined to write this suite.");
  if (message.stop_reason === "max_tokens") throw new OnboardingError("The suite was cut off; try again.");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = GeneratedSuite.safeParse(JSON.parse(text));
  if (!parsed.success) throw new OnboardingError("The generated suite didn't match the harness format; try again.");

  const scenarios = parsed.data.scenarios.map(toScenario).filter((s) => s.checks.length > 0 && s.turns.length > 0);
  const refKeys = [...new Set(scenarios.flatMap((s) => s.refs))];
  const [suite] = await db
    .insert(evalSuites)
    .values({
      productId,
      decisionId: decision?.id ?? null,
      connector: connector.id,
      summary: parsed.data.summary,
      scenarios,
      unresolved: parsed.data.unresolved,
      refs: resolveRefs(knowledge, refKeys),
    })
    .returning({ id: evalSuites.id });
  return suite.id;
}
