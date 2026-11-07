// Seeds the Voice AI domain skeleton from the one-pager (docs/one-pager.md).
// Idempotent: does nothing if the domain already exists.
// Run with: npm run db:seed

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { domains, evaluationPriorities, researchQuestions } from "../src/db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = drizzle(neon(url));

const PRIORITIES = ["Task completion", "Latency", "Interruptions", "Escalation", "Reliability", "Cost"];

async function main() {
  const [domain] = await db
    .insert(domains)
    .values({
      slug: "voice-ai",
      name: "Voice AI",
      summary:
        "Products that use AI agents to hold spoken conversations with customers — for example phone agents that answer, book, and escalate calls.",
    })
    .onConflictDoNothing({ target: domains.slug })
    .returning({ id: domains.id });

  if (!domain) {
    console.log("Voice AI domain already exists — nothing to do.");
    return;
  }

  await db
    .insert(evaluationPriorities)
    .values(PRIORITIES.map((name, i) => ({ domainId: domain.id, name, rank: i + 1 })));
  await db.insert(researchQuestions).values({
    domainId: domain.id,
    question: "Which developments could materially affect a customer's product or roadmap?",
  });

  console.log("Seeded the Voice AI domain.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
