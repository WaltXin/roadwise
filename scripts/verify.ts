/**
 * Roadwise verifier: runs a product's held-out eval suite against its own harness on a base
 * ref (and optionally a head ref, e.g. the coding agent's branch), then posts the measured
 * results to Roadwise, which writes an independent verdict.
 *
 *   npm run verify -- --product <id> --repo ~/Dev/orangechat --base main [--head <branch|working>] [--runs 3]
 *
 * `working` means the repo's current working tree, uncommitted changes included.
 * Runs locally (or in CI): the product's agent and its API keys stay on the customer's side.
 */
import { execFileSync, spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RUNNERS: Record<string, string> = {
  "orangechat-livekit-text": "connectors/orangechat/test_roadwise_suite.py",
};

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  if (value === undefined && fallback === undefined) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  return value ?? fallback!;
}

const productId = arg("product");
const repo = path.resolve(arg("repo").replace(/^~/, process.env.HOME ?? "~"));
const baseRef = arg("base");
const headRef = arg("head", "");
const runs = Number(arg("runs", "3"));
const concurrency = arg("concurrency", "4");
const roadwiseUrl = arg("url", process.env.ROADWISE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const token = process.env.ROADWISE_MCP_TOKEN ?? "";
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();

async function runSide(label: string, ref: string, suitePath: string, runner: string, work: string) {
  const working = ref === "working";
  const commit = working ? `${git("rev-parse", "--short", "HEAD")}+working` : git("rev-parse", "--short", ref);
  const tree = working ? repo : path.join(work, label);
  if (!working)
    execFileSync("git", ["-C", repo, "worktree", "add", "--detach", "--force", tree, ref], { stdio: "ignore" });
  const backend = path.join(tree, "backend");
  const runnerDest = path.join(backend, "evals", "test_roadwise_suite.py");
  try {
    // The checkout needs the product's local secrets (gitignored) to call its model.
    if (!working && existsSync(path.join(repo, "backend", ".env"))) {
      copyFileSync(path.join(repo, "backend", ".env"), path.join(backend, ".env"));
    }
    copyFileSync(runner, runnerDest);
    const resultsPath = path.join(work, `${label}-results.json`);
    console.log(`▶ ${label}: ${ref} (${commit}) — ${runs} runs per scenario`);
    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        "uv",
        ["run", "--frozen", "pytest", "evals/test_roadwise_suite.py", "-q", "-p", "no:cacheprovider"],
        {
          cwd: backend,
          stdio: ["ignore", "ignore", "inherit"],
          env: {
            ...process.env,
            ROADWISE_SUITE: suitePath,
            ROADWISE_RESULTS: resultsPath,
            ROADWISE_RUNS: String(runs),
            ROADWISE_CONCURRENCY: concurrency,
            // Reuse the repo's environment instead of building one per checkout.
            UV_PROJECT_ENVIRONMENT: path.join(repo, "backend", ".venv"),
          },
        },
      );
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${label}: pytest exited ${code}`))));
      child.on("error", reject);
    });
    const { results } = JSON.parse(readFileSync(resultsPath, "utf8"));
    const passed = results.filter((r: { passed: boolean }) => r.passed).length;
    console.log(`✓ ${label}: ${passed}/${results.length} runs passed in ${Math.round((Date.now() - started) / 1000)}s`);
    return { ref: /^[0-9a-f]{40}$/.test(ref) ? `merge-base of ${baseRef}` : ref, commit, runs, results };
  } finally {
    rmSync(runnerDest, { force: true });
    if (!working) {
      execFileSync("git", ["-C", repo, "worktree", "remove", "--force", tree], { stdio: "ignore" });
    }
  }
}

async function main() {
  const res = await fetch(`${roadwiseUrl}/api/evals/suite?product=${productId}`, { headers });
  if (!res.ok) throw new Error(`Fetching the suite failed: ${res.status} ${await res.text()}`);
  const suite = await res.json();
  const runner = RUNNERS[suite.connector];
  if (!runner) throw new Error(`No runner for connector ${suite.connector}`);
  console.log(`Suite ${suite.suite_id}: ${suite.scenarios.length} held-out scenarios`);

  mkdirSync(tmpdir(), { recursive: true });
  const work = mkdtempSync(path.join(tmpdir(), "roadwise-verify-"));
  try {
    const suitePath = path.join(work, "suite.json");
    writeFileSync(suitePath, JSON.stringify({ scenarios: suite.scenarios }));
    const runnerPath = path.resolve(runner);
    // Compare the head against the commit it branched from, so changes that landed on the
    // base branch since then don't get credited (or blamed) to the change under test.
    let baseTarget = baseRef;
    if (headRef && headRef !== "working") {
      const mergeBase = git("merge-base", baseRef, headRef);
      if (mergeBase !== git("rev-parse", baseRef)) {
        console.log(`ℹ ${baseRef} has moved since ${headRef} branched; using the merge-base ${mergeBase.slice(0, 7)} as base`);
        baseTarget = mergeBase;
      }
    }
    const [base, head] = await Promise.all([
      runSide("base", baseTarget, suitePath, runnerPath, work),
      headRef ? runSide("head", headRef, suitePath, runnerPath, work) : Promise.resolve(null),
    ]);

    console.log("⚖ Asking Roadwise for an independent verdict…");
    const post = await fetch(`${roadwiseUrl}/api/evals/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ suite_id: suite.suite_id, base, head }),
    });
    const body = await post.json();
    if (!post.ok) throw new Error(`Posting results failed: ${post.status} ${JSON.stringify(body)}`);
    console.log(`\nVerdict: ${body.verdict.outcome.toUpperCase()}\n${body.verdict.summary}\n`);
    for (const s of body.verdict.scenarios) console.log(`  ${s.id} [${s.status}] ${s.finding}`);
    console.log(`\n${body.url}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
