// ADR-0286 admin intel page — readIntelFindings on PGlite via @caisson/testing. Seeds directly
// into intel.findings (mirroring the daemon's own upsert shape) and reads as the read-only
// `admin` role — the same seam the page uses.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Transactor, TenantExecutor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  INTEL_ADMIN_READ_GRANT_SQL,
  INTEL_SCHEMA_SQL,
  isIntelSeverity,
  isIntelSource,
  readIntelFindings,
} from "./intel-read.ts";

let tp: TestPg;
let db: Transactor;

async function asAdmin<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE admin`);
    return fn(tx);
  });
}

async function seedFinding(overrides: {
  source: string;
  severity: string;
  title: string;
  lastSeen?: string;
}): Promise<void> {
  await tp.query(
    `INSERT INTO intel.findings (id, source, kind, severity, title, body, dedup_key, run_id, last_seen)
     VALUES ($1, $2, 'test-kind', $3, $4, 'body text', $5, $6, COALESCE($7::timestamptz, now()))`,
    [
      randomUUID(),
      overrides.source,
      overrides.severity,
      overrides.title,
      randomUUID(),
      randomUUID(),
      overrides.lastSeen ?? null,
    ],
  );
}

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin NOLOGIN; END IF;
  END $$;`);
  await tp.exec(INTEL_SCHEMA_SQL);
  await tp.exec(INTEL_ADMIN_READ_GRANT_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("readIntelFindings (ADR-0286)", () => {
  test("reads every finding, newest last_seen first, with no filter", async () => {
    await seedFinding({
      source: "github",
      severity: "info",
      title: "star gain",
      lastSeen: "2026-01-01T00:00:00Z",
    });
    await seedFinding({
      source: "competitor",
      severity: "warning",
      title: "pricing page changed",
      lastSeen: "2026-02-01T00:00:00Z",
    });

    const rows = await asAdmin((tx) => readIntelFindings(tx));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const titles = rows.map((r) => r.title);
    expect(titles.indexOf("pricing page changed")).toBeLessThan(
      titles.indexOf("star gain"),
    );
  });

  test("filters by severity", async () => {
    await seedFinding({
      source: "error",
      severity: "critical",
      title: "prod 500 spike",
    });
    const rows = await asAdmin((tx) =>
      readIntelFindings(tx, { severity: "critical" }),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.severity === "critical")).toBe(true);
  });

  test("filters by source", async () => {
    const rows = await asAdmin((tx) =>
      readIntelFindings(tx, { source: "github" }),
    );
    expect(rows.every((r) => r.source === "github")).toBe(true);
  });

  test("filters by BOTH severity and source together", async () => {
    const rows = await asAdmin((tx) =>
      readIntelFindings(tx, { severity: "warning", source: "competitor" }),
    );
    expect(
      rows.every((r) => r.severity === "warning" && r.source === "competitor"),
    ).toBe(true);
  });
});

describe("isIntelSeverity / isIntelSource guards", () => {
  test("accept only the closed vocabulary", () => {
    expect(isIntelSeverity("critical")).toBe(true);
    expect(isIntelSeverity("urgent")).toBe(false);
    expect(isIntelSource("github")).toBe(true);
    expect(isIntelSource("twitter")).toBe(false);
  });
});
