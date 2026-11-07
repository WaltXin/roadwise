import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { EXPERT_COOKIE, hasExpertAccess } from "./token";

/** Call at the top of every Server Action that changes knowledge. */
export async function requireExpert() {
  const value = (await cookies()).get(EXPERT_COOKIE)?.value;
  if (!(await hasExpertAccess(value))) redirect("/expert/login");
}
