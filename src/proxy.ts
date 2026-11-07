import { NextResponse, type NextRequest } from "next/server";

import { EXPERT_COOKIE, hasExpertAccess } from "@/lib/auth/token";

// Optimistic gate for the signed-in app (expert console, product workspaces).
// Server Actions re-check with requireExpert().
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/expert/login") return NextResponse.next();

  if (await hasExpertAccess(request.cookies.get(EXPERT_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const login = new URL("/expert/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/expert", "/expert/:path*", "/products", "/products/:path*"],
};
