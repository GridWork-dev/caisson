// Tests for per-tenant changeset capture (ADR-0064/0073). In-process, deterministic,
// NO network: every store is an in-memory `bun:sqlite` DB and the clock is injected, so capture is
// reproducible. The security spine is the tenant partition — a tenant-A changeset must never be
// applicable to a tenant-B file — plus the fail-closed boundary parse for an untrusted peer changeset.
import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { TenancyError, ValidationError } from "@caisson-sh/kernel";
import { ChangesetLog, parseChangeset } from "./changeset.ts";
import type { Changeset } from "./port.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A monotonically-incrementing clock so captured `updatedAt` values are deterministic per test. */
function tickClock(start = 1000): () => number {
  let t = start;
  return () => t++;
}

function openLog(
  tenantId: string,
  db = new Database(":memory:"),
): ChangesetLog {
  return ChangesetLog.open(db, tenantId, { now: tickClock() });
}

describe("ChangesetLog.open (tenant binding + replica id)", () => {
  test("mints a stable UUID replica id on first init", () => {
    const log = openLog("tenant-a");
    expect(log.tenantId).toBe("tenant-a");
    expect(log.replicaId).toMatch(UUID_RE);
  });

  test("re-opening the same file reuses the persisted replica id", () => {
    const db = new Database(":memory:");
    const first = ChangesetLog.open(db, "tenant-a");
    const second = ChangesetLog.open(db, "tenant-a");
    expect(second.replicaId).toBe(first.replicaId);
  });

  test("re-opening a file bound to another tenant fails closed", () => {
    const db = new Database(":memory:");
    ChangesetLog.open(db, "tenant-a"); // binds the file to tenant-a
    expect(() => ChangesetLog.open(db, "tenant-b")).toThrow(TenancyError);
  });

  test("an empty or null-byte tenantId is rejected", () => {
    expect(() => openLog("")).toThrow(ValidationError);
    expect(() => openLog("a\0b")).toThrow(ValidationError);
  });
});

describe("ChangesetLog capture (canonical store is authority)", () => {
  test("captures upserts + deletes in monotonic seq order with full values", () => {
    const log = openLog("tenant-a");
    log.recordUpsert("docs", "d1", { text: "hello", n: 1 });
    log.recordUpsert("docs", "d2", { text: "world" });
    log.recordDelete("docs", "d1");

    const cs = log.capture(0);
    expect(cs.tenantId).toBe("tenant-a");
    expect(cs.replicaId).toBe(log.replicaId);
    expect(cs.entries.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(cs.until).toBe(3);

    const [up1, up2, del1] = cs.entries;
    expect(up1?.op).toBe("upsert");
    expect(up1?.values).toEqual({ text: "hello", n: 1 });
    expect(up2?.values).toEqual({ text: "world" });
    expect(del1?.op).toBe("delete");
    expect(del1?.values).toBeNull();
  });

  test("captured updatedAt comes from the injected clock (deterministic)", () => {
    const db = new Database(":memory:");
    const log = ChangesetLog.open(db, "tenant-a", { now: tickClock(5000) });
    log.recordUpsert("docs", "d1", { text: "a" });
    log.recordUpsert("docs", "d2", { text: "b" });
    const cs = log.capture(0);
    expect(cs.entries.map((e) => e.updatedAt)).toEqual([5000, 5001]);
  });

  test("capture(sinceSeq) returns only changes past the watermark, until = max", () => {
    const log = openLog("tenant-a");
    log.recordUpsert("docs", "d1", { text: "a" });
    log.recordUpsert("docs", "d2", { text: "b" });
    log.recordUpsert("docs", "d3", { text: "c" });

    const tail = log.capture(1);
    expect(tail.entries.map((e) => e.seq)).toEqual([2, 3]);
    expect(tail.until).toBe(3);
  });

  test("an empty log captures no entries but still reports until", () => {
    const log = openLog("tenant-a");
    const cs = log.capture(0);
    expect(cs.entries).toHaveLength(0);
    expect(cs.until).toBe(0);
  });

  test("capturing past the high-water mark yields an empty slice at that watermark", () => {
    const log = openLog("tenant-a");
    log.recordUpsert("docs", "d1", { text: "a" });
    const cs = log.capture(10);
    expect(cs.entries).toHaveLength(0);
    expect(cs.until).toBe(10);
  });

  test("recording a row with an empty table or pk fails closed", () => {
    const log = openLog("tenant-a");
    expect(() => log.recordUpsert("", "d1", { text: "a" })).toThrow(
      ValidationError,
    );
    expect(() => log.recordDelete("docs", "")).toThrow(ValidationError);
  });
});

describe("ChangesetLog.assertApplicable (the tenant-partition guard)", () => {
  test("accepts a changeset bound to this tenant's file", () => {
    const log = openLog("tenant-a");
    log.recordUpsert("docs", "d1", { text: "a" });
    expect(() => log.assertApplicable(log.capture(0))).not.toThrow();
  });

  test("rejects a tenant-B changeset against a tenant-A file (no cross-tenant apply)", () => {
    const logA = openLog("tenant-a");
    const logB = openLog("tenant-b");
    logB.recordUpsert("docs", "d1", { text: "leak" });
    const fromB = logB.capture(0);
    expect(() => logA.assertApplicable(fromB)).toThrow(TenancyError);
  });
});

describe("parseChangeset (fail-closed peer boundary)", () => {
  const valid: Changeset = {
    tenantId: "tenant-a",
    replicaId: "11111111-1111-1111-1111-111111111111",
    until: 2,
    entries: [
      {
        table: "docs",
        pk: "d1",
        op: "upsert",
        values: { text: "a", n: 1 },
        updatedAt: 1000,
        seq: 1,
      },
      {
        table: "docs",
        pk: "d1",
        op: "delete",
        values: null,
        updatedAt: 1001,
        seq: 2,
      },
    ],
  };

  test("a well-formed changeset round-trips", () => {
    expect(parseChangeset(valid)).toEqual(valid);
  });

  test("an unknown top-level key fails closed (.strict)", () => {
    expect(() => parseChangeset({ ...valid, sneaky: true })).toThrow(
      ValidationError,
    );
  });

  test("an unknown key inside an entry fails closed (.strict)", () => {
    expect(() =>
      parseChangeset({
        ...valid,
        entries: [{ ...valid.entries[0], extra: 1 }],
      }),
    ).toThrow(ValidationError);
  });

  test("an upsert entry without values fails closed", () => {
    expect(() =>
      parseChangeset({
        ...valid,
        entries: [{ ...valid.entries[0], values: null }],
      }),
    ).toThrow(ValidationError);
  });

  test("a delete entry carrying values fails closed", () => {
    expect(() =>
      parseChangeset({
        ...valid,
        entries: [{ ...valid.entries[1], values: { text: "x" } }],
      }),
    ).toThrow(ValidationError);
  });

  test("an unknown op is rejected (closed enum)", () => {
    expect(() =>
      parseChangeset({
        ...valid,
        entries: [{ ...valid.entries[0], op: "merge" }],
      }),
    ).toThrow(ValidationError);
  });

  test("an entry seq past the watermark fails closed", () => {
    expect(() =>
      parseChangeset({
        ...valid,
        until: 1,
        entries: [{ ...valid.entries[0], seq: 5 }],
      }),
    ).toThrow(ValidationError);
  });

  test("a non-finite numeric value is rejected", () => {
    expect(() =>
      parseChangeset({
        ...valid,
        entries: [
          { ...valid.entries[0], values: { bad: Number.POSITIVE_INFINITY } },
        ],
      }),
    ).toThrow(ValidationError);
  });
});
