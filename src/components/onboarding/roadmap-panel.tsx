"use client";

import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { KnowledgeRef, RoadmapItem } from "@/db/schema";
import { setRoadmapStatus } from "@/lib/onboarding/actions";
import { EVIDENCE_LABELS } from "@/lib/onboarding/profile";
import { cn } from "@/lib/utils";

import { RichText, type RefMap } from "./rich-text";

export const EVIDENCE_STYLE = {
  supported: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  contradicted: "bg-red-500/10 text-red-700 dark:text-red-400",
  unknown: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
} as const;

export function KnowledgeLinks({ refs }: { refs: KnowledgeRef[] }) {
  if (refs.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {refs.map((r) => (
        <li key={r.id} className="max-w-full">
          {r.url ? (
            <a
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
              title={r.label}
            >
              {r.label}
            </a>
          ) : (
            <span
              className="block truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              title={r.label}
            >
              {r.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function RoadmapPanel({ productId, items, refs }: { productId: string; items: RoadmapItem[]; refs: RefMap }) {
  const founder = items.filter((i) => i.origin === "founder");
  const suggested = items.filter((i) => i.origin === "roadwise");
  return (
    <section aria-labelledby="roadmap-heading" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <header className="border-b px-4 py-3">
        <h2 id="roadmap-heading" className="font-medium">
          Roadmap as hypotheses
        </h2>
        <p className="text-xs text-muted-foreground">
          Each item, rewritten as something evidence can support or contradict. Keep or drop as you go.
        </p>
      </header>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          Once Roadwise understands the product, it turns your roadmap into hypotheses here.
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          {founder.length > 0 && <Group title="From your roadmap" items={founder} productId={productId} refs={refs} />}
          {suggested.length > 0 && (
            <Group title="Suggested by Roadwise" items={suggested} productId={productId} refs={refs} />
          )}
        </div>
      )}
    </section>
  );
}

function Group({
  title,
  items,
  productId,
  refs,
}: {
  title: string;
  items: RoadmapItem[];
  productId: string;
  refs: RefMap;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <RoadmapCard key={item.id} item={item} productId={productId} refs={refs} />
        ))}
      </ul>
    </div>
  );
}

function RoadmapCard({ item, productId, refs }: { item: RoadmapItem; productId: string; refs: RefMap }) {
  const [pending, startTransition] = useTransition();
  const set = (status: "kept" | "dropped" | "proposed") =>
    startTransition(async () => {
      await setRoadmapStatus(productId, item.id, status);
    });

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg p-3 ring-1 ring-foreground/10",
        item.status === "dropped" && "opacity-55",
        item.status === "kept" && "ring-brand/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className={cn("text-sm font-medium", item.status === "dropped" && "line-through")}>{item.title}</h4>
        <span className={cn("rounded-full px-2 py-px text-xs font-medium", EVIDENCE_STYLE[item.evidenceStatus])}>
          {EVIDENCE_LABELS[item.evidenceStatus]}
        </span>
        {item.status === "kept" && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-brand">
            <CheckIcon className="size-3" /> Kept
          </span>
        )}
      </div>
      <RichText text={item.hypothesis} refs={refs} className="text-sm text-foreground/90" />
      {item.evidence && (
        <RichText text={`**Evidence:** ${item.evidence}`} refs={refs} className="text-xs text-muted-foreground" />
      )}
      {item.priorities.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Affects: </span>
          {item.priorities.join(", ")}
        </p>
      )}
      <KnowledgeLinks refs={item.refs} />
      <div className="flex justify-end gap-1">
        {item.status === "proposed" ? (
          <>
            <Button variant="ghost" size="xs" disabled={pending} onClick={() => set("dropped")}>
              <XIcon data-icon="inline-start" /> Drop
            </Button>
            <Button variant="outline" size="xs" disabled={pending} onClick={() => set("kept")}>
              <CheckIcon data-icon="inline-start" /> Keep
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="xs" disabled={pending} onClick={() => set("proposed")}>
            <RotateCcwIcon data-icon="inline-start" /> Undo
          </Button>
        )}
      </div>
    </li>
  );
}
