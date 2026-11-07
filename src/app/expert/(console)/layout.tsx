import type { Metadata } from "next";

import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = {
  title: "Expert console",
};

export default function ExpertLayout({ children }: LayoutProps<"/expert">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <AppHeader current="/expert" />
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
