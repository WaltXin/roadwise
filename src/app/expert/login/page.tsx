import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/logo";

import { accessMode } from "@/lib/auth/token";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  const mode = accessMode();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40 px-4">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-16">
        <Link href="/" className="self-start rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Expert console</h1>
          <p className="text-sm text-muted-foreground">
            Domain experts curate the knowledge the consultant reasons from: sources, industry context, evaluation
            priorities, and research questions.
          </p>
        </div>
        {mode === "locked" ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            The console is locked because no passcode is configured. Set <code>EXPERT_PASSCODE</code> in the
            deployment&apos;s environment variables.
          </p>
        ) : (
          <Suspense>
            <LoginForm open={mode === "open"} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
