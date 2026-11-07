import { LogOutIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";

export const metadata: Metadata = {
  title: "Expert console",
};

export default function ExpertLayout({ children }: LayoutProps<"/expert">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo />
          </Link>
          <span className="text-muted-foreground" aria-hidden>
            /
          </span>
          <Link href="/expert" className="text-sm font-medium hover:underline">
            Expert console
          </Link>
          <form action={logout} className="ml-auto">
            <Button variant="ghost" size="sm" type="submit">
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</div>
    </div>
  );
}
