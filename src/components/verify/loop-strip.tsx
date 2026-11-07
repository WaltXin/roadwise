import { BookOpenIcon, CheckCircle2Icon, CodeIcon, FlagIcon, SearchIcon, ShieldCheckIcon } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

export type LoopStage = {
  key: string;
  label: string;
  title: string;
  detail: string;
  done: boolean;
  tone?: "good" | "bad" | "neutral";
};

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  signal: BookOpenIcon,
  finding: SearchIcon,
  decision: FlagIcon,
  implemented: CodeIcon,
  verified: ShieldCheckIcon,
};

/** The decision loop, one card per stage: what Roadwise knew → found → decided → shipped → verified. */
export function LoopStrip({ stages }: { stages: LoopStage[] }) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {stages.map((s, i) => {
        const Icon = ICONS[s.key] ?? CheckCircle2Icon;
        return (
          <li key={s.key} className="relative">
            <div
              className={cn(
                "flex h-full flex-col gap-1.5 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10",
                !s.done && "opacity-50",
                s.tone === "good" && "ring-2 ring-emerald-500/40",
                s.tone === "bad" && "ring-2 ring-red-500/40",
              )}
            >
              <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon className="size-3" />
                </span>
                {i + 1}. {s.label}
              </p>
              <p className="text-sm leading-snug font-semibold text-pretty">{s.title}</p>
              <p className="text-xs leading-snug text-muted-foreground">{s.detail}</p>
            </div>
            {i < stages.length - 1 && (
              <span
                aria-hidden
                className="absolute top-1/2 -right-2 z-10 hidden size-4 -translate-y-1/2 items-center justify-center rounded-full bg-background text-xs text-muted-foreground ring-1 ring-foreground/10 lg:flex"
              >
                ›
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
