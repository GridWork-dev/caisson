// apps/agent-dev/test/exit.test.ts — the goal-backward EXIT integration test (P4b · T22, folds the
// dropped T23). It re-asks the SPEC goal against the running reference app, not a task checklist:
// the agent-dev edition GOVERNS, VALIDATES, and RECORDS a lifecycle (tamper-evident), retrieves from
// a hybrid memory that works fully OFFLINE, and EMITS one schema to every harness — engine-neutral,
// no live cloud/model call. Each block maps to one exit-gate clause:
//   • tamper-evident record — the chain verifies against its anchor; a tampered/truncated step fails;
//   • offline memory — FTS5 floor returns results with no embedder; RRF returns results when embedded;
//   • multi-harness emit — three byte-stable bundles, no secret written, no path escape of the root.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { describe, expect, test } from "bun:test";
import type { AuditChainEntry, Embedder } from "@caisson/agent-dev";
import {
  EmitSecurityError,
  defineRule,
  renderHarnessBundles,
  verifyChain,
  writeBundle,
} from "@caisson/agent-dev";
import { runAgentDevDemo } from "../src/index.ts";

const DIM = 8;

/** A deterministic, content-derived embedder — a TEST DOUBLE; never a live model/network call. */
const fakeEmbedder: Embedder = {
  dim: DIM,
  embed(text: string): Promise<number[]> {
    const vector = new Array<number>(DIM).fill(0);
    for (let i = 0; i < text.length; i++) {
      vector[i % DIM] = (vector[i % DIM] ?? 0) + (text.charCodeAt(i) % 13);
    }
    return Promise.resolve(vector);
  },
};

/** A monotonic fixed clock so the audited chain is reproducible across runs. */
function fixedClock(): () => string {
  let n = 0;
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, n++)).toISOString();
}

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), "caisson-agent-dev-test-"));
}

describe("agent-dev CLI reference app — goal-backward exit", () => {
  test("drives the governed lifecycle end-to-end into a verifiable tamper-evident record", async () => {
    const report = await runAgentDevDemo({
      targetRoot: tmpRoot(),
      now: fixedClock(),
    });

    expect(report.recordedSteps).toBe(report.lifecyclePath.length - 1);
    expect(report.recordedSteps).toBeGreaterThan(0);
    expect(report.entries.length).toBe(report.recordedSteps);
    expect(report.anchor.length).toBe(report.entries.length);
    // the run's own claim and an independent re-verification both hold.
    expect(report.verified).toBe(true);
    expect(verifyChain(report.entries, report.anchor).valid).toBe(true);
  });

  test("a tampered step and a truncated tail both fail verifyChain against the anchor", async () => {
    const report = await runAgentDevDemo({
      targetRoot: tmpRoot(),
      now: fixedClock(),
    });
    expect(verifyChain(report.entries, report.anchor).valid).toBe(true);

    // interior tamper: replace one entry's payload but keep its (now-stale) hash → recompute mismatch.
    const tampered: AuditChainEntry[] = report.entries.map((entry) => ({
      ...entry,
    }));
    const victim = tampered[1];
    expect(victim).toBeDefined();
    tampered[1] = {
      ...victim!,
      payload: { from: "spec", to: "ship", decision: "allow", at: "tampered" },
    };
    const interior = verifyChain(tampered, report.anchor);
    expect(interior.valid).toBe(false);
    expect(interior.brokenAt).toBe(1);

    // tail truncation: internally consistent, but the anchor pins length + tip → caught.
    const truncated = verifyChain(report.entries.slice(0, -1), report.anchor);
    expect(truncated.valid).toBe(false);
  });

  test("hybrid memory returns results fully offline via the FTS5 fallback (no embedder)", async () => {
    const report = await runAgentDevDemo({ targetRoot: tmpRoot() });
    expect(report.retrieval).toBe("fts-only");
    expect(report.memoryHits.length).toBeGreaterThan(0);
  });

  test("hybrid memory returns results via RRF when embeddings exist", async () => {
    const report = await runAgentDevDemo({
      targetRoot: tmpRoot(),
      embedder: fakeEmbedder,
      memoryDim: DIM,
    });
    expect(report.retrieval).toBe("rrf");
    expect(report.memoryHits.length).toBeGreaterThan(0);
  });

  test("emits all three harness bundles under the target root, byte-stable across runs", async () => {
    const report = await runAgentDevDemo({ targetRoot: tmpRoot() });

    const claude = report.emitted.filter((p) =>
      p.includes(`${sep}.claude${sep}`),
    );
    const cursor = report.emitted.filter((p) =>
      p.includes(`${sep}.cursor${sep}`),
    );
    const codex = report.emitted.filter((p) => p.endsWith(`${sep}AGENTS.md`));
    expect(claude.length).toBeGreaterThan(0); // Claude Code — one file per artifact + hooks manifest
    expect(cursor.length).toBeGreaterThan(0); // Cursor — one .mdc per artifact
    expect(codex.length).toBe(1); // Codex — one aggregated AGENTS.md

    // every emitted file exists + is non-empty on disk.
    for (const path of report.emitted) {
      expect(readFileSync(path, "utf8").length).toBeGreaterThan(0);
    }

    // byte-stable: a second run into a fresh root produces identical content per file (deterministic).
    const second = await runAgentDevDemo({ targetRoot: tmpRoot() });
    expect(second.emitted.length).toBe(report.emitted.length);
    for (let i = 0; i < report.emitted.length; i++) {
      expect(readFileSync(second.emitted[i]!, "utf8")).toBe(
        readFileSync(report.emitted[i]!, "utf8"),
      );
    }
  });

  test("the emitter refuses a path escape of the target root (fail-closed, nothing written)", () => {
    expect(() =>
      writeBundle(tmpRoot(), {
        files: [{ path: "../escaped.md", content: "x" }],
      }),
    ).toThrow(EmitSecurityError);
  });

  test("the emitter refuses to write a secret into any emitted bundle (fail-closed)", () => {
    const leaky = defineRule({
      name: "leaky-rule",
      description:
        "never embed a key like sk-proj-abcdefghijklmnop0123456789 here",
      severity: "error",
    });
    expect(() =>
      writeBundle(
        tmpRoot(),
        renderHarnessBundles({ artifacts: [leaky], hooks: [] }),
      ),
    ).toThrow(EmitSecurityError);
  });
});
