import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

import { rejectUnauthorized } from "@/lib/api-auth";
import {
  listProductsMarkdown,
  McpInputError,
  openDecisionsMarkdown,
  productContextMarkdown,
  reportImplementation,
  shareEvidence,
  verdictMarkdown,
} from "@/lib/mcp/data";

// The Roadwise MCP server: lets coding agents (Claude Code, Codex, Cursor…) read the decision
// a founder chose and report back when they've implemented it. Streamable HTTP, stateless.

const INSTRUCTIONS = `Roadwise is a product consultant. It turns industry signals and product evidence into roadmap decisions, each recorded as a full chain: what we observed → why it matters here → what we recommend → how to test it → acceptance criteria → what would change our conclusion.

Working with it:
- Before changing a product Roadwise tracks, call get_open_decisions to see what the founder chose to work on, and get_product_context for how the product is built and what's known.
- Implement what the decision recommends, no more. The acceptance criteria define done; shipping alone doesn't.
- When you finish, call report_implementation with what you changed and how you verified it. Before merging, call get_verdict: Roadwise's verifier runs a held-out evaluation on your change. Report only what you actually did and ran — never claim results you didn't measure.
- If you find facts in the code, logs or tests that bear on a decision (e.g. "the agent never confirms the spelling of emails"), share them with share_evidence. Label guesses as guesses.`;

const agentName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .default("A coding agent")
  .describe('Who is reporting, e.g. "Claude Code" or "Codex".');

function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] };
}

/** Input problems go back to the agent as a tool error it can act on; anything else propagates. */
async function run(fn: () => Promise<string>) {
  try {
    return text(await fn());
  } catch (err) {
    if (err instanceof McpInputError) return { ...text(err.message), isError: true };
    throw err;
  }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_products",
      {
        title: "List products",
        description:
          "List the products Roadwise is consulting on, with their product_id, repository and the decision the founder chose (if any).",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      () => run(listProductsMarkdown),
    );

    server.registerTool(
      "get_product_context",
      {
        title: "Get product context",
        description:
          "What Roadwise understands about one product: profile (users, journeys, stack, goals, constraints, how quality is measured, known problems), its roadmap rewritten as hypotheses with evidence status, and the chosen decision. Read this before working on the product.",
        inputSchema: z.object({ product_id: z.uuid().describe("From list_products.") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      ({ product_id }) => run(() => productContextMarkdown(product_id)),
    );

    server.registerTool(
      "get_open_decisions",
      {
        title: "Get open decisions",
        description:
          "The decisions founders chose to act on, each as the full chain with acceptance criteria and any implementation reports so far. This is what Roadwise recommends working on. Omit product_id to see every product.",
        inputSchema: z.object({ product_id: z.uuid().optional().describe("Limit to one product.") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      ({ product_id }) => run(() => openDecisionsMarkdown(product_id)),
    );

    server.registerTool(
      "report_implementation",
      {
        title: "Report implementation",
        description:
          "Tell Roadwise you implemented a chosen decision. It marks the decision implemented — awaiting evaluation — shows the report to the founder, and returns the acceptance criteria the change will be judged on. Report only what you actually changed and ran.",
        inputSchema: z.object({
          decision_id: z.uuid().describe("From get_open_decisions."),
          summary: z
            .string()
            .trim()
            .min(10)
            .max(4000)
            .describe("What you changed and why, in a few sentences. Plain facts, no claimed outcomes."),
          pr_url: z.url().max(500).optional().describe("Pull request URL, if there is one."),
          branch: z.string().trim().max(200).optional(),
          commit_sha: z.string().trim().max(64).optional(),
          files_changed: z.array(z.string().trim().max(300)).max(100).optional(),
          verification: z
            .string()
            .trim()
            .max(4000)
            .optional()
            .describe("What you ran or checked to verify it (tests, simulations, manual calls) and the results."),
          agent: agentName,
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      (input) => run(() => reportImplementation(input)),
    );

    server.registerTool(
      "get_verdict",
      {
        title: "Get verification verdict",
        description:
          "The latest verdict from Roadwise's verifier for a product: merge / don't merge / inconclusive, with per-scenario findings from a held-out evaluation run on the base and head code. Check this before merging. The scenarios themselves are held out.",
        inputSchema: z.object({ product_id: z.uuid().describe("From list_products.") }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      ({ product_id }) => run(() => verdictMarkdown(product_id)),
    );

    server.registerTool(
      "share_evidence",
      {
        title: "Share evidence",
        description:
          "Send Roadwise a finding from the code, logs, tests or transcripts that bears on the product's decisions. Roadwise weighs it as evidence on its next turn; it doesn't change a decision by itself.",
        inputSchema: z.object({
          product_id: z.uuid().describe("From list_products."),
          kind: z
            .enum(["code", "evidence"])
            .describe(
              "code = how something is built (from reading the code); evidence = observed behavior or results.",
            ),
          title: z.string().trim().min(3).max(200),
          content: z
            .string()
            .trim()
            .min(10)
            .max(8000)
            .describe("The finding, with where it came from (file paths, test names, log lines)."),
          agent: agentName,
        }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      (input) => run(() => shareEvidence(input)),
    );
  },
  {
    serverInfo: { name: "roadwise", version: "0.1.0" },
    instructions: INSTRUCTIONS,
  },
);

async function authorized(req: Request) {
  return rejectUnauthorized(req) ?? handler(req);
}

export { authorized as DELETE, authorized as GET, authorized as POST };
