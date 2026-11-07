"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { requireExpert } from "@/lib/auth/server";
import { OnboardingError } from "@/lib/onboarding/agent";

import { generateSuite } from "./generate";

export async function generateEvalSuite(productId: string): Promise<{ error?: string }> {
  await requireExpert();
  if (!z.uuid().safeParse(productId).success) return { error: "Unknown product." };
  try {
    await generateSuite(productId);
  } catch (err) {
    if (err instanceof OnboardingError) return { error: err.message };
    console.error(err);
    return { error: "Writing the suite failed. Try again." };
  }
  refresh();
  return {};
}
