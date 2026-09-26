// Integration proof for the append-only locked-version table + DERIVED current (ADR-0053/0014).
// Runs the REAL `withTenant` + the REAL `0002_versions.sql` migration against PGlite (a true
// Postgres with FORCE RLS, SET ROLE, jsonb, plpgsql triggers, composite FKs). No network, no live
// cloud. Mutation is attempted both as the `app` role (denied by withheld GRANT) and as the
// BYPASSRLS superuser (denied by the belt trigger) — exactly the adversaries an immutable, locked
// version table must remain append-only against.
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
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@caisson-sh/kernel";
import { buildTenantPolicySql } from "@caisson-sh/tenancy-rls";
import { LockedVersionStore, type Provenance } from "./version-store.ts";

let tp: TestPg;
let migrationSql: string;
let store: LockedVersionStore;

function prov(reason: string): Provenance {
  return { artifactHash: "a".repeat(64), lockedBy: "subject-1", reason };
}

beforeAll(async () => {
  const m2 = await Bun.file(
    new URL("./migrations/0002_versions.sql", import.meta.url),
  ).text();
  // 0003 DROP+CREATEs the tenant-isolation policy with the pgbouncer/pooler NULLIF hardening
  // (ADR-0006 append-only — 0001/0002 already shipped, so the hardening is a follow-up migration,
  // never an edit to either); it also touches audit_chain_entry, which this standalone table's
  // schema doesn't have, so it's concatenated for the drift-guard TEXT check below only, never
  // exec'd here — the composed compliance-edition test (assemble.integration.test.ts) proves it
  // applies live.
  const m3 = await Bun.file(
    new URL("./migrations/0003_rls_nullif.sql", import.meta.url),
  ).text();
  migrationSql = m2 + m3;
  tp = await newTestPg();
  await tp.exec(m2);
  store = new LockedVersionStore({ db: tp.pg });
}, 120_000); // PGlite WASM init can be slow under parallel CI load — generous hook timeout.

afterAll(async () => {
  if (tp) await tp.close();
});

describe("LockedVersionStore — insert + supersede + derived current", () => {
  test("a root version is current; isCurrent + chain track it", async () => {
    const acct = randomUUID();
    const artifact = randomUUID();
    const v0 = await store.insertVersion(acct, {
      artifactId: artifact,
      provenance: prov("initial lock"),
    });
    expect(v0.supersedesId).toBeNull();
    expect(v0.provenance.reason).toBe("initial lock");

    expect((await store.currentVersion(acct, artifact))?.id).toBe(v0.id);
    expect(await store.isCurrent(acct, v0.id)).toBe(true);
    expect((await store.chainFor(acct, artifact)).map((v) => v.id)).toEqual([
      v0.id,
    ]);
  });

  test("a supersede advances current; the derived current never drifts", async () => {
    const acct = randomUUID();
    const artifact = randomUUID();
    const v0 = await store.insertVersion(acct, {
      artifactId: artifact,
      provenance: prov("v0"),
    });
    const v1 = await store.insertVersion(acct, {
      artifactId: artifact,
      supersedesId: v0.id,
      provenance: prov("v1 supersedes v0"),
    });

    expect((await store.currentVersion(acct, artifact))?.id).toBe(v1.id);
    expect(await store.isCurrent(acct, v0.id)).toBe(false);
    expect(await store.isCurrent(acct, v1.id)).toBe(true);
    // Chain is root → tip; current set (across all artifacts) is exactly the tip.
    expect((await store.chainFor(acct, artifact)).map((v) => v.id)).toEqual([
      v0.id,
      v1.id,
    ]);
    expect((await store.currentVersions(acct)).map((v) => v.id)).toEqual([
      v1.id,
    ]);
  });

  test("currentVersion is null for an artifact with no versions", async () => {
    expect(await store.currentVersion(randomUUID(), randomUUID())).toBeNull();
  });

  test("multiple lineages per tenant each derive their own current tip", async () => {
    const acct = randomUUID();
    const artA = randomUUID();
    const artB = randomUUID();
    const a0 = await store.insertVersion(acct, {
      artifactId: artA,
      provenance: prov("A0"),
    });
    const a1 = await store.insertVersion(acct, {
      artifactId: artA,
      supersedesId: a0.id,
      provenance: prov("A1"),
    });
    const b0 = await store.insertVersion(acct, {
      artifactId: artB,
      provenance: prov("B0"),
    });

    const currentIds = (await store.currentVersions(acct))
      .map((v) => v.id)
      .sort();
    expect(currentIds).toEqual([a1.id, b0.id].sort());
  });
});

describe("provenance boundary (Zod .strictObject, pre-INSERT)", () => {
  test("an unknown provenance field is rejected and nothing is written", async () => {
    const acct = randomUUID();
    const artifact = randomUUID();
    await expect(
      store.insertVersion(acct, {
        artifactId: artifact,
        provenance: { ...prov("x"), rogue: "drop tables" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // The parse happens before any INSERT — the table stays empty for this tenant.
    expect(await store.loadAll(acct)).toEqual([]);
  });

  test("a missing required provenance field is rejected", async () => {
    await expect(
      store.insertVersion(randomUUID(), {
        artifactId: randomUUID(),
        provenance: { artifactHash: "a".repeat(64), lockedBy: "s" },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("no-fork + in-tenant supersede (TM-D)", () => {
  test("superseding an already-superseded version forks → ConflictError, rolled back", async () => {
    const acct = randomUUID();
    const artifact = randomUUID();
    const v0 = await store.insertVersion(acct, {
      artifactId: artifact,
      provenance: prov("v0"),
    });
    await store.insertVersion(acct, {
      artifactId: artifact,
      supersedesId: v0.id,
      provenance: prov("v1"),
    });
    await expect(
      store.insertVersion(acct, {
        artifactId: artifact,
        supersedesId: v0.id, // v0 is already superseded → fork
        provenance: prov("v1-fork"),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    // The fork rolled back — the tenant still has exactly the two real versions.
    expect((await store.loadAll(acct)).length).toBe(2);
  });

  test("superseding an unknown id → NotFoundError", async () => {
    await expect(
      store.insertVersion(randomUUID(), {
        artifactId: randomUUID(),
        supersedesId: randomUUID(),
        provenance: prov("orphan"),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test("superseding a version from a different artifact lineage → ValidationError", async () => {
    const acct = randomUUID();
    const a0 = await store.insertVersion(acct, {
      artifactId: randomUUID(),
      provenance: prov("A0"),
    });
    await expect(
      store.insertVersion(acct, {
        artifactId: randomUUID(), // a DIFFERENT artifact
        supersedesId: a0.id,
        provenance: prov("merge attempt"),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("immutability (TM-D, append-only)", () => {
  test("the app role may append but is DENIED UPDATE and DELETE (withheld GRANT)", async () => {
    const acct = randomUUID();
    const v0 = await store.insertVersion(acct, {
      artifactId: randomUUID(),
      provenance: prov("v0"),
    });
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(`UPDATE locked_version SET artifact_id = 'x' WHERE id = $1`, [
          v0.id,
        ]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(`DELETE FROM locked_version WHERE id = $1`, [v0.id]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  test("even the superuser cannot UPDATE or DELETE — the belt trigger RAISEs", async () => {
    const acct = randomUUID();
    const v0 = await store.insertVersion(acct, {
      artifactId: randomUUID(),
      provenance: prov("v0"),
    });
    await expect(
      tp.query(`UPDATE locked_version SET artifact_id = 'x' WHERE id = $1`, [
        v0.id,
      ]),
    ).rejects.toThrow(/append-only/i);
    await expect(
      tp.query(`DELETE FROM locked_version WHERE id = $1`, [v0.id]),
    ).rejects.toThrow(/append-only/i);
  });
});

describe("tenant isolation (ADR-0005, fail-closed)", () => {
  test("one tenant's versions never bleed into another, and cross-tenant supersede fails closed", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const av = await store.insertVersion(a, {
      artifactId: randomUUID(),
      provenance: prov("A"),
    });
    await store.insertVersion(b, {
      artifactId: randomUUID(),
      provenance: prov("B"),
    });

    expect((await store.loadAll(a)).length).toBe(1);
    expect((await store.loadAll(b)).length).toBe(1);

    // Tenant B trying to supersede tenant A's version sees nothing under RLS → NotFoundError.
    await expect(
      store.insertVersion(b, {
        artifactId: randomUUID(),
        supersedesId: av.id,
        provenance: prov("cross-tenant"),
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("migration shape (append-only by withheld GRANT + belt trigger)", () => {
  test("RLS mirrors buildTenantPolicySql but withholds + REVOKEs the UPDATE/DELETE grant", () => {
    // Every ENABLE/FORCE/POLICY line from the canonical builder is present verbatim (drift guard)…
    for (const line of buildTenantPolicySql("locked_version").split("\n")) {
      if (line.startsWith("GRANT ")) continue; // …except the grant, which we narrow.
      expect(migrationSql).toContain(line);
    }
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT ON locked_version TO app;",
    );
    expect(migrationSql).toContain(
      "REVOKE UPDATE, DELETE ON locked_version FROM app;",
    );
    expect(migrationSql).not.toMatch(
      /GRANT[^;]*\b(?:UPDATE|DELETE)\b[^;]*ON locked_version/i,
    );
  });

  test("the belt trigger is wired for both UPDATE and DELETE", () => {
    expect(migrationSql).toMatch(/BEFORE UPDATE ON locked_version/i);
    expect(migrationSql).toMatch(/BEFORE DELETE ON locked_version/i);
  });
});
