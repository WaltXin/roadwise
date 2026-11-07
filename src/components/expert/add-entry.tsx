"use client";

import { PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { SECTIONS, type SectionKey, type SelectOption } from "@/lib/knowledge/sections";

import { EntryForm } from "./entry-form";

type Props = {
  sectionKey: SectionKey;
  domainId: string;
  sourceOptions: SelectOption[];
  presets?: Record<string, string>;
  label?: string;
  variant?: "default" | "outline" | "ghost";
};

export function AddEntry({ sectionKey, domainId, sourceOptions, presets, label, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const section = SECTIONS[sectionKey];

  if (!open) {
    return (
      <Button variant={variant} onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        {label ?? `Add ${section.singular}`}
      </Button>
    );
  }

  return (
    <div className="w-full rounded-xl bg-card p-4 ring-1 ring-foreground/15">
      <p className="mb-4 text-sm font-medium">New {section.singular}</p>
      <EntryForm
        sectionKey={sectionKey}
        domainId={domainId}
        presets={presets}
        sourceOptions={sourceOptions}
        onDone={close}
      />
    </div>
  );
}
