import { LightbulbIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AddEntry } from "@/components/expert/add-entry";
import { EntryCard } from "@/components/expert/entry-card";
import { getDomain, getSectionEntries, getSourceOptions } from "@/lib/knowledge/queries";
import { isSectionKey, SECTIONS, type EntryValues, type SectionDef } from "@/lib/knowledge/sections";

export default function SectionPage({ params }: PageProps<"/expert/[slug]/[section]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Section params={params} />
    </Suspense>
  );
}

async function Section({ params }: { params: Promise<{ slug: string; section: string }> }) {
  const { slug, section: sectionKey } = await params;
  if (!isSectionKey(sectionKey)) notFound();
  const domain = await getDomain(slug);
  if (!domain) notFound();

  const section = SECTIONS[sectionKey];
  const needsSources = section.fields.some((f) => f.kind === "source");
  const [entries, sourceOptions] = await Promise.all([
    getSectionEntries(domain.id, sectionKey),
    needsSources ? getSourceOptions(domain.id) : Promise.resolve([]),
  ]);

  const shared = { sectionKey, domainId: domain.id, sourceOptions };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{section.title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{section.description}</p>
      </div>

      <aside className="flex gap-3 rounded-xl bg-brand-soft/60 p-4 text-sm ring-1 ring-brand/15">
        <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-brand" />
        <ul className="flex flex-col gap-1 text-foreground/80">
          {section.guidance.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </aside>

      {section.groupBy ? (
        <GroupedEntries section={section} entries={entries} shared={shared} />
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <AddEntry {...shared} />
          </div>
          {entries.length === 0 ? (
            <EmptyState section={section} />
          ) : (
            <ul className="flex flex-col gap-3">
              {entries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} {...shared} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type Shared = Omit<React.ComponentProps<typeof EntryCard>, "entry">;

function GroupedEntries({ section, entries, shared }: { section: SectionDef; entries: EntryValues[]; shared: Shared }) {
  const groupField = section.fields.find((f) => f.name === section.groupBy);
  if (groupField?.kind !== "select") return null;

  return (
    <div className="flex flex-col gap-8">
      {groupField.options.map((option) => {
        const items = entries.filter((e) => e[groupField.name] === option.value);
        return (
          <section key={option.value} aria-labelledby={`group-${option.value}`} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id={`group-${option.value}`} className="font-medium">
                  {option.label}{" "}
                  <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">
                    {items.length}
                  </span>
                </h2>
                {option.hint && <p className="text-sm text-muted-foreground">{option.hint}</p>}
              </div>
            </div>
            {items.length > 0 && (
              <ul className="flex flex-col gap-3">
                {items.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} {...shared} />
                ))}
              </ul>
            )}
            <div>
              <AddEntry
                {...shared}
                variant="ghost"
                label={`Add to ${option.label.toLowerCase()}`}
                presets={{ [groupField.name]: option.value }}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function EmptyState({ section }: { section: SectionDef }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
      No {section.plural} yet. Add the first one above.
    </p>
  );
}
