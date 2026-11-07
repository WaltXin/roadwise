import { ArrowRightIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { listProducts } from "@/lib/onboarding/queries";

export default function ProductsPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Onboard an existing product: share what you have, talk it through with Roadwise, and leave with the one
            roadmap decision most worth investigating first.
          </p>
        </div>
        <Link href="/products/new" className={buttonVariants()}>
          <PlusIcon data-icon="inline-start" />
          Onboard a product
        </Link>
      </div>
      <Suspense fallback={<div className="h-32 animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />}>
        <ProductList />
      </Suspense>
    </div>
  );
}

async function ProductList() {
  const rows = await listProducts();
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        No products yet. Onboard the first one — there&apos;s a demo voice agent you can load with one click.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((p) => (
        <li key={p.id}>
          <Link
            href={`/products/${p.id}`}
            className="group flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{p.name}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{p.domainName}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
            </div>
            <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
