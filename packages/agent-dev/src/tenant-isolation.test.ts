// C4 (ADR-0073): the composed Agentic-Dev edition isolates agent memory PER TENANT at the SQLite-file
// level. Proves the wire, not just the base primitive (`tenant-db.test.ts` already proves
// `tenantDbPath` itself) — two tenants get two edition instances whose memories cannot see each other,
// and the fail-closed guards refuse a malformed id or an ambiguous (tenant + memoryPath) config.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryAuditLifecycleStore } from "@caisson-sh/agent-kernel";
import { createAgentDevEdition } from "./index.ts";

const roots: string[] = [];
function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "agentdev-tenant-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root !== undefined) rmSync(root, { recursive: true, force: true });
  }
});

describe("agent-dev edition — per-tenant memory isolation (ADR-0073)", () => {
  test("two tenants under one root cannot read each other's memory", () => {
    const root = tempRoot();
    const alpha = createAgentDevEdition({
      store: new InMemoryAuditLifecycleStore(),
      memoryDim: 8,
      tenant: { root, tenantId: "alpha" },
    });
    const beta = createAgentDevEdition({
      store: new InMemoryAuditLifecycleStore(),
      memoryDim: 8,
      tenant: { root, tenantId: "beta" },
    });

    alpha.memory.upsert({ id: "a1", text: "the quick brown fox" });
    beta.memory.upsert({ id: "b1", text: "a lazy sleeping hound" });

    // Each tenant sees ONLY its own document; the other's is not even expressible.
    expect(
      alpha.memory.hybridSearch({ queryText: "fox" }).map((h) => h.id),
    ).toEqual(["a1"]);
    expect(alpha.memory.hybridSearch({ queryText: "hound" })).toEqual([]);
    expect(
      beta.memory.hybridSearch({ queryText: "hound" }).map((h) => h.id),
    ).toEqual(["b1"]);
    expect(beta.memory.hybridSearch({ queryText: "fox" })).toEqual([]);

    alpha.close();
    beta.close();
  });

  test("a malformed tenantId is refused fail-closed, before any store opens", () => {
    const root = tempRoot();
    for (const bad of ["../escape", "a/b", "", "with\0null"]) {
      expect(() =>
        createAgentDevEdition({
          store: new InMemoryAuditLifecycleStore(),
          memoryDim: 8,
          tenant: { root, tenantId: bad },
        }),
      ).toThrow();
    }
  });

  test("tenant and memoryPath together is rejected (no ambiguous isolation)", () => {
    const root = tempRoot();
    expect(() =>
      createAgentDevEdition({
        store: new InMemoryAuditLifecycleStore(),
        memoryDim: 8,
        tenant: { root, tenantId: "alpha" },
        memoryPath: join(root, "shared.db"),
      }),
    ).toThrow(/mutually exclusive/);
  });
});
