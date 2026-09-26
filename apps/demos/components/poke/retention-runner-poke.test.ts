// The retention-runner poke's checkable claims, now that it drives the REAL
// `@caisson-sh/retention-runner/browser` and the hand-ported mirror (retention-runner-logic.ts) is
// deleted. No parity suite survives because there is nothing left to compare — the isolation and
// audit-row assertions below exercise the package's own `runErasure`, where the mirror's suite only
// ever proved a copy of it agreed with the original.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import {
  createCaptureAuditSink,
  runErasure,
} from "@caisson-sh/retention-runner/browser";
import { ERASURE_CRYPTO_SHRED as pkgErasureCryptoShred } from "../../../../packages/field-crypto/src/crypto-shred.ts";

import {
  ERASURE_CRYPTO_SHRED,
  NO_FAILURES,
  SAMPLE_SUBJECT_ID,
  SAMPLE_TENANT_ID,
  referenceTargets,
} from "./retention-runner-poke";
import type { FailingState } from "./retention-runner-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "retention-runner-poke.tsx");

test("the async erasure control is single-flight", () => {
  const source = readFileSync(POKE_ENTRY, "utf8");
  expect(source).toContain("if (busy) return;");
  expect(source).toContain("disabled={busy}");
});

const SAMPLE_REQUEST = {
  subjectId: SAMPLE_SUBJECT_ID,
  tenantId: SAMPLE_TENANT_ID,
  reason: "ccpa_request",
} as const;

function targetsOf(failing: FailingState) {
  return referenceTargets(failing).map((r) => r.target);
}

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: the UI kit alone contributes dozens of files, so files.length can never
    // prove the retention-runner edges resolved. These files are reachable ONLY through
    // @caisson-sh/retention-runner/browser's own imports — the entry, then a second hop into kernel —
    // so a resolver that went blind inside a workspace package fails here.
    expect(walk.files).toContain("packages/retention-runner/src/browser.ts");
    expect(walk.files).toContain(
      "packages/retention-runner/src/run-erasure.ts",
    );
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the job-queue half and field-crypto stay out of the bundle graph", () => {
    // ./browser exists precisely to leave these behind: schedule.ts drags @caisson-sh/jobs, and
    // field-crypto is irreducibly node-only (which is why the shred event name is a quoted
    // constant here, pinned below, rather than an import).
    expect(
      walk.files.some((f) => f.endsWith("retention-runner/src/schedule.ts")),
    ).toBe(false);
    expect(walk.files.some((f) => f.startsWith("packages/jobs/"))).toBe(false);
    expect(walk.files.some((f) => f.startsWith("packages/field-crypto/"))).toBe(
      false,
    );
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/retention-runner/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
  });
});

describe("the cited field-crypto vocabulary is the real constant", () => {
  test("the quoted shred event name matches crypto-shred.ts", () => {
    expect(ERASURE_CRYPTO_SHRED).toBe(pkgErasureCryptoShred);
  });
});

describe("the reference targets are the package's own, not restated", () => {
  test("each target carries the name its real factory hardcodes", () => {
    expect(referenceTargets(NO_FAILURES).map((r) => r.target.name)).toEqual([
      "object-storage-purge",
      "cascade-db-delete",
      "orphan-record-sweep",
    ]);
  });

  test("a healthy target resolves; a broken one rejects through the package's own erase seam", async () => {
    const [healthy] = referenceTargets(NO_FAILURES);
    const [broken] = referenceTargets({ ...NO_FAILURES, objectStorage: true });
    if (healthy === undefined || broken === undefined) {
      throw new Error("reference targets empty");
    }
    await expect(
      healthy.target.erase(SAMPLE_SUBJECT_ID, SAMPLE_TENANT_ID),
    ).resolves.toBeUndefined();
    await expect(
      broken.target.erase(SAMPLE_SUBJECT_ID, SAMPLE_TENANT_ID),
    ).rejects.toThrow("store unreachable");
  });
});

describe("the real runErasure under the poke's seams", () => {
  test("a clean run erases every target and writes exactly one reason-tagged row", async () => {
    const sink = createCaptureAuditSink();
    const row = await runErasure(
      SAMPLE_REQUEST,
      targetsOf(NO_FAILURES),
      sink,
      () => 1_000,
    );
    expect(row.results).toEqual([
      { target: "object-storage-purge", ok: true },
      { target: "cascade-db-delete", ok: true },
      { target: "orphan-record-sweep", ok: true },
    ]);
    expect(row.reason).toBe("ccpa_request");
    expect(row.at).toBe(1_000);
    expect(sink.rows).toEqual([row]);
  });

  test("one broken store never aborts the others, and one row still lands", async () => {
    const sink = createCaptureAuditSink();
    const row = await runErasure(
      SAMPLE_REQUEST,
      targetsOf({ ...NO_FAILURES, cascadeDb: true }),
      sink,
      () => 2_000,
    );
    expect(row.results).toEqual([
      { target: "object-storage-purge", ok: true },
      { target: "cascade-db-delete", ok: false, error: "store unreachable" },
      { target: "orphan-record-sweep", ok: true },
    ]);
    expect(sink.rows).toHaveLength(1);
  });

  test("all three broken still lands exactly one row", async () => {
    const sink = createCaptureAuditSink();
    const row = await runErasure(
      SAMPLE_REQUEST,
      targetsOf({ objectStorage: true, cascadeDb: true, orphanSweep: true }),
      sink,
      () => 3_000,
    );
    expect(row.results.every((r) => !r.ok)).toBe(true);
    expect(sink.rows).toHaveLength(1);
  });

  test("the real fail-closed request guard runs before any target does", async () => {
    // The mirror deliberately omitted this leg; the real function has it, so the poke gets it free.
    const sink = createCaptureAuditSink();
    const rejection: unknown = await runErasure(
      { ...SAMPLE_REQUEST, reason: "not_a_reason" as never },
      targetsOf(NO_FAILURES),
      sink,
      () => 4_000,
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(rejection).toBeInstanceOf(ValidationError);
    expect(sink.rows).toEqual([]);
  });
});
