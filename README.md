# Roadwise

An always-on AI consultant that understands your industry, monitors your existing product, and uses evidence to recommend what to improve next. Starting domain: **Voice AI**.

See [`docs/one-pager.md`](docs/one-pager.md) for the full product brief.

## What's here

| Route | What it is |
| --- | --- |
| `/` | Landing page explaining the product |
| `/expert` | Expert console (passcode-protected): list and create domains |
| `/expert/[domain]` | Domain overview: foundation progress and domain details |
| `/expert/[domain]/sources` | Where the consultant looks; each source is _evidence_ or a _research lead_ |
| `/expert/[domain]/context` | Buyers, workflows, alternatives, purchasing criteria, failure modes |
| `/expert/[domain]/evaluation` | Ranked evaluation priorities, how each is measured, and guardrails |
| `/expert/[domain]/questions` | Research questions that could change a customer's roadmap |
| `/products` | Product onboarding: list and create products |
| `/products/new` | Share a product (description, roadmap, code, evidence); "Fill with demo" loads LiveKit's front-desk agent |
| `/products/[id]` | Onboarding workspace: chat with Roadwise, live profile, roadmap hypotheses, decision candidates, implementation reports |
| `/api/evals/suite`, `/api/evals/runs` | Verifier API: fetch a held-out suite, post measured results for a verdict |
| `/api/mcp` | Roadwise MCP server for coding agents (Claude Code, Codex): read the chosen decision, report the implementation |

The four knowledge sections are defined once in [`src/lib/knowledge/sections.ts`](src/lib/knowledge/sections.ts). That config drives the forms, the list views and server-side validation. To add a field: add a column to [`src/db/schema.ts`](src/db/schema.ts), add the field to the section config, then run `npm run db:push`.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Cache Components, Turbopack) + React 19
- TypeScript, Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com) (Base UI)
- Postgres on [Neon](https://neon.tech) via the Vercel Marketplace, [Drizzle ORM](https://orm.drizzle.team)
- Claude (Anthropic TypeScript SDK) for the onboarding agent
- Deployed on Vercel (pushes to `main` deploy to production)

## Getting started

```bash
npm install
vercel link             # once: links the folder to the Vercel project
vercel env pull .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string. Added by the Neon integration. |
| `EXPERT_PASSCODE` | Shared passcode for the signed-in app (expert console and product workspaces). If unset, it's open in local dev and locked in production. |
| `ANTHROPIC_API_KEY` | Claude API key for the onboarding agent. |
| `ROADWISE_MCP_TOKEN` | Bearer token for `/api/mcp`. If unset, the MCP server is open in local dev and off in production. |

## Connecting a coding agent

```bash
export ROADWISE_MCP_TOKEN=…   # from Vercel / the workspace owner

# Claude Code
claude mcp add --transport http roadwise https://roadwise-flax.vercel.app/api/mcp \
  --header "Authorization: Bearer $ROADWISE_MCP_TOKEN"
```

```toml
# Codex: ~/.codex/config.toml
[mcp_servers.roadwise]
url = "https://roadwise-flax.vercel.app/api/mcp"
bearer_token_env_var = "ROADWISE_MCP_TOKEN"
```

Then ask the agent: _"Use Roadwise to see the decision we chose for Front-Desk, implement it, and report back."_

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:push` | Apply `src/db/schema.ts` to the database |
| `npm run db:seed` | Create the Voice AI domain skeleton (idempotent) |
| `npm run db:import -- <file> [--dry-run]` | Load researched knowledge (e.g. `data/voice-ai/knowledge.json`), marked for expert review |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run verify -- --product <id> --repo <path> --base <ref> [--head <ref\|working>]` | Run the held-out eval suite on base/head through the product's harness and get a verdict |

## Layout

```
src/app/                 Routes: landing page, expert console, login
src/components/expert/   Console UI (forms, entry cards, navigation)
src/components/ui/       shadcn/ui primitives
src/db/                  Drizzle schema and client
src/lib/knowledge/       Section config, queries, Server Actions
src/lib/auth/            Expert passcode gate
src/proxy.ts             Redirects console pages to login when signed out
scripts/seed.ts          Voice AI seed data
data/voice-ai/           Researched Voice AI knowledge (sources, context, evaluation, questions)
docs/                    Product docs (one-pager) and research notes (docs/research/)
```
