// `caisson doctor` (ADR-0345 Fork F lock). A THIN CLIENT: it does NOT run the doctor logic locally
// (that lives behind the MCP `check_usage` tool). It collects the project's source, connects to the
// already-credentialed local `@caisson-sh/mcp-server` over stdio, calls `check_usage`, and renders the
// findings. A tool the server does not register surfaces as the seam's 404, reported as a clear error.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { DoctorFile, Finding } from "@caisson-sh/ds-manifest";

export interface DoctorClientInput {
  /** Injectable MCP transport (a StdioClientTransport in the bin; InMemoryTransport in tests). */
  readonly transport: Transport;
  readonly files: readonly DoctorFile[];
  readonly themes?: readonly unknown[];
}

/**
 * Call the MCP `check_usage` tool over `transport` and return its findings. A missing tool surfaces
 * as the MCP `isError` envelope — rethrown as a clear Error so the caller sees why, never a silent
 * empty result.
 */
export async function runDoctorClient(
  input: DoctorClientInput,
): Promise<Finding[]> {
  const client = new Client({ name: "caisson-doctor", version: "1.0.0" });
  await client.connect(input.transport);
  try {
    const result = await client.callTool({
      name: "check_usage",
      arguments: {
        files: input.files,
        ...(input.themes !== undefined ? { themes: input.themes } : {}),
      },
    });
    const content =
      (result as { content?: { type: string; text: string }[] }).content ?? [];
    const payload = JSON.parse(content[0]?.text ?? "{}") as {
      findings?: Finding[];
      error?: { code?: string; message?: string };
    };
    if (result.isError === true) {
      const code = payload.error?.code ?? "error";
      const message = payload.error?.message ?? "check_usage failed";
      throw new Error(`${code}: ${message}`);
    }
    return payload.findings ?? [];
  } finally {
    await client.close();
  }
}

const DOCTOR_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".json"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo"]);
const MAX_FILES = 500;
const MAX_FILE_BYTES = 200_000;

/** Collect the adopter source the doctor checks: source/style/manifest files under `root`, bounded in
 *  count and per-file size to the same limits the `check_usage` tool enforces. Vendored/build dirs
 *  are skipped. Returns repo-relative paths. */
export function collectFiles(root: string): DoctorFile[] {
  const out: DoctorFile[] = [];
  const walk = (dir: string): void => {
    if (out.length >= MAX_FILES) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= MAX_FILES) return;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
        continue;
      }
      if (!entry.isFile()) continue;
      const dot = entry.name.lastIndexOf(".");
      if (dot < 0 || !DOCTOR_EXTS.has(entry.name.slice(dot))) continue;
      const full = join(dir, entry.name);
      const contents = readFileSync(full, "utf8");
      if (contents.length > MAX_FILE_BYTES) continue;
      out.push({ path: relative(root, full) || entry.name, contents });
    }
  };
  walk(root);
  return out;
}

/** Build the stdio transport to the local MCP server from env config (the server's own Bearer
 *  token flows to that server process via its own env, not through the doctor). Throws a clear
 *  message when no MCP server is configured. Exported: `run.ts`'s `caisson run start` is the SAME
 *  thin-MCP-client shape (a second tool on the same server), so it reuses this helper rather than
 *  re-deriving env wiring. */
export function buyerMcpTransport(): Transport {
  const command = process.env.CAISSON_MCP_COMMAND;
  if (command === undefined || command === "") {
    throw new Error(
      "this command needs your local Caisson MCP server — set CAISSON_MCP_COMMAND " +
        "(and optional CAISSON_MCP_ARGS) to your local @caisson-sh/mcp-server command.",
    );
  }
  const args = (process.env.CAISSON_MCP_ARGS ?? "")
    .split(/\s+/)
    .filter((s) => s.length > 0);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  return new StdioClientTransport({ command, args, env });
}

/** The bin entry: parse `[dir] [--json]`, collect files, call the local MCP, render findings, and
 *  exit non-zero when any error-severity finding is present (CI-usable). */
export async function runDoctorCli(argv: readonly string[]): Promise<void> {
  let dir = ".";
  let json = false;
  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
    } else if (!arg.startsWith("-")) {
      dir = arg;
    } else {
      throw new Error(`doctor: unknown argument ${JSON.stringify(arg)}`);
    }
  }
  const findings = await runDoctorClient({
    transport: buyerMcpTransport(),
    files: collectFiles(dir),
  });
  if (json) {
    process.stdout.write(`${JSON.stringify({ findings }, null, 2)}\n`);
  } else if (findings.length === 0) {
    process.stdout.write(
      "caisson doctor: no findings — usage looks correct.\n",
    );
  } else {
    for (const f of findings) {
      const loc = f.loc !== undefined ? `:${f.loc.line}` : "";
      process.stdout.write(
        `${f.severity.toUpperCase()} ${f.rule} ${f.file}${loc} — ${f.message}\n`,
      );
    }
  }
  if (findings.some((f) => f.severity === "error")) {
    process.exitCode = 1;
  }
}
