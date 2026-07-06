// apps/agent-dev/src/inspector.ts — the Agentic-Dev local inspector (ADR-0243, Fork A = A1). A
// read-only, LOCALHOST-ONLY `Bun.serve` view over the three durable seams the edition already
// produces: agent-runner run transcripts, the governed-lifecycle audit chain, and hybrid memory.
// Zero new dependency — matches the plain Bun/tsc shape this app already is (ADR-0243 narrowly
// supersedes ADR-0044 for this one non-Next edition web surface: localhost-only, read-only,
// non-sellable, never a deployed artifact).
//
// Scope (SPEC-agent-dev-inspector.md): three server-side-HTML routes, no client framework, NO
// WRITES anywhere. No guardrail column, no spend column, no tool-exec-history column — the edition
// produces none of that data. Tool calls render as COUNT + NAMES ONLY (no argv, no exit code) — the
// transcript's only durable tool-call signal — and the UI states that limit rather than hiding it.
//
// Security floor: the bind is `127.0.0.1` and is NEVER configurable to another interface. The
// `/memory?tenant=` route resolves a store path ONLY through `tenantDbPath()` (ADR-0073
// fail-closed) — a raw filesystem path from a query param can never reach `LocalStore.open`.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AgentRunner, RunReport } from "@caisson/agent-runner";
import { createAgentRunner } from "@caisson/agent-runner";
import {
  AuditedLifecycle,
  InMemoryAuditLifecycleStore,
  LocalStore,
  tenantDbPath,
} from "@caisson/agent-dev";
import type { AuditChainEntry, AuditLifecycleStore } from "@caisson/agent-dev";

// ---------------------------------------------------------------------------
// HTML escaping — run ids, tasks, memory doc text, and query params are attacker-ish input in an
// HTML-interpolation context; every one of them is escaped before it reaches a template literal.
// ---------------------------------------------------------------------------

const HTML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

function page(title: string, body: string): string {
  const nav = `<a href="/">runs</a> · <a href="/audit">audit</a> · <a href="/memory">memory</a>`;
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>caisson agent-dev inspector — ${escapeHtml(title)}</title></head>
<body>
<h1>caisson agent-dev inspector</h1>
<p><em>read-only · localhost-only (127.0.0.1) · ADR-0243</em></p>
<nav>${nav}</nav>
<h2>${escapeHtml(title)}</h2>
${body}
</body>
</html>`;
}

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

// ---------------------------------------------------------------------------
// Query-param bounding — every numeric input is clamped, never trusted; junk falls back to a
// default rather than throwing (a dev tool degrades gracefully on a malformed URL).
// ---------------------------------------------------------------------------

const QUERY_DEFAULT_LIMIT = 20;
const QUERY_MAX_LIMIT = 200;
const DEFAULT_TENANT_ID = "default";
/** `LocalStore.list()` never touches the `vec0` table, so the open-time `dim` is inconsequential
 *  for this read-only page — any positive integer is valid. */
const INSPECTOR_MEMORY_DIM = 8;

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === null) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parsePaging(params: URLSearchParams): {
  limit: number;
  offset: number;
} {
  const limit = clampInt(
    params.get("limit"),
    QUERY_DEFAULT_LIMIT,
    1,
    QUERY_MAX_LIMIT,
  );
  const page = params.get("page");
  if (page !== null) {
    const p = clampInt(page, 1, 1, 1_000_000);
    return { limit, offset: (p - 1) * limit };
  }
  return { limit, offset: clampInt(params.get("offset"), 0, 0, 1_000_000) };
}

// ---------------------------------------------------------------------------
// Route: GET / — the runs table (Seam 1: agent-runner).
// ---------------------------------------------------------------------------

/** Tool-call names from the transcript's `tool_use` events — best-effort (one name per assistant
 *  event, mirroring `tail()`'s own extraction); the authoritative COUNT is `RunReport.toolCalls`. */
function toolNames(runner: AgentRunner, runId: string): string[] {
  const { newEvents } = runner.tail(runId, 0);
  const names: string[] = [];
  for (const ev of newEvents) {
    if (typeof ev.tool === "string") names.push(ev.tool);
  }
  return names;
}

function runRow(runner: AgentRunner, runId: string, report: RunReport): string {
  const names = toolNames(runner, runId);
  return `<tr>
  <td>${escapeHtml(runId)}</td>
  <td>${escapeHtml(report.status)}</td>
  <td>${escapeHtml(report.binary)} / ${escapeHtml(report.model)}</td>
  <td>${escapeHtml(report.startedAt)}</td>
  <td>${escapeHtml(report.endedAt ?? "")}</td>
  <td>${report.toolCalls} (${names.map(escapeHtml).join(", ")})</td>
  <td>${report.filesTouched.length}</td>
</tr>`;
}

function renderRunsPage(runsRoot: string): string {
  const runner = createAgentRunner({ runsRoot });
  const rows = runner
    .list()
    .map((meta) => runRow(runner, meta.runId, runner.finalReport(meta.runId)))
    .join("\n");
  const body = `
<p><strong>Limit:</strong> tool calls show COUNT + NAME ONLY — no argv, no exit code. The
transcript records a tool's name; it never persists its input or result (see
SPEC-agent-dev-inspector.md, Out of scope).</p>
<table border="1" cellpadding="4">
<thead><tr><th>run</th><th>status</th><th>binary / model</th><th>started</th><th>ended</th><th>tool calls</th><th>files touched</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
  return page("runs", body);
}

// ---------------------------------------------------------------------------
// Route: GET /audit — the governed-lifecycle audit chain + tamper badge (Seam 2: agent-kernel).
// ---------------------------------------------------------------------------

/** Read one field off an audit-chain entry's payload without widening it to `any` — the payload is
 *  structurally a `LifecycleAuditPayload` at runtime, but its static type is the kernel's opaque
 *  `JsonValue`; narrow it locally rather than pull in `@caisson/kernel` as a new declared dependency. */
function payloadField(
  payload: AuditChainEntry["payload"],
  key: string,
): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    !Array.isArray(payload) &&
    key in payload
  ) {
    const value = (
      payload as { readonly [k: string]: AuditChainEntry["payload"] }
    )[key];
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return "";
}

function auditRow(entry: AuditChainEntry): string {
  return `<tr>
  <td>${entry.seq}</td>
  <td>${escapeHtml(payloadField(entry.payload, "from"))}</td>
  <td>${escapeHtml(payloadField(entry.payload, "to"))}</td>
  <td>${escapeHtml(payloadField(entry.payload, "decision"))}</td>
  <td>${escapeHtml(payloadField(entry.payload, "at"))}</td>
</tr>`;
}

async function renderAuditPage(lifecycle: AuditedLifecycle): Promise<string> {
  const snapshot = await lifecycle.snapshot();
  const verification = await lifecycle.verify(snapshot.anchor ?? undefined);
  const badge = verification.valid
    ? `<strong style="color:green">VERIFIED</strong>`
    : `<strong style="color:red">TAMPERED (broken at entry ${verification.brokenAt ?? "?"})</strong>`;
  const rows = snapshot.entries.map(auditRow).join("\n");
  const body = `
<p>chain verify: ${badge}</p>
<table border="1" cellpadding="4">
<thead><tr><th>seq</th><th>from</th><th>to</th><th>decision</th><th>at</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
  return page("audit", body);
}

// ---------------------------------------------------------------------------
// Route: GET /memory — paged memory docs (Seam 3: local-store, Fork B = B1 `.list()`).
// ---------------------------------------------------------------------------

function renderMemoryPage(
  memoryRoot: string,
  params: URLSearchParams,
): Response {
  const rawTenant = params.get("tenant");
  const tenantId =
    rawTenant !== null && rawTenant.trim().length > 0
      ? rawTenant.trim()
      : DEFAULT_TENANT_ID;

  // `tenantDbPath` is PURE and throws fail-closed on a malformed id (empty/null-byte/traversal/
  // separator/absolute) BEFORE any filesystem access — a query-param traversal never opens
  // anything, let alone a store outside `memoryRoot` (ADR-0073).
  let dbPath: string;
  try {
    dbPath = tenantDbPath(memoryRoot, tenantId);
  } catch {
    return htmlResponse(
      400,
      page(
        "memory",
        `<p><strong style="color:red">tenant resolution denied</strong></p>`,
      ),
    );
  }

  const { limit, offset } = parsePaging(params);

  // No writes: a tenant with no store file yet renders an empty page rather than creating one.
  let docs: readonly { id: string; text: string }[] = [];
  if (existsSync(dbPath)) {
    const store = LocalStore.open({ dim: INSPECTOR_MEMORY_DIM, path: dbPath });
    try {
      docs = store.list({ limit, offset });
    } finally {
      store.close();
    }
  }

  const rows = docs
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.id)}</td><td>${escapeHtml(d.text)}</td></tr>`,
    )
    .join("\n");
  const body = `
<form method="get">
  tenant <input name="tenant" value="${escapeHtml(tenantId)}">
  limit <input name="limit" value="${limit}">
  offset <input name="offset" value="${offset}">
  <button type="submit">go</button>
</form>
<table border="1" cellpadding="4">
<thead><tr><th>doc id</th><th>text</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
  return htmlResponse(200, page("memory", body));
}

// ---------------------------------------------------------------------------
// The handler + CLI entrypoint.
// ---------------------------------------------------------------------------

export interface InspectorConfig {
  /** `@caisson/agent-runner` run-registry root (transcripts + meta). */
  readonly runsRoot: string;
  /** The file-per-tenant memory root `/memory` resolves through `tenantDbPath()`. */
  readonly memoryRoot: string;
  /** Tamper-evident lifecycle persistence seam `/audit` reads. Defaults to a FRESH empty in-memory
   *  store — a bare CLI launch is its own process with nothing else to read; a host embedding the
   *  inspector alongside its own edition instance passes the SAME `AuditLifecycleStore` it holds. */
  readonly auditStore?: AuditLifecycleStore;
}

/** Build the request handler. Never binds a socket itself — pass to `Bun.serve({ fetch })`. */
export function createInspectorHandler(
  config: InspectorConfig,
): (req: Request) => Promise<Response> {
  const runsRoot = resolve(config.runsRoot);
  const memoryRoot = resolve(config.memoryRoot);
  const lifecycle = new AuditedLifecycle({
    store: config.auditStore ?? new InMemoryAuditLifecycleStore(),
  });

  return async (req: Request): Promise<Response> => {
    if (req.method !== "GET") {
      return htmlResponse(
        405,
        page("error", "<p>method not allowed — read-only</p>"),
      );
    }
    const url = new URL(req.url);
    try {
      if (url.pathname === "/")
        return htmlResponse(200, renderRunsPage(runsRoot));
      if (url.pathname === "/audit")
        return htmlResponse(200, await renderAuditPage(lifecycle));
      if (url.pathname === "/memory")
        return renderMemoryPage(memoryRoot, url.searchParams);
      return htmlResponse(404, page("not found", "<p>not found</p>"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "internal error";
      return htmlResponse(500, page("error", `<p>${escapeHtml(message)}</p>`));
    }
  };
}

if (import.meta.main) {
  const runsRoot = process.argv[2];
  const memoryRoot = process.argv[3];
  if (runsRoot === undefined || memoryRoot === undefined) {
    process.stderr.write(
      "usage: bun run apps/agent-dev/src/inspector.ts <runsRoot> <memoryRoot>\n",
    );
    process.exit(1);
  }
  const fetch = createInspectorHandler({ runsRoot, memoryRoot });
  // 127.0.0.1 ONLY — never 0.0.0.0, never configurable from argv/env (ADR-0243 hard lock).
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch });
  process.stdout.write(
    `caisson agent-dev inspector — read-only, localhost-only — http://127.0.0.1:${server.port}\n`,
  );
}
