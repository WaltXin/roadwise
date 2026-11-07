"use client";

import { PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileValue } from "@/db/schema";
import { confirmProfileField } from "@/lib/onboarding/actions";
import { BASIS_LABELS, PROFILE_FIELDS } from "@/lib/onboarding/profile";
import { cn } from "@/lib/utils";

const BASIS_STYLE: Record<ProfileValue["basis"], string> = {
  stated: "bg-muted text-muted-foreground",
  inferred: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  confirmed: "bg-brand-soft text-brand",
};

export function ProfilePanel({ productId, profile }: { productId: string; profile: Record<string, ProfileValue> }) {
  const known = PROFILE_FIELDS.filter((f) => profile[f.key]).length;
  return (
    <section aria-labelledby="profile-heading" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 id="profile-heading" className="font-medium">
          What Roadwise understands
        </h2>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">
            {known}/{PROFILE_FIELDS.length}
          </span>{" "}
          known · click to correct
        </p>
      </header>
      <dl className="divide-y">
        {PROFILE_FIELDS.map((field) => (
          <ProfileRow key={field.key} productId={productId} field={field} value={profile[field.key]} />
        ))}
      </dl>
    </section>
  );
}

function ProfileRow({
  productId,
  field,
  value,
}: {
  productId: string;
  field: (typeof PROFILE_FIELDS)[number];
  value?: ProfileValue;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.value ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await confirmProfileField(productId, field.key, draft);
      if (result.error) setError(result.error);
      else setEditing(false);
    });
  }

  return (
    <div className="group/row px-4 py-3">
      <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {field.label}
        {value && (
          <span className={cn("rounded-full px-1.5 py-px text-[0.65rem] font-medium", BASIS_STYLE[value.basis])}>
            {BASIS_LABELS[value.basis]}
          </span>
        )}
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value?.value ?? "");
              setEditing(true);
            }}
            className="ml-auto rounded p-0.5 text-muted-foreground opacity-100 transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
            aria-label={`Correct ${field.label}`}
          >
            <PencilIcon className="size-3.5" />
          </button>
        )}
      </dt>
      <dd className="mt-1 text-sm">
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              autoFocus
              aria-label={field.label}
              placeholder={field.hint}
            />
            {error && <p className="text-xs font-medium text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        ) : value ? (
          <p className="whitespace-pre-line text-foreground/90">{value.value}</p>
        ) : (
          <p className="text-muted-foreground/70">{field.hint}</p>
        )}
      </dd>
    </div>
  );
}
