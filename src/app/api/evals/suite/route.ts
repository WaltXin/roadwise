import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { evalSuites } from "@/db/schema";
import { rejectUnauthorized } from "@/lib/api-auth";

// The verifier fetches the latest held-out suite for a product. Not exposed over MCP: the
// coding agent that implements a change never sees the scenarios it will be judged on.
export async function GET(req: Request) {
  const denied = rejectUnauthorized(req);
  if (denied) return denied;
  const productId = new URL(req.url).searchParams.get("product");
  if (!z.uuid().safeParse(productId).success) {
    return Response.json({ error: "Pass ?product=<product id>." }, { status: 400 });
  }
  const [suite] = await getDb()
    .select()
    .from(evalSuites)
    .where(eq(evalSuites.productId, productId!))
    .orderBy(desc(evalSuites.createdAt))
    .limit(1);
  if (!suite) return Response.json({ error: "No eval suite for this product yet." }, { status: 404 });
  return Response.json({ suite_id: suite.id, connector: suite.connector, scenarios: suite.scenarios });
}
