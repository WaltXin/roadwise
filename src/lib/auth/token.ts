// Expert console access. A single shared passcode (EXPERT_PASSCODE) — enough for a
// hackathon demo. Uses Web Crypto so it runs in both the proxy and server code.

export const EXPERT_COOKIE = "roadwise_expert";

export async function expertToken(passcode: string) {
  const data = new TextEncoder().encode(`roadwise-expert:v1:${passcode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** "open" in local dev without a passcode; "locked" in production without one. */
export function accessMode(): "passcode" | "open" | "locked" {
  if (process.env.EXPERT_PASSCODE) return "passcode";
  return process.env.NODE_ENV === "production" ? "locked" : "open";
}

export async function hasExpertAccess(cookieValue: string | undefined) {
  const mode = accessMode();
  if (mode !== "passcode") return mode === "open";
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await expertToken(process.env.EXPERT_PASSCODE!));
}

/** Only allow redirects back into the signed-in app. */
export function safeNextPath(next: unknown) {
  return typeof next === "string" && /^\/(expert|products)(\/|$|\?)/.test(next) && !next.startsWith("//")
    ? next
    : "/expert";
}
