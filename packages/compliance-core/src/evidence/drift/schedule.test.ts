// Coverage for the scheduled snapshot task: end-to-end wiring (generate -> diff -> anchor -> alert
// -> persist), the anchor invariant (exactly one outbox row per run, deterministic digest), and
// accepted-deviation suppression threaded through the real handler.
import { describe, expect, test } from "bun:test";
import { flaggedResult, passResult } from "../collector.ts";
import { generateEvidencePack, type EvidencePack } from "../generate.ts";
import { acceptDeviation } from "./deviation.ts";
import type { ComplianceSnapshot } from "./types.ts";
import {
  digestSnapshotPayload,
  type SnapshotAnchorResult,
} from "./anchor-sink.ts";
import type {
  DriftAlertChannel,
  DriftAlertEvent,
  DriftDeliveryResult,
} from "./alert-sink.ts";
import type { AcceptedDeviation } from "./deviation.ts";
import {
  COMPLIANCE_SNAPSHOT_TASK,
  defineComplianceSnapshotTask,
  runComplianceSnapshotOnce,
  snapshotTaskPayloadSchema,
} from "./schedule.ts";

const ACCOUNT_ID = "tenant-drift-1";
const CONTROL_ID = "DATA-PROTECTION.DISPOSAL";
const COLLECTOR_ID = "substrate.worm-retention-floor";
const COLLECTOR_ID_2 = "substrate.some-other-collector";

/** Build a one-control evidence pack; `status` drives whether that control's sole evidence item
 *  passes or is flagged with `reason`. Reuses the real generator so the fixture is representative. */
function buildPack(
  now: Date,
  status: "pass" | "flagged",
  reason?: string,
): EvidencePack {
  const item = {
    collectorId: COLLECTOR_ID,
    controlId: CONTROL_ID,
    title: "WORM retention meets the legal floor",
    summary: "retention posture",
    facts: { ok: status === "pass" },
    manualSlots: [],
  };
  return generateEvidencePack({
    tenantId: ACCOUNT_ID,
    framework: { id: "soc2-tsc", title: "SOC 2", version: "2024.1" },
    chainAnchor: { length: 1, tipHash: "a".repeat(64) },
    crosswalkRollup: { cells: [] },
    controls: [
      {
        controlId: CONTROL_ID,
        title: "Data disposal",
        family: "Data Protection",
        statement: "WORM retention meets the legal floor",
        crosswalk: [],
        evidence: [
          status === "pass"
            ? passResult(item)
            : flaggedResult(item, reason ?? "retain_until short of the floor"),
        ],
      },
    ],
    now,
  });
}

/** A one-control, TWO-collector evidence pack (WR-02): `statusA`/`statusB` drive each collector's
 *  own evidence item independently, so a control can carry two distinct active gaps at once. */
function buildTwoCollectorPack(
  now: Date,
  a: { status: "pass" | "flagged"; reason?: string },
  b: { status: "pass" | "flagged"; reason?: string },
): EvidencePack {
  function item(collectorId: string, status: "pass" | "flagged") {
    return {
      collectorId,
      controlId: CONTROL_ID,
      title: "WORM retention meets the legal floor",
      summary: "retention posture",
      facts: { ok: status === "pass" },
      manualSlots: [],
    };
  }
  return generateEvidencePack({
    tenantId: ACCOUNT_ID,
    framework: { id: "soc2-tsc", title: "SOC 2", version: "2024.1" },
    chainAnchor: { length: 1, tipHash: "a".repeat(64) },
    crosswalkRollup: { cells: [] },
    controls: [
      {
        controlId: CONTROL_ID,
        title: "Data disposal",
        family: "Data Protection",
        statement: "WORM retention meets the legal floor",
        crosswalk: [],
        evidence: [
          a.status === "pass"
            ? passResult(item(COLLECTOR_ID, "pass"))
            : flaggedResult(item(COLLECTOR_ID, "flagged"), a.reason ?? "gap A"),
          b.status === "pass"
            ? passResult(item(COLLECTOR_ID_2, "pass"))
            : flaggedResult(
                item(COLLECTOR_ID_2, "flagged"),
                b.reason ?? "gap B",
              ),
        ],
      },
    ],
    now,
  });
}

/** An in-memory fake wiring every dep — records every call for assertions. */
function fakeDeps(): {
  deps: Parameters<typeof runComplianceSnapshotOnce>[1];
  delivered: DriftAlertEvent[];
  anchorAppends: Array<{ accountId: string; digest: string }>;
  outboxRows: Array<{ accountId: string; anchor: SnapshotAnchorResult }>;
  snapshots: Map<string, ComplianceSnapshot>;
  deviations: Map<string, AcceptedDeviation[]>;
  nextPack: { current: EvidencePack | null };
} {
  const delivered: DriftAlertEvent[] = [];
  const anchorAppends: Array<{ accountId: string; digest: string }> = [];
  const outboxRows: Array<{ accountId: string; anchor: SnapshotAnchorResult }> =
    [];
  const snapshots = new Map<string, ComplianceSnapshot>();
  const deviations = new Map<string, AcceptedDeviation[]>();
  const nextPack: { current: EvidencePack | null } = { current: null };
  let anchorLength = 0;

  const captureChannel: DriftAlertChannel = {
    name: "capture",
    async deliver(event: DriftAlertEvent): Promise<DriftDeliveryResult> {
      delivered.push(event);
      return { channel: "capture", ok: true };
    },
  };

  const deps: Parameters<typeof runComplianceSnapshotOnce>[1] = {
    async generateSnapshot(): Promise<EvidencePack> {
      if (nextPack.current === null) {
        throw new Error("test fixture: nextPack.current was not set");
      }
      return nextPack.current;
    },
    async loadPreviousSnapshot(accountId: string) {
      return snapshots.get(accountId) ?? null;
    },
    async persistSnapshot(accountId: string, snapshot: ComplianceSnapshot) {
      snapshots.set(accountId, snapshot);
    },
    async loadDeviations(accountId: string) {
      return deviations.get(accountId) ?? [];
    },
    alertChannels: [captureChannel],
    alertRecipient: "compliance@buyer.example",
    anchorSink: {
      async appendSnapshotDigest(accountId, payload) {
        const digest = digestSnapshotPayload(payload);
        anchorAppends.push({ accountId, digest });
        anchorLength += 1;
        return { length: anchorLength, tipHash: digest };
      },
      async enqueueOutboxRow(accountId, anchor) {
        outboxRows.push({ accountId, anchor });
      },
    },
    now: () => new Date("2026-08-01T00:00:00.000Z"),
    newId: (() => {
      let n = 0;
      return () => `evt-${String((n += 1))}`;
    })(),
  };

  return {
    deps,
    delivered,
    anchorAppends,
    outboxRows,
    snapshots,
    deviations,
    nextPack,
  };
}

describe("defineComplianceSnapshotTask — TaskDefinition shape", () => {
  test("carries the retention-runner-style {name, schema, handler} shape", () => {
    const { deps } = fakeDeps();
    const task = defineComplianceSnapshotTask(deps);
    expect(task.name).toBe(COMPLIANCE_SNAPSHOT_TASK);
    expect(task.schema).toBe(snapshotTaskPayloadSchema);
    expect(typeof task.handler).toBe("function");
  });

  test("the payload schema is .strict() and requires accountId", () => {
    expect(() => snapshotTaskPayloadSchema.parse({})).toThrow();
    expect(() =>
      snapshotTaskPayloadSchema.parse({ accountId: "t1", extra: "nope" }),
    ).toThrow();
    expect(snapshotTaskPayloadSchema.parse({ accountId: "t1" })).toEqual({
      accountId: "t1",
    });
  });
});

describe("runComplianceSnapshotOnce — anchoring (SPEC item 5)", () => {
  test("every run appends exactly one anchor outbox row, with a deterministic digest", async () => {
    const { deps, anchorAppends, outboxRows, nextPack } = fakeDeps();
    const now = new Date("2026-08-01T00:00:00.000Z");

    nextPack.current = buildPack(now, "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);
    expect(anchorAppends).toHaveLength(1);
    expect(outboxRows).toHaveLength(1);

    // A second run over IDENTICAL evidence digests to the SAME value (deterministic).
    nextPack.current = buildPack(new Date("2026-08-02T00:00:00.000Z"), "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);
    expect(anchorAppends).toHaveLength(2);
    expect(outboxRows).toHaveLength(2);
    expect(anchorAppends[0]?.digest).toBe(anchorAppends[1]?.digest);
  });

  test("a regression run still anchors exactly once, with a different digest than the baseline", async () => {
    const { deps, anchorAppends, nextPack } = fakeDeps();
    const now = new Date("2026-08-01T00:00:00.000Z");

    nextPack.current = buildPack(now, "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    nextPack.current = buildPack(
      now,
      "flagged",
      "retain_until short of the floor",
    );
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    expect(anchorAppends).toHaveLength(2);
    expect(anchorAppends[0]?.digest).not.toBe(anchorAppends[1]?.digest);
  });
});

describe("runComplianceSnapshotOnce — regression alerting + deviation suppression (end to end)", () => {
  test("the baseline (first) run establishes state without alerting", async () => {
    const { deps, delivered, nextPack } = fakeDeps();
    nextPack.current = buildPack(new Date("2026-08-01T00:00:00.000Z"), "pass");
    const result = await runComplianceSnapshotOnce(
      { accountId: ACCOUNT_ID },
      deps,
    );
    expect(delivered).toHaveLength(0);
    // First run: every row transitions from "absent" (no prior snapshot) — none is "to: flagged".
    expect(result.transitions.every((t) => t.to !== "flagged")).toBe(true);
  });

  test("a regression with no accepted deviation fires exactly one alert", async () => {
    const { deps, delivered, nextPack } = fakeDeps();
    nextPack.current = buildPack(new Date("2026-08-01T00:00:00.000Z"), "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    nextPack.current = buildPack(
      new Date("2026-08-02T00:00:00.000Z"),
      "flagged",
      "retain_until short of the floor",
    );
    const result = await runComplianceSnapshotOnce(
      { accountId: ACCOUNT_ID },
      deps,
    );

    expect(result.transitions).toHaveLength(1);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]?.title).toContain(CONTROL_ID);
    expect(delivered[0]?.body).toContain("retain_until short of the floor");
  });

  test("an accepted deviation matching the exact regression suppresses the alert", async () => {
    const { deps, delivered, deviations, snapshots, nextPack } = fakeDeps();
    nextPack.current = buildPack(new Date("2026-08-01T00:00:00.000Z"), "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    // Accept a deviation against the SAME reason the next run will flag.
    const knownGapReason = "retain_until short of the floor";
    const flaggedSnapshotForBaseline: ComplianceSnapshot = [
      {
        controlId: CONTROL_ID,
        collectorId: COLLECTOR_ID,
        status: "flagged",
        reason: knownGapReason,
      },
    ];
    deviations.set(ACCOUNT_ID, [
      acceptDeviation({
        id: "dev-1",
        controlId: CONTROL_ID,
        reason: "contractor offboarding scheduled",
        acceptor: "compliance@buyer.example",
        expiresAt: "2027-01-01T00:00:00.000Z",
        snapshot: flaggedSnapshotForBaseline,
      }),
    ]);

    nextPack.current = buildPack(
      new Date("2026-08-02T00:00:00.000Z"),
      "flagged",
      knownGapReason,
    );
    const result = await runComplianceSnapshotOnce(
      { accountId: ACCOUNT_ID },
      deps,
    );

    expect(result.transitions).toHaveLength(1); // the snapshot still honestly records the gap...
    expect(delivered).toHaveLength(0); // ...but the alert is suppressed.
    // Flag-never-guess: the deviation never flips the persisted snapshot to "pass".
    expect(snapshots.get(ACCOUNT_ID)?.[0]?.status).toBe("flagged");
  });

  test("a regression past the accepted baseline (a different reason) alerts despite the deviation", async () => {
    const { deps, delivered, deviations, nextPack } = fakeDeps();
    nextPack.current = buildPack(new Date("2026-08-01T00:00:00.000Z"), "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    const acceptedReason = "retain_until short of the floor";
    deviations.set(ACCOUNT_ID, [
      acceptDeviation({
        id: "dev-1",
        controlId: CONTROL_ID,
        reason: "contractor offboarding scheduled",
        acceptor: "compliance@buyer.example",
        expiresAt: "2027-01-01T00:00:00.000Z",
        snapshot: [
          {
            controlId: CONTROL_ID,
            collectorId: COLLECTOR_ID,
            status: "flagged",
            reason: acceptedReason,
          },
        ],
      }),
    ]);

    // A DIFFERENT, unaccepted flagged reason — a genuine new/worse gap.
    nextPack.current = buildPack(
      new Date("2026-08-02T00:00:00.000Z"),
      "flagged",
      "a completely different, never-accepted gap",
    );
    const result = await runComplianceSnapshotOnce(
      { accountId: ACCOUNT_ID },
      deps,
    );

    expect(result.transitions).toHaveLength(1);
    expect(delivered).toHaveLength(1);
  });

  test("expiry re-arms alerting for a previously-suppressed, still-matching regression", async () => {
    const { deps, delivered, deviations, snapshots, nextPack } = fakeDeps();
    nextPack.current = buildPack(new Date("2026-08-01T00:00:00.000Z"), "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    const knownGapReason = "retain_until short of the floor";
    // Already-expired relative to the injected `now` (2026-08-01) the fake deps always return.
    deviations.set(ACCOUNT_ID, [
      acceptDeviation({
        id: "dev-1",
        controlId: CONTROL_ID,
        reason: "contractor offboarding scheduled",
        acceptor: "compliance@buyer.example",
        expiresAt: "2020-01-01T00:00:00.000Z",
        snapshot: [
          {
            controlId: CONTROL_ID,
            collectorId: COLLECTOR_ID,
            status: "flagged",
            reason: knownGapReason,
          },
        ],
      }),
    ]);
    // Reset the "previous" snapshot back to passing so this run again produces a pass -> flagged
    // transition (simulating: the gap recurred after the deviation's window lapsed).
    snapshots.set(ACCOUNT_ID, [
      { controlId: CONTROL_ID, collectorId: COLLECTOR_ID, status: "pass" },
    ]);

    nextPack.current = buildPack(
      new Date("2026-08-02T00:00:00.000Z"),
      "flagged",
      knownGapReason,
    );
    const result = await runComplianceSnapshotOnce(
      { accountId: ACCOUNT_ID },
      deps,
    );

    expect(result.transitions).toHaveLength(1);
    expect(delivered).toHaveLength(1); // expired -> not suppressed
  });
});

describe("runComplianceSnapshotOnce — multiple active deviations on one control (WR-02)", () => {
  async function runWithOrder(
    order: "a-then-b" | "b-then-a",
  ): Promise<DriftAlertEvent[]> {
    const { deps, delivered, deviations, nextPack } = fakeDeps();

    nextPack.current = buildTwoCollectorPack(
      new Date("2026-08-01T00:00:00.000Z"),
      { status: "pass" },
      { status: "pass" },
    );
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    const reasonA = "gap A — accepted";
    const reasonB = "gap B — accepted";
    // Two SEPARATE acceptances, each against a snapshot carrying only its own collector's gap —
    // mirroring two independent accept actions, each with its own narrow baseline.
    const devA = acceptDeviation({
      id: "dev-a",
      controlId: CONTROL_ID,
      reason: "accepted gap A",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: [
        {
          controlId: CONTROL_ID,
          collectorId: COLLECTOR_ID,
          status: "flagged",
          reason: reasonA,
        },
      ],
    });
    const devB = acceptDeviation({
      id: "dev-b",
      controlId: CONTROL_ID,
      reason: "accepted gap B",
      acceptor: "compliance@buyer.example",
      expiresAt: "2027-01-01T00:00:00.000Z",
      snapshot: [
        {
          controlId: CONTROL_ID,
          collectorId: COLLECTOR_ID_2,
          status: "flagged",
          reason: reasonB,
        },
      ],
    });
    deviations.set(
      ACCOUNT_ID,
      order === "a-then-b" ? [devA, devB] : [devB, devA],
    );

    nextPack.current = buildTwoCollectorPack(
      new Date("2026-08-02T00:00:00.000Z"),
      { status: "flagged", reason: reasonA },
      { status: "flagged", reason: reasonB },
    );
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps);

    return delivered;
  }

  test("both collectors' regressions are suppressed regardless of deviation array order (a-then-b)", async () => {
    expect(await runWithOrder("a-then-b")).toHaveLength(0);
  });

  test("both collectors' regressions are suppressed regardless of deviation array order (b-then-a)", async () => {
    expect(await runWithOrder("b-then-a")).toHaveLength(0);
  });
});

describe("runComplianceSnapshotOnce — first run never alerts on pre-existing gaps (WR-03)", () => {
  test("a flagged first-run pack yields zero deliveries but still anchors once and persists", async () => {
    const { deps, delivered, anchorAppends, outboxRows, snapshots, nextPack } =
      fakeDeps();

    nextPack.current = buildPack(
      new Date("2026-08-01T00:00:00.000Z"),
      "flagged",
      "pre-existing gap, never previously seen",
    );
    const result = await runComplianceSnapshotOnce(
      { accountId: ACCOUNT_ID },
      deps,
    );

    expect(delivered).toHaveLength(0);
    expect(anchorAppends).toHaveLength(1);
    expect(outboxRows).toHaveLength(1);
    expect(snapshots.get(ACCOUNT_ID)?.[0]?.status).toBe("flagged");
    expect(result.transitions.some((t) => t.to === "flagged")).toBe(true);
  });

  test("a NEW collector appearing flagged on a later run still alerts (no from === absent gate)", async () => {
    const { deps, delivered, nextPack } = fakeDeps();

    nextPack.current = buildPack(new Date("2026-08-01T00:00:00.000Z"), "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps); // run 1: baseline

    nextPack.current = buildPack(new Date("2026-08-02T00:00:00.000Z"), "pass");
    await runComplianceSnapshotOnce({ accountId: ACCOUNT_ID }, deps); // run 2: still clean

    // Run 3 introduces a brand-new collector, straight to flagged (from: "absent" -> "flagged").
    nextPack.current = buildTwoCollectorPack(
      new Date("2026-08-03T00:00:00.000Z"),
      { status: "pass" },
      {
        status: "flagged",
        reason: "a brand new collector, flagged from birth",
      },
    );
    const result = await runComplianceSnapshotOnce(
      { accountId: ACCOUNT_ID },
      deps,
    );

    const newCollectorTransition = result.transitions.find(
      (t) => t.collectorId === COLLECTOR_ID_2,
    );
    expect(newCollectorTransition?.from).toBe("absent");
    expect(newCollectorTransition?.to).toBe("flagged");
    expect(delivered).toHaveLength(1); // prior !== null (this is run 3) -> alerts normally
  });
});
