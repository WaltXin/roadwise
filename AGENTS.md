<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Roadwise

An always-on AI consultant that understands an industry, monitors a customer's existing product, and uses evidence to recommend what to improve next — then follows up to check whether the recommendation helped. First domain: **Voice AI**. Full brief: [`docs/one-pager.md`](docs/one-pager.md) (snapshot of the founder's Google Doc, which is the source of truth).

## The goal: a hackathon demo

This is a **hackathon MVP**. Success means showing **one credible, traceable decision loop** end to end:

> industry signal → product-specific hypothesis → independent evaluation → roadmap recommendation that **changes when the evidence changes**

Not universal expertise, and no business impact that hasn't been measured. When choosing what to build next, pick the smallest thing that moves the demo loop forward.

MVP roadmap (from the one-pager):

1. Initialize the Voice AI domain with curated sources and a clear industry framework. ← **framework built; AI-researched knowledge imported (2026-11-07) and awaiting expert review**
2. Onboard one existing product and identify one consequential roadmap decision. ← **built: `/products` onboarding (demo product: LiveKit's front-desk booking agent)**
3. Generate an evidence-backed recommendation combining industry intelligence with product-specific findings.
4. Evaluate independently using predefined acceptance criteria and held-out scenarios.
5. Update the roadmap and preserve the recommendation, decision, evidence, and follow-up result.

## Product principles (apply to code, copy, and AI output)

- **Every recommendation records the full chain:** what we observed → why it matters here → what we recommend → how to test it → what would change our conclusion.
- **Claims are leads, not facts.** Vendor announcements and event talks are things to investigate (sources have `treatment: "lead"` vs `"evidence"`).
- **A new capability triggers an investigation, not an adoption.** E.g. new interruption handling → check whether interruptions cause failures in *this* customer's calls.
- **Evaluate decisions on complete user journeys.** Weigh benefits against regressions, effort, and cost vs. goals set up front. Faster calls only count if bookings still complete correctly.
- **The advice is evaluated too:** are claims supported, does it fit the customer, did later evidence support it?
- **Missing evidence stays explicitly unresolved** — never fill gaps with plausible-sounding content.
- **Never invent domain knowledge or metrics.** Every knowledge entry needs a real, checked source. AI research may *propose* knowledge, but it is stored with `origin: "ai"` ("AI-researched · needs review") until a domain expert verifies it and switches it to Expert-curated. Landing copy contains only what the one-pager states.
- **Attribute numbers.** Vendor-reported figures say so ("per LiveKit, vendor-reported"); write knowledge in neutral third person, never as the researcher ("I found…").
- **Provenance matters:** keep sources and dates attached to knowledge.

## What exists today

- `/` — landing page explaining the product (static).
- `/expert` — expert console, gated by a shared passcode (`EXPERT_PASSCODE`). A domain expert curates four sections per domain: **sources**, **industry context** (buyers, workflows, alternatives, purchasing criteria, failure modes), **evaluation priorities** (ranked, with measure + guardrail), **research questions**.
- Voice AI knowledge base: ~83 sources, 36 context entries, 6 evaluation priorities with measures and guardrails, 16 research questions — researched 2026-11-07, stored in `data/voice-ai/knowledge.json`, imported with `npm run db:import`, all marked for expert review.
- Research notes: [`docs/research/coval.md`](docs/research/coval.md) — how Coval (voice agent simulation/eval platform) works, comparable tools, and implications: Roadwise should orchestrate eval platforms for the "how to test it" step, not rebuild them.
- `/products` — product onboarding. A founder shares a description, roadmap, code and evidence; Roadwise (Claude) reads it, fills a live profile, interviews for what's missing, rewrites the roadmap as hypotheses with evidence status, and proposes 2–3 candidate decisions recorded as the full chain. The founder corrects the profile, keeps/drops items, and chooses one decision. "Fill with demo" loads LiveKit's open-source `frontdesk` booking agent (real code + scenarios; illustrative roadmap/notes).
- Not built yet: code-change detection (GitHub), running evaluations, follow-up verdicts, continuous signal ingestion.

## Architecture

- **Next.js 16** App Router with **Cache Components** on (`cacheComponents: true`), React 19, TypeScript, Tailwind v4, shadcn/ui on **Base UI** (use the `render` prop, not `asChild`).
- **Neon Postgres** (Vercel Marketplace) + **Drizzle ORM**. Schema in `src/db/schema.ts`; `getDb()` in `src/db/index.ts` is lazy so builds work without `DATABASE_URL`.
- **Section config is the single source of truth** for the knowledge base: `src/lib/knowledge/sections.ts` drives forms, list views, and server-side validation (`parseEntry` in `server.ts` builds Zod schemas from it). Enum values live in `enums.ts` and feed both `pgEnum`s and the UI.
- Reads: `src/lib/knowledge/queries.ts` (server-only). Writes: Server Actions in `src/lib/knowledge/actions.ts`.
- Auth: `src/proxy.ts` (Next 16's renamed middleware) redirects signed-out visits to `/expert/*` and `/products/*` to `/expert/login`; every mutating Server Action must call `requireExpert()` first.
- **Onboarding agent** (`src/lib/onboarding/agent.ts`): Anthropic TypeScript SDK, `claude-opus-5-5`, adaptive thinking, effort `medium`, streaming + `finalMessage()`, server-side refusal fallback (`fallbacks: "default"`). A manual tool loop with three tools — `update_profile`, `save_roadmap_item`, `propose_decision` — that write structured state to Postgres; tool inputs are validated with Zod. The domain knowledge base is rendered into the system prompt with short citable refs (`[C12]`, `[E2]`) by `knowledge-context.ts` (cached with `use cache`, tag expired by expert edits).
- **Conversation storage is append-only** (`onboarding_messages`, `json` column): turns are stored exactly as sent/received (incl. thinking and tool blocks) and replayed unchanged — never edit or delete earlier turns (breaks preserved thinking and the prompt cache). Panel edits are appended as `note` messages so the model sees them next turn.

## Conventions

- **Cache Components:** any component that reads the database or `params`/`cookies` must sit inside `<Suspense>`; query helpers call `await connection()`. After a mutation, Server Actions call `refresh()`. Pages are a sync shell plus an async child (see `src/app/expert/(console)/[slug]/page.tsx`).
- **Adding a knowledge field:** add the column in `schema.ts`, add the field to the section in `sections.ts`, run `npm run db:push`. No form or validation code changes needed.
- **Adding researched knowledge:** edit `data/<domain>/knowledge.json` (sources with `key`; context/questions reference them via `sourceKey`), dry-run with `npm run db:import -- data/<domain>/knowledge.json --dry-run`, then import. The importer is idempotent, marks rows `origin: "ai"`, and never overwrites expert text (evaluation priorities only get empty fields filled). Verify URLs resolve before importing.
- Every knowledge table has `origin` (`expert` | `ai`); the overview shows "N to review" per section.
- Server Actions validate everything (IDs as UUIDs, domain ownership of referenced rows) and return `FormState` for `useActionState` forms.
- `buttonVariants()` merges conflicting classes, so links styled as buttons work: `<Link className={buttonVariants({ variant: "outline" })}>`.
- Brand accent tokens: `bg-brand`, `text-brand`, `bg-brand-soft` (defined in `globals.css`).
- Format with Prettier at print width 120. Keep `npm run lint`, `npm run typecheck`, and `npm run build` passing.

## Commands

```bash
npm run dev            # dev server (needs .env.local: `vercel env pull .env.local`)
npm run build          # production build
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit (run `npx next typegen` first if route types are stale)
npm run db:push        # apply schema to Neon
npm run db:seed        # Voice AI skeleton (idempotent)
npm run db:import -- data/voice-ai/knowledge.json [--dry-run]   # load researched knowledge
npm run db:studio      # browse the database
```

## Deployment and workflow

- Vercel project `waltxins-projects/roadwise`; production is https://roadwise-flax.vercel.app. **Pushing to `main` deploys to production.**
- Env vars live in Vercel (`DATABASE_URL`, `EXPERT_PASSCODE`, `ANTHROPIC_API_KEY`, …); never commit `.env*` or secrets.
- Onboarding turns take ~30–70 s (several model calls with tools); `/products/[id]` sets `maxDuration = 300` for its Server Actions, and the chat polls `router.refresh()` while a turn runs so the panels fill in live.
- The owner directs git steps explicitly: commit, merge to `main`, and push only when asked. Do work on a branch and fast-forward `main`.
