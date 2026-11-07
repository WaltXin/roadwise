"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { SubmitButton } from "@/components/expert/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, type LoginState } from "@/lib/auth/actions";

export function LoginForm({ open }: { open: boolean }) {
  const next = useSearchParams().get("next") ?? "/expert";
  const [state, action] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <input type="hidden" name="next" value={next} />
      {open ? (
        <p className="text-sm text-muted-foreground">
          No passcode is configured, so the console is open in local development.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="passcode">Passcode</Label>
          <Input
            id="passcode"
            name="passcode"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            aria-invalid={state.error ? true : undefined}
          />
          {state.error && <p className="text-xs font-medium text-destructive">{state.error}</p>}
        </div>
      )}
      <SubmitButton pendingLabel="Signing in…">{open ? "Continue" : "Sign in"}</SubmitButton>
    </form>
  );
}
