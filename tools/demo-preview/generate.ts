// Prebuilt preview artifact generator (ADR-0350 T4). NOT run in per-PR CI — run manually / at
// release. It exercises the REAL `create-caisson --demo` path (packages/cli/src/cli.ts, the same
// binary a visitor's generator would run) into a throwaway temp dir, then does the same
// install/build/test/walkthrough a real consumer would, and freezes the bounded step output + file
// manifest as JSON under apps/site/public/demo-preview/ — the /demo page's "shared prebuilt
// preview pane" (PLAN T2 §b) renders these directly, never live-generates them per request.
//
// Network to the Caisson registry is expected and NOT mocked — a real failure (e.g. a 404 on a
// catalog tarball) is a real product finding and must be captured verbatim, never papered over.
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = join(HERE, "../..");
const CLI_ENTRY = join(REPO_ROOT, "packages/cli/src/cli.ts");
const OUT_DIR = join(REPO_ROOT, "apps/site/public/demo-preview");
const PROJECT_NAME = "caisson-demo";

/** Bound every captured transcript — this is marketing-page payload, not a debug log. */
const MAX_TRANSCRIPT_CHARS = 20_000;
/** Bound the total files/manifest.json payload size the same way the live /api/demo/run
 *  contract does (PLAN's ≤400KB rule) — this pane is the shared, not per-visitor, artifact. */
const MAX_TOTAL_TREE_BYTES = 400_000;

interface StepTranscript {
  readonly command: string;
  readonly exitCode: number | null;
  readonly durationMs: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly stdoutTruncated: boolean;
  readonly stderrTruncated: boolean;
}

export function previewOutput(
  transcript: Pick<StepTranscript, "exitCode" | "stdout" | "stderr">,
): string {
  const streams =
    transcript.exitCode === 0
      ? [transcript.stdout, transcript.stderr]
      : [transcript.stderr, transcript.stdout];
  return streams
    .filter((stream) => stream.length > 0)
    .join("\n")
    .slice(0, 20_000);
}

/** Strip the temp dir's absolute path and the invoking OS username from captured output — the
 *  committed artifact is a public marketing asset, never a leak of the build machine's layout. */
function scrub(text: string, tmpDir: string): string {
  const home = process.env["HOME"] ?? "";
  let out = text.split(tmpDir).join("<project>");
  if (home) out = out.split(home).join("~");
  // Catch-all for any other /home/<user>/... or /Users/<user>/... absolute path fragment that
  // slipped through (e.g. inside a stack trace pointing at a different tmp mount).
  out = out.replace(/\/(?:home|Users)\/[^/\s"]+/g, "<home>");
  return out;
}

function bound(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_TRANSCRIPT_CHARS) + "\n…[truncated]",
    truncated: true,
  };
}

async function runStep(
  label: string,
  cmd: readonly string[],
  cwd: string,
  tmpDir: string,
): Promise<StepTranscript> {
  const start = performance.now();
  const proc = Bun.spawn([...cmd], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1", CI: "1" },
  });
  const [stdoutRaw, stderrRaw, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const durationMs = Math.round(performance.now() - start);
  const stdoutBounded = bound(scrub(stdoutRaw, tmpDir));
  const stderrBounded = bound(scrub(stderrRaw, tmpDir));
  process.stdout.write(
    `[demo-preview] ${label}: exit ${exitCode} in ${durationMs}ms\n`,
  );
  return {
    command: cmd.join(" ").split(tmpDir).join("<project>"),
    exitCode,
    durationMs,
    stdout: stdoutBounded.text,
    stderr: stderrBounded.text,
    stdoutTruncated: stdoutBounded.truncated,
    stderrTruncated: stderrBounded.truncated,
  };
}

interface TreeEntry {
  readonly path: string;
  readonly bytes: number;
}

async function walkTree(dir: string, base: string): Promise<TreeEntry[]> {
  const entries: TreeEntry[] = [];
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (
      item.name === "node_modules" ||
      item.name === ".git" ||
      item.name === "dist"
    )
      continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      entries.push(...(await walkTree(full, base)));
    } else {
      const s = await stat(full);
      entries.push({ path: relative(base, full), bytes: s.size });
    }
  }
  return entries;
}

async function main(): Promise<void> {
  const tmpDir = await mkdtemp(join(tmpdir(), "caisson-demo-preview-"));
  try {
    process.stdout.write(`[demo-preview] generating into ${tmpDir}\n`);
    const genStart = performance.now();
    const genProc = Bun.spawn(
      [
        "bun",
        "run",
        CLI_ENTRY,
        "--demo",
        "--name",
        PROJECT_NAME,
        "--out",
        tmpDir,
      ],
      { cwd: REPO_ROOT, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const [genStdout, genStderr, genExit] = await Promise.all([
      new Response(genProc.stdout).text(),
      new Response(genProc.stderr).text(),
      genProc.exited,
    ]);
    const generatedInMs = Math.round(performance.now() - genStart);
    if (genExit !== 0) {
      throw new Error(
        `create-caisson --demo failed (exit ${genExit}): ${genStderr || genStdout}`,
      );
    }
    process.stdout.write(
      `[demo-preview] generated in ${generatedInMs}ms: ${genStdout.trim()}\n`,
    );

    // Real consumer steps, in order — capture each transcript honestly, even on failure.
    const install = await runStep(
      "bun install",
      ["bun", "install"],
      tmpDir,
      tmpDir,
    );
    const build = await runStep(
      "bun run build",
      ["bun", "run", "build"],
      tmpDir,
      tmpDir,
    );
    const test = await runStep(
      "bun test",
      ["bun", "run", "test"],
      tmpDir,
      tmpDir,
    );

    // The demo scaffold's package.json carries no `demo` script (that walkthrough is only wired
    // for the free-`--sample` path today, per packages/cli/src/cli.ts printSampleNextSteps) — so
    // there is nothing to run. Record that honestly instead of fabricating a walkthrough.
    const pkgJson = JSON.parse(
      await Bun.file(join(tmpDir, "package.json")).text(),
    ) as { scripts?: Record<string, string> };
    const hasWalkthrough = typeof pkgJson.scripts?.["demo"] === "string";
    const walkthrough = hasWalkthrough
      ? await runStep("bun run demo", ["bun", "run", "demo"], tmpDir, tmpDir)
      : null;

    const tree = await walkTree(tmpDir, tmpDir);
    let totalBytes = 0;
    const boundedTree: TreeEntry[] = [];
    for (const entry of tree.sort((a, b) => a.path.localeCompare(b.path))) {
      if (totalBytes + entry.bytes > MAX_TOTAL_TREE_BYTES) break;
      totalBytes += entry.bytes;
      boundedTree.push(entry);
    }

    const manifest = {
      projectName: PROJECT_NAME,
      generatedAt: new Date().toISOString(),
      generatedInMs,
      moduleSummaryLine: scrub(genStdout, tmpDir).trim().split("\n")[0] ?? "",
      tree: boundedTree,
      treeTruncated: boundedTree.length < tree.length,
      totalTreeBytes: totalBytes,
      steps: {
        install: { exitCode: install.exitCode, durationMs: install.durationMs },
        build: { exitCode: build.exitCode, durationMs: build.durationMs },
        test: { exitCode: test.exitCode, durationMs: test.durationMs },
        walkthrough: walkthrough
          ? {
              exitCode: walkthrough.exitCode,
              durationMs: walkthrough.durationMs,
            }
          : null,
      },
    };

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(
      join(OUT_DIR, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    // The T2 reader contract: ONE preview.json shaped exactly like PreviewSchema
    // (apps/site/components/demo/preview-schema.ts) — the file the /demo page's PreviewPane
    // actually loads. artifacts.test.ts asserts this committed file parses against the reader's schema, so the
    // writer↔reader seam can never silently drift again.
    const previewStep = (
      label: string,
      t: StepTranscript,
    ): { label: string; command: string; output: string; ok: boolean } => ({
      label,
      command: t.command.slice(0, 500),
      output: previewOutput(t),
      ok: t.exitCode === 0,
    });
    const preview = {
      generatedAt: manifest.generatedAt,
      appName: PROJECT_NAME,
      bundle: "demo",
      steps: [
        previewStep("bun install", install),
        previewStep("bun run build", build),
        previewStep("bun test", test),
        ...(walkthrough ? [previewStep("bun run demo", walkthrough)] : []),
      ],
      fileManifest: boundedTree,
    };
    await writeFile(
      join(OUT_DIR, "preview.json"),
      JSON.stringify(preview, null, 2) + "\n",
    );

    process.stdout.write(`[demo-preview] wrote artifacts to ${OUT_DIR}\n`);
    if (install.exitCode !== 0 || build.exitCode !== 0 || test.exitCode !== 0) {
      process.stdout.write(
        "[demo-preview] WARNING: one or more real steps failed — see preview.json. " +
          "This is a genuine product finding, not a script bug.\n",
      );
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

if (import.meta.main) await main();
