import { ArrowRightIcon, CheckCircle2Icon, CircleIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditDomain } from "@/components/expert/domain-form";
import { SECTION_ICONS } from "@/components/expert/section-icons";
import { getDomain, getSectionCounts } from "@/lib/knowledge/queries";
import { SECTION_KEYS, SECTIONS } from "@/lib/knowledge/sections";

export default function DomainOverviewPage({ params }: PageProps<"/expert/[slug]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted" />}>
      <Overview params={params} />
    </Suspense>
  );
}

async function Overview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const domain = await getDomain(slug);
  if (!domain) notFound();
  const [counts, toReview] = await Promise.all([
    getSectionCounts(domain.id),
    getSectionCounts(domain.id, { needsReview: true }),
  ]);
  const ready = SECTION_KEYS.filter((k) => counts[k] > 0).length;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{domain.name}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The foundation the consultant reasons from, and cites in its recommendations. Domain experts curate it; AI
          research proposes additions, which stay marked for review until an expert verifies them.
        </p>
      </div>

      <section aria-labelledby="foundation" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="foundation" className="font-medium">
            Foundation
          </h2>
          <p className="text-sm text-muted-foreground">
            {ready} of {SECTION_KEYS.length} sections started
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {SECTION_KEYS.map((key) => {
            const section = SECTIONS[key];
            const Icon = SECTION_ICONS[key];
            const n = counts[key];
            return (
              <li key={key}>
                <Link
                  href={`/expert/${slug}/${key}`}
                  className="group flex h-full flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Icon className="size-4" />
                    </span>
                    <h3 className="font-medium">{section.title}</h3>
                    <ArrowRightIcon className="ml-auto size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                  <p className="mt-auto flex items-center gap-1.5 text-sm">
                    {n > 0 ? (
                      <CheckCircle2Icon className="size-4 text-brand" />
                    ) : (
                      <CircleIcon className="size-4 text-muted-foreground" />
                    )}
                    <span className="font-mono tabular-nums">{n}</span>
                    <span className="text-muted-foreground">{n === 1 ? section.singular : section.plural}</span>
                    {toReview[key] > 0 && (
                      <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        {toReview[key]} to review
                      </span>
                    )}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="details" className="flex flex-col gap-3">
        <h2 id="details" className="font-medium">
          Domain details
        </h2>
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <EditDomain domain={{ id: domain.id, name: domain.name, summary: domain.summary }} />
        </div>
      </section>
    </div>
  );
}
