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

The four knowledge sections are defined once in [`src/lib/knowledge/sections.ts`](src/lib/knowledge/sections.ts). That config drives the forms, the list views and server-side validation. To add a field: add a column to [`src/db/schema.ts`](src/db/schema.ts), add the field to the section config, then run `npm run db:push`.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, Cache Components, Turbopack) + React 19
- TypeScript, Tailwind CSS v4, [shadcn/ui](https://ui.shadcn.com) (Base UI)
- Postgres on [Neon](https://neon.tech) via the Vercel Marketplace, [Drizzle ORM](https://orm.drizzle.team)
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
| `EXPERT_PASSCODE` | Shared passcode for the expert console. If unset, the console is open in local dev and locked in production. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:push` | Apply `src/db/schema.ts` to the database |
| `npm run db:seed` | Create the Voice AI domain skeleton (idempotent) |
| `npm run db:studio` | Browse the database in Drizzle Studio |

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
docs/                    Product docs (one-pager)
```
