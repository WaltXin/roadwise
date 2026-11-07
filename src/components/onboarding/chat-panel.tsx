"use client";

import { ArrowUpIcon, CheckIcon, FileTextIcon, Loader2Icon, PencilLineIcon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessage, startOnboarding } from "@/lib/onboarding/actions";
import type { ChatItem } from "@/lib/onboarding/queries";
import { cn } from "@/lib/utils";

import { RichText, type RefMap } from "./rich-text";

type Props = {
  productId: string;
  productName: string;
  sharedTitles: string[];
  items: ChatItem[];
  refs: RefMap;
};

export function ChatPanel({ productId, productName, sharedTitles, items, refs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = items.length > 0;

  // While Roadwise works, refresh so the profile and roadmap fill in as it records them.
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [pending, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length, pending]);

  function run(fn: () => Promise<{ error?: string }>, text: string | null) {
    setError(null);
    setSent(text);
    startTransition(async () => {
      const result = await fn();
      if (result.error) {
        setError(result.error);
        if (text) setDraft(text);
      }
      setSent(null);
    });
  }

  function submit() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    run(() => sendMessage(productId, text), text);
  }

  // Show the founder's message right away, until the stored copy arrives.
  const lastUser = items.findLast((i) => i.type === "user");
  const showSent = sent !== null && lastUser?.text !== sent;

  return (
    <section
      aria-label="Conversation with Roadwise"
      className="flex h-full min-h-[28rem] flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {!started && !pending ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Logo className="text-lg" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Roadwise will read everything you shared about {productName}
              {sharedTitles.length > 0 && <> — {sharedTitles.join(", ").toLowerCase()} —</>} fill in what it can, and
              ask about the rest.
            </p>
            <Button size="lg" onClick={() => run(() => startOnboarding(productId), null)}>
              <PlayIcon data-icon="inline-start" />
              Start onboarding
            </Button>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {items.map((item) => (
              <ChatRow key={item.id} item={item} refs={refs} />
            ))}
            {showSent && <ChatRow item={{ id: "pending", type: "user", text: sent }} refs={refs} />}
            {pending && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2Icon className="size-4 animate-spin" />
                {started ? "Roadwise is thinking…" : "Roadwise is reading what you shared…"}
              </li>
            )}
          </ol>
        )}
      </div>

      {error && (
        <p role="alert" className="border-t bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {started && (
        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Reply to Roadwise…"
            aria-label="Message"
            className="max-h-40 min-h-9 resize-none"
            disabled={pending}
          />
          <Button type="submit" size="icon-lg" aria-label="Send" disabled={pending || !draft.trim()}>
            <ArrowUpIcon />
          </Button>
        </form>
      )}
    </section>
  );
}

function ChatRow({ item, refs }: { item: ChatItem; refs: RefMap }) {
  if (item.type === "kickoff") {
    return (
      <li className="flex justify-end">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <FileTextIcon className="size-3.5" /> Shared the product description and materials
        </p>
      </li>
    );
  }
  if (item.type === "note") {
    return (
      <li className="flex justify-center">
        <p className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <PencilLineIcon className="size-3.5 shrink-0" />
          <span className="truncate">{item.text.replace(/^\[Panel edit\]\s*/, "")}</span>
        </p>
      </li>
    );
  }
  if (item.type === "user") {
    return (
      <li className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-sm whitespace-pre-line text-background">
          {item.text}
        </p>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2">
      {item.refused ? (
        <p className="text-sm text-muted-foreground italic">Roadwise couldn&apos;t respond to that. Try rephrasing.</p>
      ) : (
        item.text && <RichText text={item.text} refs={refs} className="text-sm leading-relaxed" />
      )}
      {item.actions.length > 0 && (
        <ul className={cn("flex flex-wrap gap-1.5", item.text && "mt-0.5")}>
          {item.actions.map((a, i) => (
            <li
              key={i}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-brand-soft/70 px-2 py-0.5 text-xs text-foreground/80"
            >
              <CheckIcon className="size-3 shrink-0 text-brand" />
              <span className="truncate">{a}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
