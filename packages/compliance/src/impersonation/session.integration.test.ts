// Integration proof for the support-impersonation kernel (ADR-0187; ADR-0005/0052). Runs the REAL
// composed migration set (via the package assembler — the same 0004_impersonation_session.sql a
// generated buyer app applies), the REAL `withTenant`, and the REAL `AuditChainStore` (PGlite + a
// local WORM dir) — no network, no live cloud. Proves the ADR's testable invariants: one
// impersonated write yields TWO chained, `verifyChain`-valid records linked by sessionId in
// deterministic order; an impersonated context still cannot read outside the target tenant
// (scope, never role); expired/ended sessions refuse fail-closed; and the migration's RLS block
// mirrors `buildTenantPolicySql` with the narrowed column-scoped GRANT (drift guard).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { AuthzError, ConflictError } from "@caisson-sh/kernel";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";
import { AuditChainStore, LocalArtifactStore } from "@caisson-sh/audit-worm";
import { assembleComplianceMigrations } from "../migrate/assemble.ts";
import {
  IMPERSONATION_OPERATOR_RECORD,
  IMPERSONATION_TENANT_RECORD,
  beginImpersonation,
  endImpersonation,
  findDualRecordSeqs,
  recordImpersonatedAction,
  withImpersonation,
  type ImpersonationDeps,
} from "./session.ts";

const T0 = new Date("2026-06-27T12:00:00.000Z");
const REASON = "Investigating a buyer-reported evidence-pack failure.";

let tp: TestPg;
let tmpDir: string;
let chain: AuditChainStore;
let migrationSql: string;
/** Mutable injected clock — advanced per-test to prove expiry fail-closed without sleeping. */
let clock: Date;
let deps: ImpersonationDeps;

/** A tenant-scoped demo table the impersonated write probe lands in (RLS-gated like any other). */
const NOTE_TABLE_DDL = `
CREATE TABLE support_note (
  id         text PRIMARY KEY,
  account_id text NOT NULL,
  body       text NOT NULL
);
${buildTenantPolicySql("support_note")}
`;

function begin(target: string, ttlMs = 60_000) {
  return beginImpersonation(deps, {
    operatorId: "support-operator-7",
    operatorEmail: "support@caisson.sh",
    targetAccountId: target,
    reason: REASON,
    ttlMs,
  });
}

beforeAll(async () => {
  // Concatenate BOTH migration files: 0002 DROP+CREATEs the tenant-isolation policy with the
  // pgbouncer/pooler NULLIF hardening (ADR-0006 append-only — 0001 already shipped, so the
  // hardening is a follow-up migration, never an edit to 0001). The drift-guard below checks the
  // EFFECTIVE (post-0002) policy against buildTenantPolicySql's current output.
  migrationSql =
    (await Bun.file(
      new URL("../migrations/0001_impersonation_session.sql", import.meta.url),
    ).text()) +
    (await Bun.file(
      new URL(
        "../migrations/0002_impersonation_session_rls_nullif.sql",
        import.meta.url,
      ),
    ).text());
  tp = await newTestPg();
  // The REAL composed sequence (field-crypto keys → audit-worm chain/versions → impersonation).
  for (const migration of assembleComplianceMigrations().sequence) {
    await tp.exec(migration.sql);
  }
  await tp.exec(NOTE_TABLE_DDL);
  tmpDir = await mkdtemp(join(tmpdir(), "compliance-impersonation-"));
  const store = new LocalArtifactStore(tmpDir);
  clock = T0;
  chain = new AuditChainStore({ db: tp.pg, store, now: () => clock });
  deps = { db: tp.pg, chain, now: () => clock };
}, 120_000); // PGlite WASM init can be slow under parallel CI load — generous hook timeout.

afterAll(async () => {
  if (tp) await tp.close();
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

describe("dual audit trail (ADR-0187 — two chained records per step)", () => {
  test("begin + one impersonated write + action + end yield verifyChain-valid dual pairs in order", async () => {
    clock = T0;
    const target = randomUUID();
    const session = await begin(target);

    await withImpersonation(deps, session, async (tx) => {
      await tx.query(
        `INSERT INTO support_note (id, account_id, body) VALUES ($1, $2, $3)`,
        [randomUUID(), target, "re-ran the failing evidence generation"],
      );
    });
    const actionSeqs = await recordImpersonatedAction(
      deps,
      session,
      "write:support_note",
    );
    await endImpersonation(deps, session);

    // 3 lifecycle steps × 2 records: operator BEFORE tenant in every pair, all linked by sessionId.
    const entries = await chain.load(target);
    expect(entries).toHaveLength(6);
    const kinds = entries.map(
      (e) => (e.payload as { kind: string; sessionId: string }).kind,
    );
    expect(kinds).toEqual([
      IMPERSONATION_OPERATOR_RECORD,
      IMPERSONATION_TENANT_RECORD,
      IMPERSONATION_OPERATOR_RECORD,
      IMPERSONATION_TENANT_RECORD,
      IMPERSONATION_OPERATOR_RECORD,
      IMPERSONATION_TENANT_RECORD,
    ]);
    for (const entry of entries) {
      expect((entry.payload as { sessionId: string }).sessionId).toBe(
        session.id,
      );
    }
    expect(actionSeqs.operatorSeq).toBeLessThan(actionSeqs.tenantSeq);
    // The whole-lifecycle scan: begin pair at 0/1, end pair at 4/5, 3 records per side.
    expect(findDualRecordSeqs(entries, session.id)).toEqual({
      operatorRecordSeq: 0,
      tenantRecordSeq: 1,
      endOperatorRecordSeq: 4,
      endTenantRecordSeq: 5,
      operatorRecordCount: 3,
      tenantRecordCount: 3,
    });

    // The whole trail verifies against the trusted WORM anchor — never a plain log.
    expect(await chain.verify(target)).toEqual({ valid: true, brokenAt: null });

    // The operator side carries who + why + until-when; the tenant side carries whose data.
    const op = entries[0]!.payload as { operatorId: string; reason: string };
    expect(op.operatorId).toBe("support-operator-7");
    expect(op.reason).toBe(REASON);
    const ten = entries[1]!.payload as { targetAccountId: string };
    expect(ten.targetAccountId).toBe(target);
  });

  test("begin persists the session row; end stamps ended_at only (ground truth, RLS bypassed)", async () => {
    clock = T0;
    const target = randomUUID();
    const session = await begin(target);
    const [before] = await tp.query<{
      operator_email: string;
      reason: string;
      ended_at: Date | null;
    }>(
      `SELECT operator_email, reason, ended_at FROM impersonation_session WHERE id = $1`,
      [session.id],
    );
    expect(before?.operator_email).toBe("support@caisson.sh");
    expect(before?.reason).toBe(REASON);
    expect(before?.ended_at).toBeNull();

    await endImpersonation(deps, session);
    const [after] = await tp.query<{ ended_at: Date | null }>(
      `SELECT ended_at FROM impersonation_session WHERE id = $1`,
      [session.id],
    );
    expect(after?.ended_at).not.toBeNull();
  });
});

describe("scope, never role (ADR-0005 — RLS still gates under impersonation)", () => {
  test("an impersonated context for tenant A reads ZERO rows of tenant B's data", async () => {
    clock = T0;
    const a = randomUUID();
    const b = randomUUID();
    // Tenant B's data exists (seeded under B's own scope — ground truth via superuser).
    await tp.asTenant(b, (tx) =>
      tx.query(
        `INSERT INTO support_note (id, account_id, body) VALUES ($1, $2, $3)`,
        [randomUUID(), b, "tenant B private note"],
      ),
    );

    const session = await begin(a);
    const counts = await withImpersonation(deps, session, async (tx) => {
      const all = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM support_note`,
      );
      // Even an EXPLICIT cross-tenant filter sees nothing (RLS, not the WHERE — :156-190 pattern).
      const cross = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM support_note WHERE account_id = $1`,
        [b],
      );
      return { all: all.rows[0]?.n, cross: cross.rows[0]?.n };
    });
    expect(counts.all).toBe(0);
    expect(counts.cross).toBe(0);
  });

  test("the app role cannot rewrite session history (column-scoped GRANT — begin/end only)", async () => {
    clock = T0;
    const target = randomUUID();
    const session = await begin(target);
    await expect(
      tp.asTenant(target, (tx) =>
        tx.query(
          `UPDATE impersonation_session SET reason = 'x' WHERE id = $1`,
          [session.id],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      tp.asTenant(target, (tx) =>
        tx.query(`DELETE FROM impersonation_session WHERE id = $1`, [
          session.id,
        ]),
      ),
    ).rejects.toThrow();
  });
});

describe("fail-closed lifecycle (expired / ended / unknown refuse)", () => {
  test("an expired session refuses withImpersonation and recordImpersonatedAction", async () => {
    clock = T0;
    const target = randomUUID();
    const session = await begin(target, 1_000);
    clock = new Date(T0.getTime() + 2_000); // now > expiresAt

    await expect(
      withImpersonation(deps, session, () => Promise.resolve()),
    ).rejects.toBeInstanceOf(AuthzError);
    await expect(
      recordImpersonatedAction(deps, session, "read:support_note"),
    ).rejects.toBeInstanceOf(AuthzError);
    // Closing the expired-but-unended record is hygiene, not access — allowed.
    await expect(endImpersonation(deps, session)).resolves.toMatchObject({
      id: session.id,
    });
  });

  test("an ended session refuses further actions; a double end conflicts", async () => {
    clock = T0;
    const target = randomUUID();
    const session = await begin(target);
    await endImpersonation(deps, session);

    await expect(
      withImpersonation(deps, session, () => Promise.resolve()),
    ).rejects.toBeInstanceOf(AuthzError);
    await expect(
      recordImpersonatedAction(deps, session, "read:support_note"),
    ).rejects.toBeInstanceOf(AuthzError);
    await expect(endImpersonation(deps, session)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  test("a forged session object for a row that does not exist refuses (DB is the truth)", async () => {
    clock = T0;
    const target = randomUUID();
    const forged = {
      id: randomUUID(),
      targetAccountId: target,
      operatorId: "support-operator-7",
      reason: REASON,
      startedAt: T0,
      expiresAt: new Date(T0.getTime() + 60_000),
    };
    await expect(
      withImpersonation(deps, forged, () => Promise.resolve()),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});

describe("migration shape (begin/end only, by narrowed GRANT — drift guard)", () => {
  test("RLS mirrors buildTenantPolicySql but narrows the grant to UPDATE (ended_at)", () => {
    // Every ENABLE/FORCE/POLICY line from the canonical builder is present verbatim (drift guard)…
    for (const line of buildTenantPolicySql("impersonation_session").split(
      "\n",
    )) {
      if (line.startsWith("GRANT ")) continue; // …except the grant, which we intentionally narrow.
      expect(migrationSql).toContain(line);
    }
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, UPDATE (ended_at) ON impersonation_session TO app;",
    );
    expect(migrationSql).not.toMatch(
      /GRANT[^;]*\bDELETE\b[^;]*ON impersonation_session/i,
    );
    // UPDATE appears ONLY column-scoped to ended_at — never a full-row grant.
    expect(migrationSql).not.toMatch(
      /GRANT[^;]*\bUPDATE\b(?!\s*\(ended_at\))[^;]*ON impersonation_session/i,
    );
  });
});
