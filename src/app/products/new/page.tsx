import type { Metadata } from "next";
import { Suspense } from "react";

import { NewProductForm } from "@/components/onboarding/new-product-form";
import { FRONTDESK_DEMO } from "@/lib/onboarding/demo-frontdesk";
import { listDomainOptions } from "@/lib/onboarding/queries";

export const metadata: Metadata = {
  title: "Onboard a product",
};

export default function NewProductPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Onboard a product</h1>
        <p className="text-sm text-muted-foreground">
          Share what you already have — everything except the description is optional. Roadwise reads it before asking
          anything, so the more you share, the fewer questions you&apos;ll get.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-card ring-1 ring-foreground/10" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  const domains = await listDomainOptions();
  return <NewProductForm domains={domains} demo={FRONTDESK_DEMO} />;
}
