import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load .env.local — run via `npm run db:push`, which wraps it with dotenv.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
