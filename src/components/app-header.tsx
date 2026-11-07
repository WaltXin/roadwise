import { LogOutIcon } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/products", label: "Products" },
  { href: "/expert", label: "Expert console" },
] as const;

/** Header for the signed-in app: product workspaces and the expert console. */
export function AppHeader({ current, wide }: { current: "/products" | "/expert"; wide?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className={cn("mx-auto flex h-14 items-center gap-4 px-4", wide ? "max-w-7xl" : "max-w-6xl")}>
        <Link href="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <nav aria-label="App" className="flex items-center gap-1 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? "page" : undefined}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                current === item.href && "font-medium text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="ml-auto">
          <Button variant="ghost" size="sm" type="submit" aria-label="Sign out">
            <LogOutIcon data-icon="inline-start" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
