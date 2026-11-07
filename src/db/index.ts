import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local` after provisioning Neon.");
  }
  return drizzle(neon(url), { schema });
}

let db: ReturnType<typeof createDb> | null = null;

/** Lazily created so `next build` works without DATABASE_URL. */
export function getDb() {
  db ??= createDb();
  return db;
}
