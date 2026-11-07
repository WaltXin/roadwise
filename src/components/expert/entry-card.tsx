"use client";

import { ExternalLinkIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteEntry } from "@/lib/knowledge/actions";
import {
  fieldLabel,
  findOption,
  SECTIONS,
  type EntryValues,
  type SectionKey,
  type SelectOption,
} from "@/lib/knowledge/sections";

import { EntryForm } from "./entry-form";
import { SubmitButton } from "./submit-button";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

type Props = {
  sectionKey: SectionKey;
  domainId: string;
  entry: EntryValues;
  sourceOptions: SelectOption[];
};

export function EntryCard({ sectionKey, domainId, entry, sourceOptions }: Props) {
  const section = SECTIONS[sectionKey];
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const closeEditor = useCallback(() => setMode("view"), []);

  if (mode === "edit") {
    return (
      <li className="rounded-xl bg-card p-4 ring-1 ring-foreground/15">
        <EntryForm
          sectionKey={sectionKey}
          domainId={domainId}
          entry={entry}
          sourceOptions={sourceOptions}
          onDone={closeEditor}
        />
      </li>
    );
  }

  const title = String(entry[section.titleField] ?? "");
  const badges = section.badgeFields
    .filter((name) => entry[name] && name !== section.groupBy)
    .map((name) => {
      const value = String(entry[name]);
      const option = findOption(section, name, value);
      return { name, label: option?.label ?? value, tone: option?.badge };
    })
    .filter((b) => b.tone !== "hidden");

  const urlField = section.fields.find((f) => f.kind === "url");
  const url = urlField ? (entry[urlField.name] as string | null) : null;
  const sourceField = section.fields.find((f) => f.kind === "source");
  const source = sourceField ? sourceOptions.find((o) => o.value === entry[sourceField.name]) : undefined;
  const rankField = section.fields.find((f) => f.kind === "number");
  const rank = rankField ? entry[rankField.name] : null;

  return (
    <li className="group/entry rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-shadow hover:ring-foreground/20">
      <div className="flex items-start gap-3">
        {rank !== null && rank !== undefined && (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-medium">
            {rank}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-medium text-pretty">{title}</h3>
            {badges.map((b) => (
              <Badge
                key={b.name}
                variant={b.tone === "caution" ? "outline" : "secondary"}
                className={b.tone === "caution" ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : undefined}
              >
                {b.label}
              </Badge>
            ))}
          </div>

          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
              <ExternalLinkIcon className="size-3 shrink-0" />
            </a>
          )}

          {section.bodyFields.map((name) => {
            const value = entry[name];
            if (!value) return null;
            const showLabel = section.bodyFields.length > 1;
            return (
              <div key={name} className="mt-2">
                {showLabel && <p className="text-xs font-medium text-muted-foreground">{fieldLabel(section, name)}</p>}
                <p className="text-sm whitespace-pre-line text-foreground/90">{value}</p>
              </div>
            );
          })}

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {source &&
              (source.href ? (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 underline-offset-2 hover:text-foreground hover:underline"
                >
                  <LinkIcon className="size-3 shrink-0" /> <span className="truncate">{source.label}</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <LinkIcon className="size-3" /> {source.label}
                </span>
              ))}
            {typeof entry.createdAt === "string" && <span>Added {formatDate(entry.createdAt)}</span>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/entry:opacity-100 sm:group-focus-within/entry:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${section.singular}`}
            onClick={() => setMode("edit")}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${section.singular}`}
            onClick={() => setMode("confirm-delete")}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {mode === "confirm-delete" && (
        <form action={deleteEntry} className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
          <input type="hidden" name="_section" value={sectionKey} />
          <input type="hidden" name="_domainId" value={domainId} />
          <input type="hidden" name="_id" value={entry.id} />
          <p className="mr-auto text-sm text-muted-foreground">Delete this {section.singular}?</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <SubmitButton variant="destructive" size="sm" pendingLabel="Deleting…">
            Delete
          </SubmitButton>
        </form>
      )}
    </li>
  );
}
