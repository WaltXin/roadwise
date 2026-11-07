import "server-only";

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";

import { getDb } from "@/db";
import {
  decisions,
  domains,
  evalRuns,
  evalSuites,
  implementations,
  productInputs,
  products,
  roadmapItems,
  type Decision,
  type Implementation,
} from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { loadDomainKnowledge } from "@/lib/onboarding/knowledge-context";
import { appendNote } from "@/lib/onboarding/notes";
import { BASIS_LABELS, EVIDENCE_LABELS, PROFILE_FIELDS } from "@/lib/onboarding/profile";

// Everything the Roadwise MCP server returns is Markdown written for a coding agent:
// ids it can pass back, the decision's full chain, and citations resolved to real sources.

export class McpInputError extends Error {}

async function getProduct(productId: string) {
  const [product] = await getDb()
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
  if (!product) throw new McpInputError(`No product with id ${productId}. Call list_products to see the ids.`);
  return product;
}

/** Appends a "References" list for the [C12]-style citations used in the given texts. */
async function references(domainId: string, texts: string[]) {
  const knowledge = await loadDomainKnowledge(domainId);
  const used = [...new Set(texts.flatMap((t) => t.match(/\[[SCEQ]\d+\]/g) ?? []))].sort();
  const lines = used.flatMap((token) => {
    const ref = knowledge.refs[token.slice(1, -1)];
    return ref ? [`- ${token} ${ref.label}${ref.url ? ` — ${ref.url}` : ""}`] : [];
  });
  return lines.length ? `\n\n## References\n\n${lines.join("\n")}` : "";
}

function decisionTexts(d: Decision) {
  return [d.observed, d.whyItMatters, d.recommendation, d.howToTest, d.acceptanceCriteria, d.wouldChangeConclusion];
}

function formatImplementation(i: Implementation) {
  const parts = [
    `- ${i.createdAt.toISOString().slice(0, 10)} · reported by ${i.reportedBy}: ${i.summary}`,
    i.prUrl && `  PR: ${i.prUrl}`,
    i.branch && `  Branch: ${i.branch}`,
    i.commitSha && `  Commit: ${i.commitSha}`,
    i.filesChanged.length > 0 && `  Files: ${i.filesChanged.join(", ")}`,
    i.verification && `  Verified by: ${i.verification}`,
  ];
  return parts.filter(Boolean).join("\n");
}

function decisionState(d: Decision, reports: Implementation[]) {
  if (d.status !== "selected") return d.status === "candidate" ? "candidate (not chosen)" : "dismissed";
  return reports.length > 0 ? "implemented — awaiting evaluation against the acceptance criteria" : "chosen — open";
}

function formatDecision(d: Decision, reports: Implementation[], roadmapTitle?: string) {
  const header = [
    `### ${d.title}`,
    `decision_id: ${d.id}`,
    `Status: ${decisionState(d, reports)}`,
    roadmapTitle && `Roadmap item: ${roadmapTitle}`,
    `Impact ${d.impact} · Uncertainty ${d.uncertainty} · Cost to test ${d.costToTest}`,
  ];
  return [
    header.filter(Boolean).join("\n"),
    `**1. What we observed**\n${d.observed}`,
    `**2. Why it matters here**\n${d.whyItMatters}`,
    `**3. What we recommend**\n${d.recommendation}`,
    `**4. How to test it**\n${d.howToTest}`,
    `**5. Acceptance criteria (set before testing)**\n${d.acceptanceCriteria}`,
    `**6. What would change our conclusion**\n${d.wouldChangeConclusion}`,
    reports.length > 0 && `**Implementation reports**\n${reports.map(formatImplementation).join("\n")}`,
  ]
    .filter((p) => p !== false && p !== undefined && p !== null)
    .join("\n\n");
}

async function reportsFor(decisionIds: string[]) {
  if (decisionIds.length === 0) return new Map<string, Implementation[]>();
  const rows = await getDb()
    .select()
    .from(implementations)
    .where(inArray(implementations.decisionId, decisionIds))
    .orderBy(asc(implementations.createdAt));
  const map = new Map<string, Implementation[]>();
  for (const row of rows) map.set(row.decisionId, [...(map.get(row.decisionId) ?? []), row]);
  return map;
}

export async function listProductsMarkdown() {
  const db = getDb();
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      summary: products.summary,
      repoUrl: products.repoUrl,
      domainName: domains.name,
    })
    .from(products)
    .innerJoin(domains, eq(domains.id, products.domainId))
    .orderBy(desc(products.updatedAt));
  if (rows.length === 0) return `No products yet. A founder onboards one at ${appUrl("/products/new")}.`;

  const chosen = await db
    .select({ productId: decisions.productId, title: decisions.title })
    .from(decisions)
    .where(eq(decisions.status, "selected"));
  const chosenBy = new Map(chosen.map((c) => [c.productId, c.title]));

  return [
    "# Products in Roadwise",
    ...rows.map((p) =>
      [
        `## ${p.name}`,
        `product_id: ${p.id}`,
        `Industry: ${p.domainName}${p.repoUrl ? ` · Repository: ${p.repoUrl}` : ""}`,
        p.summary,
        `Chosen decision: ${chosenBy.get(p.id) ?? "none yet — the founder hasn't chosen one"}`,
      ].join("\n"),
    ),
  ].join("\n\n");
}

export async function productContextMarkdown(productId: string) {
  const product = await getProduct(productId);
  const db = getDb();
  const [items, decisionRows, inputs] = await Promise.all([
    db
      .select()
      .from(roadmapItems)
      .where(and(eq(roadmapItems.productId, productId), ne(roadmapItems.status, "dropped")))
      .orderBy(asc(roadmapItems.createdAt)),
    db
      .select()
      .from(decisions)
      .where(and(eq(decisions.productId, productId), ne(decisions.status, "dismissed")))
      .orderBy(asc(decisions.createdAt)),
    db
      .select({ kind: productInputs.kind, title: productInputs.title })
      .from(productInputs)
      .where(eq(productInputs.productId, productId))
      .orderBy(asc(productInputs.createdAt)),
  ]);
  const reports = await reportsFor(decisionRows.map((d) => d.id));

  const profile = PROFILE_FIELDS.map((f) => {
    const v = product.profile[f.key];
    return v ? `- **${f.label}** (${BASIS_LABELS[v.basis]}): ${v.value}` : `- **${f.label}**: unknown`;
  });
  const roadmap = items.map(
    (i) =>
      `- **${i.title}** — ${EVIDENCE_LABELS[i.evidenceStatus]}${i.status === "kept" ? " · kept by founder" : ""}\n  ${i.hypothesis}${i.evidence ? `\n  Evidence: ${i.evidence}` : ""}`,
  );
  const selected = decisionRows.filter((d) => d.status === "selected");
  const candidates = decisionRows.filter((d) => d.status === "candidate");

  const body = [
    `# ${product.name}`,
    `product_id: ${product.id}`,
    `Industry: ${product.domainName}${product.repoUrl ? ` · Repository: ${product.repoUrl}` : ""}`,
    `Workspace: ${appUrl(`/products/${product.id}`)}`,
    product.summary,
    `## What Roadwise understands\n\n${profile.join("\n")}`,
    `## Roadmap as hypotheses\n\n${roadmap.length ? roadmap.join("\n") : "Not reviewed yet."}`,
    `## Chosen decision\n\n${
      selected.length ? selected.map((d) => formatDecision(d, reports.get(d.id) ?? [])).join("\n\n") : "None yet."
    }`,
    candidates.length > 0 && `## Other candidates\n\n${candidates.map((d) => `- ${d.title} (${d.id})`).join("\n")}`,
    inputs.length > 0 && `## Material shared so far\n\n${inputs.map((i) => `- ${i.kind}: ${i.title}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const texts = [...items.flatMap((i) => [i.hypothesis, i.evidence ?? ""]), ...selected.flatMap(decisionTexts)];
  return body + (await references(product.domainId, texts));
}

export async function openDecisionsMarkdown(productId?: string) {
  const db = getDb();
  if (productId) await getProduct(productId);
  const rows = await db
    .select({
      decision: decisions,
      productName: products.name,
      domainId: products.domainId,
      roadmapTitle: roadmapItems.title,
    })
    .from(decisions)
    .innerJoin(products, eq(products.id, decisions.productId))
    .leftJoin(roadmapItems, eq(roadmapItems.id, decisions.roadmapItemId))
    .where(
      productId
        ? and(eq(decisions.status, "selected"), eq(decisions.productId, productId))
        : eq(decisions.status, "selected"),
    )
    .orderBy(desc(decisions.updatedAt));

  if (rows.length === 0) {
    return productId
      ? `No decision has been chosen for this product yet. The founder chooses one at ${appUrl(`/products/${productId}`)}; until then there is nothing Roadwise recommends implementing.`
      : "No product has a chosen decision yet, so there is nothing Roadwise recommends implementing.";
  }

  const reports = await reportsFor(rows.map((r) => r.decision.id));
  const sections = await Promise.all(
    rows.map(async (r) => {
      const block = formatDecision(r.decision, reports.get(r.decision.id) ?? [], r.roadmapTitle ?? undefined);
      const refs = await references(r.domainId, decisionTexts(r.decision));
      return `## ${r.productName} (product_id: ${r.decision.productId})\n\n${block}${refs.replace("\n\n## References", "\n\n#### References")}`;
    }),
  );
  return [
    "# Decisions chosen by the founder",
    "Implement what step 3 recommends — no more. Steps 4–5 define done: the change is judged against the acceptance criteria, not on whether it ships. When you finish, call report_implementation.",
    ...sections,
  ].join("\n\n");
}

export async function reportImplementation(input: {
  decision_id: string;
  summary: string;
  pr_url?: string;
  branch?: string;
  commit_sha?: string;
  files_changed?: string[];
  verification?: string;
  agent: string;
}) {
  const db = getDb();
  const [decision] = await db.select().from(decisions).where(eq(decisions.id, input.decision_id));
  if (!decision) throw new McpInputError(`No decision with id ${input.decision_id}. Call get_open_decisions.`);
  if (decision.status !== "selected") {
    throw new McpInputError(
      `"${decision.title}" is a ${decision.status} decision, not the one the founder chose. Only report work on a chosen decision (see get_open_decisions).`,
    );
  }

  await db.insert(implementations).values({
    productId: decision.productId,
    decisionId: decision.id,
    summary: input.summary,
    prUrl: input.pr_url ?? null,
    branch: input.branch ?? null,
    commitSha: input.commit_sha ?? null,
    filesChanged: input.files_changed ?? [],
    verification: input.verification ?? null,
    reportedBy: input.agent,
  });
  await db.update(products).set({ updatedAt: new Date() }).where(eq(products.id, decision.productId));

  // Tell the onboarding consultant, so it sees the change on its next turn.
  await appendNote(
    decision.productId,
    [
      `${input.agent} reported (via the Roadwise MCP server) that it implemented the chosen decision "${decision.title}":`,
      input.summary,
      input.pr_url && `PR: ${input.pr_url}`,
      input.verification && `Verified by: ${input.verification}`,
      "This is the agent's own account; the change has not been evaluated against the acceptance criteria yet.",
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `Recorded. "${decision.title}" is now marked implemented — awaiting evaluation.`,
    "",
    "Implemented is not done. The change is judged against the acceptance criteria the founder agreed to before testing:",
    "",
    decision.acceptanceCriteria,
    "",
    `How to test it: ${decision.howToTest}`,
    "",
    `Founder's view: ${appUrl(`/products/${decision.productId}`)}`,
  ].join("\n");
}

export async function shareEvidence(input: {
  product_id: string;
  kind: "code" | "evidence";
  title: string;
  content: string;
  agent: string;
}) {
  const product = await getProduct(input.product_id);
  const db = getDb();
  await db.insert(productInputs).values({
    productId: product.id,
    kind: input.kind,
    title: `${input.title} (from ${input.agent})`,
    content: input.content,
  });
  await db.update(products).set({ updatedAt: new Date() }).where(eq(products.id, product.id));
  await appendNote(
    product.id,
    `${input.agent} shared ${input.kind === "code" ? "code findings" : "evidence"} via the Roadwise MCP server — "${input.title}":\n\n${input.content}`,
  );
  return `Shared with Roadwise as ${input.kind} for ${product.name}. Roadwise weighs it on its next turn; it does not change any decision by itself.`;
}

/**
 * The latest verifier verdict for a product: outcome, summary and per-scenario findings.
 * Scenario titles and findings only — never the held-out turns or checks.
 */
export async function verdictMarkdown(productId: string) {
  const product = await getProduct(productId);
  const db = getDb();
  const [run] = await db
    .select()
    .from(evalRuns)
    .where(eq(evalRuns.productId, productId))
    .orderBy(desc(evalRuns.createdAt))
    .limit(1);
  if (!run) {
    return `No verification has run for ${product.name} yet. The founder runs the Roadwise verifier on the change; ask them to, or wait for it.`;
  }
  const [suite] = await db.select().from(evalSuites).where(eq(evalSuites.id, run.suiteId));
  const titles = new Map((suite?.scenarios ?? []).map((s) => [s.id, s.title]));
  const rate = (side: typeof run.base | null, id: string) => {
    if (!side) return "";
    const mine = side.results.filter((r) => r.scenario === id);
    return `${mine.filter((r) => r.passed).length}/${mine.length}`;
  };
  const label = { merge: "MERGE", do_not_merge: "DON'T MERGE", inconclusive: "INCONCLUSIVE", baseline: "BASELINE" }[
    run.verdict.outcome
  ];
  return [
    `# Verification for ${product.name}: ${label}`,
    `${run.head ? `${run.base.ref} (${run.base.commit}) vs ${run.head.ref} (${run.head.commit})` : `${run.base.ref} (${run.base.commit})`} · ${run.base.runs} runs per scenario · held-out suite, text mode · verdict by ${run.judge} · ${run.createdAt.toISOString()}`,
    run.verdict.summary,
    "## Scenarios",
    run.verdict.scenarios
      .map(
        (s) =>
          `- ${s.id} ${titles.get(s.id) ?? ""} — ${s.status}${run.head ? ` (base ${rate(run.base, s.id)}, head ${rate(run.head, s.id)})` : ` (${rate(run.base, s.id)})`}: ${s.finding}`,
      )
      .join("\n"),
    suite?.unresolved.length
      ? `## Unresolved (not checkable in this harness)\n${suite.unresolved.map((u) => `- ${u.criterion}: ${u.reason}`).join("\n")}`
      : "",
    "The scenarios themselves are held out: fix the behavior the findings describe, not the test.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
