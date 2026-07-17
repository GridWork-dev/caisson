// Tests for registry/scripts/r2-parity-probe.ts. No live network — computeR2Parity is pure over an
// injected {key → FetchOutcome} map, exactly like index-parity-probe.test.ts's fixture style.
import { describe, expect, test } from "bun:test";
import {
  computeR2Parity,
  renderReport,
  sidecarRows,
  type FetchOutcome,
  type SidecarRow,
} from "./r2-parity-probe.ts";
import type { Sidecar } from "./ci-publish-step.ts";

const ROWS: SidecarRow[] = [
  { key: "kernel/kernel-1.2.0.tgz", shasum: "a".repeat(40), size: 100 },
  { key: "compliance/compliance-0.4.0.tgz", shasum: "b".repeat(40), size: 200 },
];

function fetched(
  entries: Record<string, FetchOutcome>,
): Map<string, FetchOutcome> {
  return new Map(Object.entries(entries));
}

describe("sidecarRows", () => {
  test("flattens the sidecar map to {key,shasum,size} rows, dropping integrity/meta", () => {
    const sidecar: Sidecar = {
      tarballs: {
        "@caisson/kernel@1.2.0": {
          key: "kernel/kernel-1.2.0.tgz",
          shasum: "a".repeat(40),
          integrity: "sha512-Zm9v",
          size: 100,
          meta: { dependencies: { zod: "^4.0.0" } },
        },
      },
    };
    expect(sidecarRows(sidecar)).toEqual([
      { key: "kernel/kernel-1.2.0.tgz", shasum: "a".repeat(40), size: 100 },
    ]);
  });
});

describe("computeR2Parity — parity holds", () => {
  test("every advertised object reproduces ⇒ no drift", () => {
    const r = computeR2Parity(
      ROWS,
      fetched({
        "kernel/kernel-1.2.0.tgz": {
          outcome: "found",
          shasum: "a".repeat(40),
          size: 100,
        },
        "compliance/compliance-0.4.0.tgz": {
          outcome: "found",
          shasum: "b".repeat(40),
          size: 200,
        },
      }),
    );
    expect(r.drift).toBe(false);
    expect(r.okCount).toBe(2);
  });

  test("an empty sidecar trivially holds (nothing to check)", () => {
    const r = computeR2Parity([], fetched({}));
    expect(r.drift).toBe(false);
    expect(r.results).toEqual([]);
  });
});

describe("computeR2Parity — drift detection (fail-closed)", () => {
  test("a 404 object ⇒ missing ⇒ drift", () => {
    const r = computeR2Parity(
      ROWS,
      fetched({
        "kernel/kernel-1.2.0.tgz": {
          outcome: "found",
          shasum: "a".repeat(40),
          size: 100,
        },
        "compliance/compliance-0.4.0.tgz": { outcome: "missing" },
      }),
    );
    expect(r.drift).toBe(true);
    expect(
      r.results.find((x) => x.key === "compliance/compliance-0.4.0.tgz")
        ?.status,
    ).toBe("missing");
  });

  test("a shasum that differs ⇒ hash-mismatch ⇒ drift", () => {
    const r = computeR2Parity(
      ROWS,
      fetched({
        "kernel/kernel-1.2.0.tgz": {
          outcome: "found",
          shasum: "c".repeat(40),
          size: 100,
        },
        "compliance/compliance-0.4.0.tgz": {
          outcome: "found",
          shasum: "b".repeat(40),
          size: 200,
        },
      }),
    );
    expect(r.drift).toBe(true);
    const row = r.results.find((x) => x.key === "kernel/kernel-1.2.0.tgz");
    expect(row?.status).toBe("hash-mismatch");
    expect(row?.detail).toContain("!= recorded");
  });

  test("matching shasum but wrong byte size ⇒ size-mismatch ⇒ drift", () => {
    const r = computeR2Parity(
      ROWS,
      fetched({
        "kernel/kernel-1.2.0.tgz": {
          outcome: "found",
          shasum: "a".repeat(40),
          size: 999,
        },
        "compliance/compliance-0.4.0.tgz": {
          outcome: "found",
          shasum: "b".repeat(40),
          size: 200,
        },
      }),
    );
    expect(r.drift).toBe(true);
    expect(
      r.results.find((x) => x.key === "kernel/kernel-1.2.0.tgz")?.status,
    ).toBe("size-mismatch");
  });

  test("an unreachable object (non-404 GET failure) ⇒ drift, never a silent pass", () => {
    const r = computeR2Parity(
      ROWS,
      fetched({
        "kernel/kernel-1.2.0.tgz": {
          outcome: "unreachable",
          detail: "connect timeout",
        },
        "compliance/compliance-0.4.0.tgz": {
          outcome: "found",
          shasum: "b".repeat(40),
          size: 200,
        },
      }),
    );
    expect(r.drift).toBe(true);
    expect(
      r.results.find((x) => x.key === "kernel/kernel-1.2.0.tgz")?.status,
    ).toBe("unreachable");
  });

  test("a row with NO fetch result at all ⇒ unreachable ⇒ drift", () => {
    const r = computeR2Parity(ROWS, fetched({}));
    expect(r.drift).toBe(true);
    expect(r.results.every((x) => x.status === "unreachable")).toBe(true);
  });
});

describe("renderReport", () => {
  test("prints the OK verdict + a count when parity holds, hiding ok rows", () => {
    const out = renderReport(
      computeR2Parity(
        ROWS,
        fetched({
          "kernel/kernel-1.2.0.tgz": {
            outcome: "found",
            shasum: "a".repeat(40),
            size: 100,
          },
          "compliance/compliance-0.4.0.tgz": {
            outcome: "found",
            shasum: "b".repeat(40),
            size: 200,
          },
        }),
      ),
    );
    expect(out).toContain("RESULT: PARITY OK");
    expect(out).toContain("2/2");
    // ok rows are not enumerated (would be 252 lines of noise in prod).
    expect(out).not.toContain("kernel/kernel-1.2.0.tgz");
  });

  test("prints the DRIFT verdict and enumerates only the offending object", () => {
    const out = renderReport(
      computeR2Parity(
        ROWS,
        fetched({
          "kernel/kernel-1.2.0.tgz": {
            outcome: "found",
            shasum: "a".repeat(40),
            size: 100,
          },
          "compliance/compliance-0.4.0.tgz": { outcome: "missing" },
        }),
      ),
    );
    expect(out).toContain("RESULT: DRIFT DETECTED");
    expect(out).toContain("compliance/compliance-0.4.0.tgz");
    expect(out).not.toContain("kernel/kernel-1.2.0.tgz");
  });
});
