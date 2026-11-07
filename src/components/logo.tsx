import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect width="32" height="32" rx="9" className="fill-foreground" />
      <path
        d="M9 23c0-5 4-6 7-7.5S23 12 23 8"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        className="stroke-background"
      />
      <circle cx="9" cy="23" r="2.4" className="fill-background" />
      <circle cx="23" cy="8" r="2.4" className="fill-[var(--brand)]" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      Roadwise
    </span>
  );
}
