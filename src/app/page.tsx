import {
  ArrowRightIcon,
  BellRingIcon,
  CompassIcon,
  FlaskConicalIcon,
  MessageSquareTextIcon,
  RefreshCcwIcon,
  ScaleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";

import { SECTION_ICONS } from "@/components/expert/section-icons";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Problem />
        <HowItWorks />
        <Foundations />
        <Evaluation />
        <Mvp />
      </main>
      <SiteFooter />
    </div>
  );
}

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4", className)}>{children}</div>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-brand">{children}</p>;
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:border-border/60">
      <Container className="flex h-14 items-center gap-6">
        <Link
          href="/"
          aria-label="Roadwise home"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <a href="#how" className="hover:text-foreground">
            How it works
          </a>
          <a href="#foundations" className="hover:text-foreground">
            Voice AI
          </a>
          <a href="#evaluation" className="hover:text-foreground">
            Evaluation
          </a>
        </nav>
        <Link href="/expert" className={cn(buttonVariants({ size: "sm" }), "ml-auto")}>
          Expert console
        </Link>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[36rem] bg-[radial-gradient(60%_50%_at_70%_30%,var(--brand-soft),transparent)]"
      />
      <Container className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium ring-1 ring-foreground/10">
            <span className="size-1.5 rounded-full bg-brand" />
            Starting with Voice AI
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Know what to build next. <span className="text-muted-foreground">Then prove it.</span>
          </h1>
          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            Roadwise is an always-on AI consultant that understands your industry, monitors your existing product, and
            uses evidence to recommend what to improve next — then follows up to check whether it helped.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#how" className={buttonVariants({ size: "lg", className: "px-4" })}>
              See how it works
              <ArrowRightIcon data-icon="inline-end" />
            </a>
            <Link href="/expert" className={buttonVariants({ size: "lg", variant: "outline", className: "px-4" })}>
              Open expert console
            </Link>
          </div>
        </div>
        <DecisionRecord />
      </Container>
    </section>
  );
}

const RECORD_STEPS = [
  {
    label: "What we observed",
    body: "A new interruption-handling capability is now available to voice AI teams.",
  },
  {
    label: "Why it matters here",
    body: "Your agent books appointments. If callers interrupt to correct details and the agent mishandles it, bookings fail.",
  },
  {
    label: "What we recommend",
    body: "Don’t adopt yet. First, find out whether interruptions are actually causing failures in your calls.",
  },
  {
    label: "How to test it",
    body: "Compare booking completion on calls with and without interruptions, against acceptance criteria agreed up front.",
  },
  {
    label: "What would change our conclusion",
    body: "If interrupted calls complete just as reliably, keep observing instead of rebuilding.",
  },
];

function DecisionRecord() {
  return (
    <figure className="relative">
      <div className="rounded-2xl bg-card p-5 shadow-xl ring-1 shadow-foreground/5 ring-foreground/10 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <CompassIcon className="size-4" />
            </span>
            <p className="text-sm font-medium">Decision record</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-500" />
            Hypothesis · evidence pending
          </span>
        </div>
        <ol className="relative mt-4 flex flex-col gap-4">
          <span aria-hidden className="absolute top-2 bottom-2 left-[11px] w-px bg-border" />
          {RECORD_STEPS.map((step, i) => (
            <li key={step.label} className="relative flex gap-3">
              <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-background font-mono text-xs font-medium ring-1 ring-foreground/15">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                <p className="text-sm text-pretty">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Illustrative example. Every recommendation records the full chain.
      </figcaption>
    </figure>
  );
}

const SIGNALS = ["Company announcements", "Technical blogs", "Research", "Industry events", "Customer conversations"];

function Problem() {
  return (
    <section className="border-y bg-muted/40 py-20">
      <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="flex flex-col gap-4">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Building got faster. Deciding what to build didn’t.
          </h2>
          <p className="text-pretty text-muted-foreground">
            Coding agents let founders ship in days. But choosing what to build still takes industry knowledge, customer
            understanding, and product judgment — and the information that informs it is scattered.
          </p>
          <p className="text-pretty text-muted-foreground">
            Roadwise turns those signals into recommendations grounded in your goals, and follows up to find out whether
            they helped.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4">
          <ul className="flex flex-wrap justify-center gap-2">
            {SIGNALS.map((s) => (
              <li
                key={s}
                className="rounded-full bg-background px-3 py-1.5 text-sm text-muted-foreground ring-1 ring-foreground/10"
              >
                {s}
              </li>
            ))}
          </ul>
          <div aria-hidden className="h-10 w-px bg-gradient-to-b from-border to-brand" />
          <div className="flex w-full max-w-sm items-center gap-3 rounded-xl bg-background p-4 ring-1 ring-brand/30">
            <SparklesIcon className="size-5 shrink-0 text-brand" />
            <p className="text-sm">
              <span className="font-medium">One recommendation</span>{" "}
              <span className="text-muted-foreground">that fits your product, with the evidence attached.</span>
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

const STEPS = [
  {
    icon: MessageSquareTextIcon,
    title: "Understands the product",
    body: "Clarifies your customers, objectives, constraints, and the assumptions behind your current roadmap.",
  },
  {
    icon: BellRingIcon,
    title: "Monitors relevant changes",
    body: "Tracks industry developments alongside your releases, customer feedback, and evaluation results.",
  },
  {
    icon: CompassIcon,
    title: "Explains implications",
    body: "Works out why a finding matters — or doesn’t — for your particular product.",
  },
  {
    icon: FlaskConicalIcon,
    title: "Recommends next steps",
    body: "A roadmap change, a targeted evaluation, a customer investigation, or simply continued observation.",
  },
  {
    icon: RefreshCcwIcon,
    title: "Follows up",
    body: "Records the decision and checks whether the expected benefits actually materialized.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-14 py-20">
      <Container className="flex flex-col gap-12">
        <div className="flex max-w-2xl flex-col gap-4">
          <Eyebrow>How customers use it</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Bring your product. Keep your team and tools.
          </h2>
          <p className="text-pretty text-muted-foreground">
            You bring an existing product, roadmap, goals, and whatever evidence you have. Roadwise works alongside the
            way you already build.
          </p>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
              <div className="flex items-center justify-between">
                <step.icon className="size-5 text-brand" />
                <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm text-pretty text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <blockquote className="rounded-2xl bg-foreground p-6 text-background sm:p-8">
          <p className="text-lg font-medium text-balance sm:text-xl">
            A new capability is a reason to investigate, not an automatic reason to adopt.
          </p>
          <p className="mt-3 max-w-3xl text-sm text-pretty text-background/70">
            When a new interruption-handling capability ships, Roadwise doesn’t tell you to adopt it. It checks whether
            interruptions are causing failures in your calls — and recommends from there.
          </p>
        </blockquote>
      </Container>
    </section>
  );
}

const FOUNDATIONS = [
  {
    key: "sources",
    title: "Sources",
    body: "Key companies, technical blogs, researchers, industry events, and customer perspectives.",
  },
  {
    key: "context",
    title: "Industry context",
    body: "Buyers, workflows, alternatives, purchasing criteria, and common failure modes.",
  },
  {
    key: "evaluation",
    title: "Evaluation priorities",
    body: "Task completion, latency, interruptions, escalation, reliability, and cost.",
  },
  {
    key: "questions",
    title: "Research questions",
    body: "Which developments could materially affect a customer’s product or roadmap?",
  },
] as const;

function Foundations() {
  return (
    <section id="foundations" className="scroll-mt-14 border-y bg-muted/40 py-20">
      <Container className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <Eyebrow>Start with one industry</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Voice AI, set up by someone who knows it.
          </h2>
          <p className="text-pretty text-muted-foreground">
            A domain expert lays the foundation. The AI researches the landscape continuously, keeps every source and
            date, and proposes updates when it finds gaps.
          </p>
          <div className="flex gap-3 rounded-xl bg-background p-4 text-sm ring-1 ring-foreground/10">
            <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
            <p className="text-pretty text-muted-foreground">
              <span className="font-medium text-foreground">Claims are leads, not facts.</span> Event presentations and
              company announcements are things to investigate, never accepted on their own.
            </p>
          </div>
          <div>
            <Link href="/expert" className={buttonVariants({ variant: "outline" })}>
              Curate the knowledge base
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </div>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FOUNDATIONS.map((f) => {
            const Icon = SECTION_ICONS[f.key];
            return (
              <li key={f.key} className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon className="size-4" />
                </span>
                <h3 className="font-medium">{f.title}</h3>
                <p className="text-sm text-pretty text-muted-foreground">{f.body}</p>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}

function Evaluation() {
  return (
    <section id="evaluation" className="scroll-mt-14 py-20">
      <Container className="flex flex-col gap-12">
        <div className="flex max-w-2xl flex-col gap-4">
          <Eyebrow>System-level evaluation</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            We evaluate decisions, not demos.
          </h2>
          <p className="text-pretty text-muted-foreground">
            The unit of evaluation is a product decision, judged by its effect on complete user journeys.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
            <div className="flex items-center gap-2">
              <ScaleIcon className="size-5 text-brand" />
              <h3 className="font-medium">The change</h3>
            </div>
            <p className="text-sm text-pretty text-muted-foreground">
              Benefits are weighed against regressions, effort, and cost, against goals set before the work begins.
            </p>
            <p className="rounded-lg bg-muted/60 p-3 text-sm text-pretty">
              Faster calls only count if the whole result holds up: bookings complete correctly and the necessary
              information is kept.
            </p>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
            <div className="flex items-center gap-2">
              <ShieldCheckIcon className="size-5 text-brand" />
              <h3 className="font-medium">The advice itself</h3>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {[
                "Are its claims supported?",
                "Does the recommendation fit this customer’s situation?",
                "Did later evidence support the hypothesis?",
              ].map((q) => (
                <li key={q} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
                  {q}
                </li>
              ))}
            </ul>
            <p className="text-sm text-pretty text-muted-foreground">
              Missing evidence stays explicitly unresolved, never quietly filled in.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

const MVP = [
  "Set up the Voice AI domain with curated sources and a clear industry framework.",
  "Onboard one existing product and identify one consequential roadmap decision.",
  "Generate an evidence-backed recommendation combining industry intelligence with product-specific findings.",
  "Evaluate independently, with acceptance criteria and held-out scenarios defined up front.",
  "Update the roadmap, and keep the recommendation, decision, evidence, and follow-up result.",
];

function Mvp() {
  return (
    <section className="border-t bg-muted/40 py-20">
      <Container className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Eyebrow>What we’re demonstrating</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            One credible, traceable decision loop.
          </h2>
          <p className="text-pretty text-muted-foreground">
            An industry signal becomes a hypothesis about one specific product. The hypothesis is tested independently,
            and the recommendation changes when the evidence does.
          </p>
          <p className="text-sm text-pretty text-muted-foreground">
            No claims of universal expertise, and no business impact we haven’t measured.
          </p>
        </div>
        <ol className="flex flex-col gap-3">
          {MVP.map((step, i) => (
            <li key={step} className="flex gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground font-mono text-xs font-medium text-background">
                {i + 1}
              </span>
              <p className="text-sm text-pretty">{step}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <Container className="flex flex-col items-start justify-between gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center">
        <Logo className="text-foreground" />
        <p>Industry intelligence that improves your roadmap.</p>
      </Container>
    </footer>
  );
}
