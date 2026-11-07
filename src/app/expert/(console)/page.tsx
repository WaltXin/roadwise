import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { CreateDomain } from "@/components/expert/domain-form";
import { SECTION_ICONS } from "@/components/expert/section-icons";
import { listDomains } from "@/lib/knowledge/queries";
import { SECTION_KEYS, SECTIONS } from "@/lib/knowledge/sections";

export default function DomainsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Domains</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Each domain is an industry the consultant covers. A domain expert sets its foundations; the consultant
          researches continuously from there and proposes updates when it finds gaps.
        </p>
      </div>
      <Suspense fallback={<DomainListSkeleton />}>
        <DomainList />
      </Suspense>
    </div>
  );
}

async function DomainList() {
  const domains = await listDomains();

  return (
    <div className="flex flex-col gap-4">
      {domains.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          No domains yet. Create the first one — for the hackathon MVP, that&apos;s Voice AI.
        </p>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {domains.map((d) => (
          <li key={d.id}>
            <Link
              href={`/expert/${d.slug}`}
              className="group flex h-full flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:ring-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{d.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.summary || "No summary yet."}</p>
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <dl className="mt-auto grid grid-cols-2 gap-2">
                {SECTION_KEYS.map((key) => {
                  const Icon = SECTION_ICONS[key];
                  return (
                    <div key={key} className="rounded-lg bg-muted/60 px-2.5 py-2">
                      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Icon className="size-3" />
                        <span className="truncate">{SECTIONS[key].title}</span>
                      </dt>
                      <dd className="font-mono text-lg font-medium tabular-nums">{d.counts[key]}</dd>
                    </div>
                  );
                })}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
      <div>
        <CreateDomain />
      </div>
    </div>
  );
}

function DomainListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-40 animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />
    </div>
  );
}
