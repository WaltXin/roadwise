"use client";

import { LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SectionCounts } from "@/lib/knowledge/queries";
import { SECTION_KEYS, SECTIONS } from "@/lib/knowledge/sections";
import { cn } from "@/lib/utils";

import { SECTION_ICONS as ICONS } from "./section-icons";

export function DomainNav({ slug, counts }: { slug: string; counts: SectionCounts }) {
  const pathname = usePathname();
  const base = `/expert/${slug}`;
  const items = [
    { href: base, label: "Overview", icon: LayoutGridIcon, count: undefined },
    ...SECTION_KEYS.map((key) => ({
      href: `${base}/${key}`,
      label: SECTIONS[key].title,
      icon: ICONS[key],
      count: counts[key],
    })),
  ];

  return (
    <nav aria-label="Domain sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-muted font-medium text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {item.count !== undefined && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">{item.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
