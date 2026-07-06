// apps/agent-dev/src/inspector.test.ts — the SPEC-agent-dev-inspector goal-backward tests
// (ADR-0243, Tasks 2-4): the inspector BOOTS on an ephemeral 127.0.0.1 port over a temp runsRoot /
// memoryRoot and serves all three read-only routes; a `tenant` query-param traversal is rejected
// fail-closed (never opens a store outside `memoryRoot`); the `/audit` verify badge flips to
// TAMPERED on a tampered snapshot.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import { createAgentRunner } from "@caisson/agent-runner";
import type { Act, AuditChainEntry } from "@caisson/agent-dev";
import {
  AuditedLifecycle,
  CANONICAL_LIFECYCLE,
  InMemoryAuditLifecycleStore,
  LocalStore,
  evaluateGuards,
  predicateGuard,
  tenantDbPath,
} from "@caisson/agent-dev";
import { createInspectorHandler } from "./inspector.ts";

const fixture = fileURLToPath(
  new URL("../test/__fixtures__/stub-agent-cli.ts", import.meta.url),
);

afterAll(() => {
  delete process.env["INSPECTOR_TEST_CANARY"];
});

function tmpRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Spawn the stub CLI fixture (one Edit tool_use + a result) and wait for it to finish. */
async function seedOneRun(runsRoot: string): Promise<string> {
  const runner = createAgentRunner({ runsRoot });
  const { runId } = runner.spawn({
    provider: {
      binary: process.execPath,
      baseUrlEnv: "STUB_BASE_URL",
      authEnv: "STUB_API_KEY",
      model: "stub-model-1",
      args: [fixture, "{task}"],
    },
    task: "inspector smoke run",
    worktree: tmpRoot("caisson-inspector-wt-"),
    authKey: "stub-key",
    baseUrl: "https://stub.example.com",
  });
  const deadline = Date.now() + 10_000;
  while (runner.status(runId).status === "running") {
    if (Date.now() > deadline) {
      runner.kill(runId);
      break;
    }
    await Bun.sleep(20);
  }
  return runId;
}

interface GovCtx {
  readonly run: string;
}

/** Record the full canonical lifecycle into a fresh audited store — same pattern as `demo.ts`. */
async function seedAuditedChain(): Promise<InMemoryAuditLifecycleStore> {
  const store = new InMemoryAuditLifecycleStore();
  const lifecycle = new AuditedLifecycle({ store, audited: true });
  const guard = predicateGuard<GovCtx>(() => true, "policy: allow");
  const path: readonly Act[] = CANONICAL_LIFECYCLE;
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1] as Act;
    const to = path[i] as Act;
    const decision = evaluateGuards([guard], {
      from,
      to,
      context: { run: "inspector-test" },
    });
    await lifecycle.record(from, to, decision);
  }
  return store;
}

describe("agent-dev inspector — boot smoke (ADR-0243 / SPEC Task 2)", () => {
  test("boots on an ephemeral 127.0.0.1 port and serves all three routes 200 with the expected shape", async () => {
    const runsRoot = tmpRoot("caisson-inspector-runs-");
    const memoryRoot = tmpRoot("caisson-inspector-memory-");
    await seedOneRun(runsRoot);

    const memPath = tenantDbPath(memoryRoot, "default");
    const memStore = LocalStore.open({ dim: 3, path: memPath });
    memStore.upsert({
      id: "doc-1",
      text: "hello inspector <script>evil</script>",
    });
    memStore.close();

    const auditStore = await seedAuditedChain();
    const fetchHandler = createInspectorHandler({
      runsRoot,
      memoryRoot,
      auditStore,
    });
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: fetchHandler,
    });
    try {
      expect(server.hostname).toBe("127.0.0.1");
      const base = `http://127.0.0.1:${server.port}`;

      const runsRes = await fetch(`${base}/`);
      expect(runsRes.status).toBe(200);
      const runsHtml = await runsRes.text();
      expect(runsHtml).toContain("<table");
      expect(runsHtml).toContain("done"); // the stub run's final status
      expect(runsHtml).toContain("1 (Edit)"); // COUNT + NAME ONLY — no argv, no exit code
      expect(runsHtml).toContain("no argv, no exit code");

      const auditRes = await fetch(`${base}/audit`);
      expect(auditRes.status).toBe(200);
      const auditHtml = await auditRes.text();
      expect(auditHtml).toContain("VERIFIED");
      expect(auditHtml).toContain("spec"); // the first recorded transition's `from`

      const memoryRes = await fetch(`${base}/memory`);
      expect(memoryRes.status).toBe(200);
      const memoryHtml = await memoryRes.text();
      expect(memoryHtml).toContain("doc-1");
      // the doc TEXT is escaped, not injected raw — no literal <script> tag reaches the page.
      expect(memoryHtml).not.toContain("<script>evil</script>");
      expect(memoryHtml).toContain("&lt;script&gt;");
    } finally {
      server.stop(true);
    }
  });

  test("a non-GET request is rejected (read-only floor)", async () => {
    const fetchHandler = createInspectorHandler({
      runsRoot: tmpRoot("caisson-inspector-runs-"),
      memoryRoot: tmpRoot("caisson-inspector-memory-"),
    });
    const res = await fetchHandler(
      new Request("http://127.0.0.1/", { method: "POST" }),
    );
    expect(res.status).toBe(405);
  });
});

describe("agent-dev inspector — tenant-path safety (ADR-0073 / SPEC Task 3)", () => {
  test("a traversal tenant id is rejected fail-closed, never opening a store outside memoryRoot", async () => {
    const memoryRoot = tmpRoot("caisson-inspector-memory-");
    const fetchHandler = createInspectorHandler({
      runsRoot: tmpRoot("caisson-inspector-runs-"),
      memoryRoot,
    });
    const res = await fetchHandler(
      new Request("http://127.0.0.1/memory?tenant=../../etc"),
    );
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("denied");

    // never opened anywhere — nothing was created outside (or even inside) memoryRoot.
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(memoryRoot)).toHaveLength(0);
  });

  test("a plain (non-traversal) tenant id still resolves through tenantDbPath and pages cleanly", async () => {
    const memoryRoot = tmpRoot("caisson-inspector-memory-");
    const dbPath = tenantDbPath(memoryRoot, "acme-corp");
    const store = LocalStore.open({ dim: 3, path: dbPath });
    store.upsert({ id: "tenant-doc", text: "acme memory" });
    store.close();

    const fetchHandler = createInspectorHandler({
      runsRoot: tmpRoot("caisson-inspector-runs-"),
      memoryRoot,
    });
    const res = await fetchHandler(
      new Request("http://127.0.0.1/memory?tenant=acme-corp"),
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("tenant-doc");
  });
});

describe("agent-dev inspector — audit tamper-evidence (SPEC Task 4)", () => {
  test("the verify badge flips from VERIFIED to TAMPERED on a tampered snapshot", async () => {
    const store = await seedAuditedChain();
    const clean = store.read();
    expect(clean.entries.length).toBeGreaterThan(0);

    const cleanHandler = createInspectorHandler({
      runsRoot: tmpRoot("caisson-inspector-runs-"),
      memoryRoot: tmpRoot("caisson-inspector-memory-"),
      auditStore: store,
    });
    const cleanRes = await cleanHandler(new Request("http://127.0.0.1/audit"));
    expect(await cleanRes.text()).toContain("VERIFIED");

    // Interior tamper: replace one entry's payload, keeping its now-stale hash — same technique
    // as the agent-dev exit test's tamper case.
    const tamperedEntries: AuditChainEntry[] = clean.entries.map((e) => ({
      ...e,
    }));
    const victim = tamperedEntries[0];
    expect(victim).toBeDefined();
    tamperedEntries[0] = {
      ...(victim as AuditChainEntry),
      payload: { from: "spec", to: "plan", decision: "allow", at: "tampered" },
    };
    const tamperedStore = new InMemoryAuditLifecycleStore();
    tamperedStore.write({
      entries: tamperedEntries,
      versions: clean.versions,
      anchor: clean.anchor,
    });

    const tamperedHandler = createInspectorHandler({
      runsRoot: tmpRoot("caisson-inspector-runs-"),
      memoryRoot: tmpRoot("caisson-inspector-memory-"),
      auditStore: tamperedStore,
    });
    const tamperedRes = await tamperedHandler(
      new Request("http://127.0.0.1/audit"),
    );
    expect(tamperedRes.status).toBe(200); // rendering a tamper finding is not itself an error
    const tamperedHtml = await tamperedRes.text();
    expect(tamperedHtml).toContain("TAMPERED");
    expect(tamperedHtml).not.toContain(">VERIFIED<");
  });
});
