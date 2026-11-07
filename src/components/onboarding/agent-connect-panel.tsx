"use client";

import { CheckIcon, ChevronDownIcon, CopyIcon, PlugIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

function Snippet({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the text stays selectable.
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Button variant="ghost" size="xs" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  );
}

/** How a founder points Claude Code or Codex at Roadwise, so the chosen decision reaches the code. */
export function AgentConnectPanel({ mcpUrl, productName }: { mcpUrl: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const claude = `claude mcp add --transport http roadwise ${mcpUrl} \\\n  --header "Authorization: Bearer $ROADWISE_MCP_TOKEN"`;
  const codex = `# ~/.codex/config.toml\n[mcp_servers.roadwise]\nurl = "${mcpUrl}"\nbearer_token_env_var = "ROADWISE_MCP_TOKEN"`;
  const prompt = `Use Roadwise to see the decision we chose for ${productName}. Implement what it recommends, verify it against the acceptance criteria you can test, and report back to Roadwise.`;

  return (
    <section aria-labelledby="agent-heading" className="rounded-xl bg-card ring-1 ring-foreground/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="agent-body"
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <PlugIcon className="size-4 shrink-0 text-brand" />
        <span className="min-w-0 flex-1">
          <span id="agent-heading" className="block font-medium">
            Connect your coding agent
          </span>
          <span className="block text-xs text-muted-foreground">
            Claude Code or Codex reads the chosen decision over MCP and reports back when it ships.
          </span>
        </span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id="agent-body" className="flex flex-col gap-4 border-t p-4">
          <p className="text-sm text-foreground/80">
            Set <code className="rounded bg-muted px-1 font-mono text-xs">ROADWISE_MCP_TOKEN</code> in your shell (the
            workspace owner has it), then add the server:
          </p>
          <Snippet label="Claude Code" code={claude} />
          <Snippet label="Codex" code={codex} />
          <Snippet label="Then ask your agent" code={prompt} />
          <p className="text-xs text-muted-foreground">
            Tools: list_products, get_product_context, get_open_decisions, report_implementation, share_evidence. A
            report marks the decision “implemented · awaiting evaluation” — it isn’t done until it passes the acceptance
            criteria.
          </p>
        </div>
      )}
    </section>
  );
}
