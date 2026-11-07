"use client";

import { SparklesIcon } from "lucide-react";
import { useActionState, useRef } from "react";

import { SubmitButton } from "@/components/expert/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, type CreateProductState } from "@/lib/onboarding/actions";

type Demo = { name: string; summary: string; repoUrl: string; roadmap: string; code: string; evidence: string };

const FIELDS = [
  {
    name: "roadmap",
    label: "Current roadmap",
    help: "Paste it as text — a list, a Notion page, Linear issues. Roadwise turns each item into a hypothesis.",
    rows: 6,
  },
  {
    name: "code",
    label: "Code or configuration",
    help: "The agent's main file, prompt, or config. Roadwise reads how it's built instead of asking.",
    rows: 6,
  },
  {
    name: "evidence",
    label: "Evidence",
    help: "Call transcripts, eval or test results, metrics, customer feedback. Anecdotes are fine — they'll be marked as such.",
    rows: 6,
  },
] as const;

export function NewProductForm({ domains, demo }: { domains: { id: string; name: string }[]; demo: Demo }) {
  const [state, action] = useActionState<CreateProductState, FormData>(createProduct, {});
  const formRef = useRef<HTMLFormElement>(null);
  const v = state.values ?? {};
  const err = state.fieldErrors ?? {};
  const voiceDomain = domains.find((d) => d.name.toLowerCase().includes("voice"))?.id ?? domains[0]?.id;

  function fillDemo() {
    const form = formRef.current;
    if (!form) return;
    const set = (name: string, value: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el) el.value = value;
    };
    set("name", demo.name);
    set("summary", demo.summary);
    set("repoUrl", demo.repoUrl);
    set("roadmap", demo.roadmap);
    set("code", demo.code);
    set("evidence", demo.evidence);
    if (voiceDomain) set("domainId", voiceDomain);
  }

  return (
    <form
      ref={formRef}
      key={state.values ? JSON.stringify(state.values).length : 0}
      action={action}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft/60 p-4 text-sm ring-1 ring-brand/15">
        <SparklesIcon className="size-4 shrink-0 text-brand" />
        <p className="min-w-0 flex-1 text-foreground/80">
          Trying it out? Load <span className="font-medium text-foreground">Front-Desk</span>, a booking voice agent
          from LiveKit&apos;s open-source examples, with an illustrative roadmap.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={fillDemo}>
          Fill with demo
        </Button>
      </div>

      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Product name</Label>
            <Input id="name" name="name" required defaultValue={v.name} aria-invalid={err.name ? true : undefined} />
            {err.name && <p className="text-xs font-medium text-destructive">{err.name}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domainId">Industry</Label>
            <NativeSelect id="domainId" name="domainId" defaultValue={v.domainId || voiceDomain}>
              {domains.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            {err.domainId && <p className="text-xs font-medium text-destructive">{err.domainId}</p>}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="summary">What it does</Label>
            <Textarea
              id="summary"
              name="summary"
              rows={3}
              required
              defaultValue={v.summary}
              placeholder="Who it's for, what it does for them, and how it's built — a few sentences is enough."
              aria-invalid={err.summary ? true : undefined}
            />
            {err.summary && <p className="text-xs font-medium text-destructive">{err.summary}</p>}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="repoUrl">Repository (optional)</Label>
            <Input
              id="repoUrl"
              name="repoUrl"
              type="url"
              defaultValue={v.repoUrl}
              placeholder="https://github.com/…"
              aria-invalid={err.repoUrl ? true : undefined}
            />
            {err.repoUrl ? (
              <p className="text-xs font-medium text-destructive">{err.repoUrl}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Used later to detect when a decision ships.</p>
            )}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-medium">What you already have</h2>
        {FIELDS.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Textarea
              id={f.name}
              name={f.name}
              rows={f.rows}
              defaultValue={v[f.name]}
              className="max-h-72 font-mono text-xs md:text-xs"
              aria-invalid={err[f.name] ? true : undefined}
            />
            <p className={err[f.name] ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
              {err[f.name] ?? f.help}
            </p>
          </div>
        ))}
      </section>

      {state.error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel="Creating…">
          Continue to onboarding
        </SubmitButton>
      </div>
    </form>
  );
}
