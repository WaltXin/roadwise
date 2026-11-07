"use server";

import { and, asc, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { decisions, domains, productInputs, products, roadmapItems, type ProfileValue } from "@/db/schema";
import { requireExpert } from "@/lib/auth/server";

import { OnboardingError, runTurn } from "./agent";
import { appendNote } from "./notes";
import { INPUT_KIND_LABELS, PROFILE_KEYS, profileLabel } from "./profile";

export type ActionResult = { error?: string };

const uuid = z.uuid();

function toError(err: unknown): ActionResult {
  if (err instanceof OnboardingError) return { error: err.message };
  console.error("onboarding action failed", err);
  return { error: "Something went wrong talking to Roadwise. Try again." };
}

// ---------------------------------------------------------------------------
// Create a product
// ---------------------------------------------------------------------------

export type CreateProductState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long"),
  domainId: z.uuid("Choose a domain"),
  summary: z.string().trim().min(1, "Describe the product in a sentence or two").max(4000, "Too long"),
  repoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https?:\/\//.test(v), "Enter a full URL starting with https://"),
  roadmap: z.string().trim().max(20000, "Too long"),
  code: z.string().trim().max(60000, "Too long"),
  evidence: z.string().trim().max(60000, "Too long"),
});

export async function createProduct(_prev: CreateProductState, formData: FormData): Promise<CreateProductState> {
  await requireExpert();
  const raw = Object.fromEntries(
    ["name", "domainId", "summary", "repoUrl", "roadmap", "code", "evidence"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please fix the highlighted fields.", fieldErrors, values: raw };
  }
  const d = parsed.data;
  const db = getDb();
  const [domain] = await db.select({ id: domains.id }).from(domains).where(eq(domains.id, d.domainId));
  if (!domain) return { error: "That domain no longer exists.", values: raw };

  const [product] = await db
    .insert(products)
    .values({ domainId: d.domainId, name: d.name, summary: d.summary, repoUrl: d.repoUrl || null })
    .returning({ id: products.id });

  const inputs = (
    [
      ["roadmap", d.roadmap],
      ["code", d.code],
      ["evidence", d.evidence],
    ] as const
  )
    .filter(([, content]) => content)
    .map(([kind, content]) => ({ productId: product.id, kind, title: INPUT_KIND_LABELS[kind], content }));
  if (inputs.length) await db.insert(productInputs).values(inputs);

  redirect(`/products/${product.id}`);
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

/** Sends everything the founder shared as the first message, and gets Roadwise's first turn. */
export async function startOnboarding(productId: string): Promise<ActionResult> {
  await requireExpert();
  if (!uuid.safeParse(productId).success) return { error: "Unknown product." };
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) return { error: "Unknown product." };
  const inputs = await db
    .select()
    .from(productInputs)
    .where(eq(productInputs.productId, productId))
    .orderBy(asc(productInputs.createdAt));

  const escape = (s: string) => s.replace(/</g, "&lt;");
  const kickoff = [
    `I'd like to onboard my product, ${product.name}.`,
    "",
    `<description>\n${escape(product.summary)}\n</description>`,
    product.repoUrl ? `<repository>${escape(product.repoUrl)}</repository>` : "",
    ...inputs.map((i) => `<shared kind="${i.kind}" title="${escape(i.title)}">\n${escape(i.content)}\n</shared>`),
    "",
    "Please start the onboarding.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  try {
    await runTurn(productId, "kickoff", kickoff);
  } catch (err) {
    refresh();
    return toError(err);
  }
  refresh();
  return {};
}

export async function sendMessage(productId: string, text: string): Promise<ActionResult> {
  await requireExpert();
  const message = text.trim();
  if (!uuid.safeParse(productId).success) return { error: "Unknown product." };
  if (!message) return { error: "Write a message first." };
  if (message.length > 8000) return { error: "That message is too long." };
  try {
    await runTurn(productId, "chat", message);
  } catch (err) {
    refresh();
    return toError(err);
  }
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Panel edits — recorded in the conversation so Roadwise sees them next turn
// ---------------------------------------------------------------------------

export async function confirmProfileField(productId: string, field: string, value: string): Promise<ActionResult> {
  await requireExpert();
  const key = z.enum(PROFILE_KEYS).safeParse(field);
  const clean = value.trim();
  if (!uuid.safeParse(productId).success || !key.success) return { error: "Unknown field." };
  if (clean.length > 2000) return { error: "That's too long." };

  const db = getDb();
  const [product] = await db.select({ profile: products.profile }).from(products).where(eq(products.id, productId));
  if (!product) return { error: "Unknown product." };
  const profile = { ...product.profile };
  if (clean) {
    profile[key.data] = {
      value: clean,
      basis: "confirmed",
      updatedAt: new Date().toISOString(),
    } satisfies ProfileValue;
  } else {
    delete profile[key.data];
  }
  await db.update(products).set({ profile }).where(eq(products.id, productId));
  await appendNote(
    productId,
    clean
      ? `[Panel edit] I confirmed "${profileLabel(key.data)}" as: ${clean}`
      : `[Panel edit] I cleared "${profileLabel(key.data)}".`,
  );
  refresh();
  return {};
}

export async function setRoadmapStatus(productId: string, itemId: string, status: "kept" | "dropped" | "proposed") {
  await requireExpert();
  if (!uuid.safeParse(productId).success || !uuid.safeParse(itemId).success) return { error: "Unknown item." };
  const db = getDb();
  const [item] = await db
    .update(roadmapItems)
    .set({ status })
    .where(and(eq(roadmapItems.id, itemId), eq(roadmapItems.productId, productId)))
    .returning({ title: roadmapItems.title });
  if (!item) return { error: "Unknown item." };
  const verb = status === "kept" ? "kept" : status === "dropped" ? "dropped" : "reopened";
  await appendNote(productId, `[Panel edit] I ${verb} the roadmap item "${item.title}".`);
  refresh();
  return {};
}

export async function chooseDecision(productId: string, decisionId: string): Promise<ActionResult> {
  await requireExpert();
  if (!uuid.safeParse(productId).success || !uuid.safeParse(decisionId).success) return { error: "Unknown decision." };
  const db = getDb();
  const [chosen] = await db
    .update(decisions)
    .set({ status: "selected" })
    .where(and(eq(decisions.id, decisionId), eq(decisions.productId, productId)))
    .returning({ title: decisions.title });
  if (!chosen) return { error: "Unknown decision." };
  // Only one selected decision at a time; the others stay as candidates.
  await db
    .update(decisions)
    .set({ status: "candidate" })
    .where(and(eq(decisions.productId, productId), eq(decisions.status, "selected"), ne(decisions.id, decisionId)));
  await appendNote(productId, `[Panel edit] I chose the decision "${chosen.title}" to investigate first.`);
  refresh();
  return {};
}
