import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { AgentConnectPanel } from "@/components/onboarding/agent-connect-panel";
import { ChatPanel } from "@/components/onboarding/chat-panel";
import { DecisionsPanel } from "@/components/onboarding/decisions-panel";
import { ProfilePanel } from "@/components/onboarding/profile-panel";
import { RoadmapPanel } from "@/components/onboarding/roadmap-panel";
import { appUrl } from "@/lib/app-url";
import { PROFILE_FIELDS } from "@/lib/onboarding/profile";
import { getWorkspace, type Workspace } from "@/lib/onboarding/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Onboarding",
};

// Roadwise turns (several model calls with tools) run inside this page's Server Actions.
export const maxDuration = 300;

export default function ProductPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense fallback={<div className="h-[70vh] animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />}>
      <ProductWorkspace params={params} />
    </Suspense>
  );
}

async function ProductWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const ws = await getWorkspace(id);
  if (!ws) notFound();
  const { product } = ws;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <span className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium ring-1 ring-foreground/10">
            {product.domainName}
          </span>
          {product.repoUrl && (
            <a
              href={product.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Repository <ExternalLinkIcon className="size-3" />
            </a>
          )}
        </div>
        <Steps ws={ws} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="lg:sticky lg:top-20 lg:h-[calc(100dvh-7rem)] lg:self-start">
          <ChatPanel
            productId={product.id}
            productName={product.name}
            sharedTitles={ws.inputs.map((i) => i.title)}
            items={ws.chat}
            refs={ws.refs}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <DecisionsPanel
            productId={product.id}
            decisions={ws.decisions}
            implementations={ws.implementations}
            refs={ws.refs}
          />
          <AgentConnectPanel mcpUrl={appUrl("/api/mcp")} productName={product.name} />
          <ProfilePanel productId={product.id} profile={product.profile} />
          <RoadmapPanel productId={product.id} items={ws.roadmap} refs={ws.refs} />
        </div>
      </div>
    </div>
  );
}

function Steps({ ws }: { ws: Workspace }) {
  const known = PROFILE_FIELDS.filter((f) => ws.product.profile[f.key]).length;
  const selected = ws.decisions.find((d) => d.status === "selected");
  const steps = [
    { label: "Understand the product", done: known >= 6, detail: `${known}/${PROFILE_FIELDS.length} known` },
    { label: "Roadmap as hypotheses", done: ws.roadmap.length > 0, detail: `${ws.roadmap.length} items` },
    {
      label: "Choose the first decision",
      done: selected !== undefined,
      detail: `${ws.decisions.length} candidates`,
    },
    {
      label: "Implement",
      done: selected !== undefined && ws.implementations.some((i) => i.decisionId === selected.id),
      detail: "via coding agent",
    },
  ];
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2 text-sm">
          {s.done ? (
            <CheckCircle2Icon className="size-4 text-brand" />
          ) : (
            <CircleIcon className="size-4 text-muted-foreground" />
          )}
          <span className={cn(!s.done && "text-muted-foreground")}>
            {i + 1}. {s.label}
          </span>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{s.detail}</span>
        </li>
      ))}
    </ol>
  );
}
