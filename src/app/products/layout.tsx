import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: { default: "Products", template: "%s · Roadwise" },
};

export default function ProductsLayout({ children }: LayoutProps<"/products">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <AppHeader current="/products" wide />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
