"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDomain, updateDomain, type FormState } from "@/lib/knowledge/actions";

import { SubmitButton } from "./submit-button";

const initialState: FormState = { status: "idle" };

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs font-medium text-destructive">{message}</p> : null;
}

export function CreateDomain() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createDomain, initialState);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        New domain
      </Button>
    );
  }

  const v = state.values ?? {};
  return (
    <form
      key={state.submittedAt ?? 0}
      action={action}
      className="flex w-full flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/15"
    >
      <p className="text-sm font-medium">New domain</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="domain-name">Name</Label>
          <Input id="domain-name" name="name" required autoFocus defaultValue={v.name} placeholder="e.g. Voice AI" />
          <FieldError message={state.fieldErrors?.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="domain-slug">URL slug</Label>
          <Input id="domain-slug" name="slug" defaultValue={v.slug} placeholder="Generated from the name" />
          <FieldError message={state.fieldErrors?.slug} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="domain-summary">Summary</Label>
          <Textarea
            id="domain-summary"
            name="summary"
            rows={2}
            defaultValue={v.summary}
            placeholder="What this domain covers, in a sentence or two."
          />
          <FieldError message={state.fieldErrors?.summary} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Creating…">Create domain</SubmitButton>
      </div>
    </form>
  );
}

export function EditDomain({ domain }: { domain: { id: string; name: string; summary: string } }) {
  const [state, action] = useActionState(updateDomain, initialState);
  const v = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form key={state.submittedAt ?? 0} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="_id" value={domain.id} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="domain-name">Name</Label>
        <Input id="domain-name" name="name" required defaultValue={v.name ?? domain.name} />
        <FieldError message={state.fieldErrors?.name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="domain-summary">Summary</Label>
        <Textarea
          id="domain-summary"
          name="summary"
          rows={3}
          defaultValue={v.summary ?? domain.summary}
          placeholder="What this domain covers, who the customers are, and what is in or out of scope."
        />
        <FieldError message={state.fieldErrors?.summary} />
      </div>
      <div className="flex items-center justify-end gap-3">
        {state.status === "success" && (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground" role="status">
            <CheckIcon className="size-4" /> Saved
          </span>
        )}
        <SubmitButton variant="outline">Save</SubmitButton>
      </div>
    </form>
  );
}
