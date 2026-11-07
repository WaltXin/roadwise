import { safeEqual } from "@/lib/auth/token";

/**
 * One shared bearer token (ROADWISE_MCP_TOKEN) guards Roadwise's machine endpoints: the MCP
 * server and the verifier API. Open in local dev when unset; off in production.
 * Returns a Response to send back when the request isn't allowed, or null when it is.
 */
export function rejectUnauthorized(req: Request): Response | null {
  const token = process.env.ROADWISE_MCP_TOKEN;
  if (!token) {
    return process.env.NODE_ENV === "production"
      ? Response.json({ error: "Roadwise's API is not configured." }, { status: 503 })
      : null;
  }
  const bearer = req.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();
  if (!bearer || !safeEqual(bearer, token)) {
    return Response.json({ error: "Missing or invalid bearer token." }, { status: 401 });
  }
  return null;
}
