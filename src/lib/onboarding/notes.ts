import "server-only";

import { eq, max } from "drizzle-orm";

import { getDb } from "@/db";
import { onboardingMessages } from "@/db/schema";

/**
 * Records a panel edit as a founder message in the conversation, so Roadwise sees it on
 * its next turn. Appended (never edited in) to keep the history replayable.
 */
export async function appendNote(productId: string, text: string) {
  const db = getDb();
  const [{ last }] = await db
    .select({ last: max(onboardingMessages.seq) })
    .from(onboardingMessages)
    .where(eq(onboardingMessages.productId, productId));
  // Nothing to annotate before the conversation starts; the panel state is the record.
  if (last === null) return;
  await db.insert(onboardingMessages).values({ productId, role: "user", kind: "note", content: text, seq: last + 1 });
}
