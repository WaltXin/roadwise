"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { accessMode, EXPERT_COOKIE, expertToken, safeNextPath } from "./token";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const next = safeNextPath(formData.get("next"));
  const mode = accessMode();

  if (mode === "open") redirect(next);
  if (mode === "locked") return { error: "The console is locked: EXPERT_PASSCODE is not configured." };

  const passcode = String(formData.get("passcode") ?? "");
  const expected = await expertToken(process.env.EXPERT_PASSCODE!);
  if ((await expertToken(passcode)) !== expected) {
    return { error: "That passcode is not correct." };
  }

  (await cookies()).set(EXPERT_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(EXPERT_COOKIE);
  redirect("/");
}
