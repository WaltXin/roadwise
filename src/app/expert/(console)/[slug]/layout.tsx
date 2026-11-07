import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DomainNav } from "@/components/expert/domain-nav";
import { getDomain, getSectionCounts } from "@/lib/knowledge/queries";

export default function DomainLayout({ children, params }: LayoutProps<"/expert/[slug]">) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
      <aside className="lg:sticky lg:top-22 lg:w-56 lg:shrink-0 lg:self-start">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
          <Sidebar params={params} />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

async function Sidebar({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const domain = await getDomain(slug);
  if (!domain) notFound();
  const counts = await getSectionCounts(domain.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="px-2.5">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Domain</p>
        <p className="font-semibold">{domain.name}</p>
      </div>
      <DomainNav slug={slug} counts={counts} />
    </div>
  );
}
