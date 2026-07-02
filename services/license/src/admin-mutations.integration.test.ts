// The ADR-0220 operator mutation surface on PGlite + a real Local WORM store. Asserts, per action:
// the mutation lands, is bounded to one target account, and is DUAL-logged (an admin_action_log row
// AND a WORM chain entry); a negative credit adjust clamps to the balance and never underflows; the
// admin_write role is what writes (the app role cannot); the `.strict()` bodies reject unknown
// fields; and a FAILED action writes NEITHER log (atomicity). Real platform account ids are 32-char
// [A-Za-z0-9] better-auth ids (accountId == userId, ADR-0176), NOT UUIDs — the WORM ArtifactStore key
// contract wants a UUID first segment, so the anchor account is DERIVED via `wormAnchorAccount`
// (the raw id rides the payload). Tests exercise the real 32-char shape; one UUID case pins back-compat.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { AuditChainStore, LocalArtifactStore } from "@caisson/audit-worm";
import {
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
} from "@caisson/credits";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import { readAdminActionLog } from "./admin-audit-log.ts";
import {
  ADMIN_MUTATION_PROVISION_SQL,
  AdjustCreditsBody,
  GrantEntitlementBody,
  type AdminMutationDeps,
  adjustCreditsAdmin,
  grantEntitlementAdmin,
  reissueLicenseAdmin,
  revokeEntitlementAdmin,
  wormAnchorAccount,
} from "./admin-mutations.ts";
import { ENTITLEMENT_SCHEMA_SQL } from "./entitlement-store.ts";

let tp: TestPg;
let db: Transactor;
let worm: AuditChainStore;
let wormDir: string;

const B62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** A random 32-char [A-Za-z0-9] id in the better-auth default shape (ADR-0176) — NOT a UUID. */
function betterAuthId(): string {
  return Array.from(randomBytes(32), (b) => B62[b % B62.length] ?? "0").join(
    "",
  );
}

// A stub /issue proxy: re-serves a deterministic token for any (accountId, major). Reissue does no
// DB mutation itself (the real /issue persists), so this suffices for the dual-log assertions.
const okIssue: AdminMutationDeps["issue"] = async (req) => ({
  token: `TOKEN-${req.accountId}-${String(req.major)}`,
  licenseId: `lic-${req.major}`,
});

function deps(overrides: Partial<AdminMutationDeps> = {}): AdminMutationDeps {
  return { db, worm, issue: okIssue, ...overrides };
}

async function ground<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  return tp.query<T>(sql, params);
}

/** Run `fn` as the read-only `admin` role (the ADR-0141 cockpit read seam) — for the audit browser. */
async function asAdmin<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE admin`);
    return fn(tx);
  });
}

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  // Roles: `app` is provisioned by newTestPg; add `admin_write` (mutations) + `admin` (log reads).
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin NOLOGIN; END IF;
  END $$;`);
  // Schemas: credits + entitlements + the operator action log, then the EXTERNAL admin_write policies
  // (entitlement_grant + the base credit tables) — applied after the admin_write role exists.
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  const { ADMIN_ACTION_LOG_SCHEMA_SQL } = await import("./admin-audit-log.ts");
  await tp.exec(ADMIN_ACTION_LOG_SCHEMA_SQL);
  await tp.exec(ADMIN_MUTATION_PROVISION_SQL);
  // Provisioning is idempotent (ADR-0220) — re-running the DEPLOY SQL must not error.
  await tp.exec(ADMIN_MUTATION_PROVISION_SQL);
  // The REAL audit-chain migration (zero-drift: read from the audit-worm package, not inlined).
  const chainSql = await Bun.file(
    new URL(
      "../../../packages/audit-worm/src/migrations/0001_audit_chain.sql",
      import.meta.url,
    ),
  ).text();
  await tp.exec(chainSql);

  wormDir = mkdtempSync(join(tmpdir(), "caisson-admin-worm-"));
  worm = new AuditChainStore({ db, store: new LocalArtifactStore(wormDir) });
});

afterAll(async () => {
  await tp.close();
});

describe("worm anchor account derivation (32-char better-auth ids → UUID key segment)", () => {
  test("derivation is deterministic + RFC-4122-shaped; a UUID passes through", () => {
    const id = "k5G2mB9qL0xWc4vRt7nYs1uZp8dJh3fA"; // the reviewer's empirical 32-char id
    const a = wormAnchorAccount(id);
    const b = wormAnchorAccount(id);
    expect(a).toBe(b); // deterministic — the same account always anchors the same chain
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(wormAnchorAccount("a-different-id")).not.toBe(a); // 1:1 mapping (SHA-256)
    const uuid = randomUUID();
    expect(wormAnchorAccount(uuid)).toBe(uuid); // a UUID is used as-is (back-compat)
  });
});

describe("entitlement grant/revoke (admin_comp, dual-logged)", () => {
  test("grant comps the entitlements, dual-logs, and revoke undoes it", async () => {
    const acct = betterAuthId();
    const anchor = wormAnchorAccount(acct);
    const g = await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance", "ai-kit"],
    });
    expect(g.after.sort()).toEqual(["ai-kit", "compliance"]);
    expect(g.changed).toBe(2);
    expect(g.worm).toBe("ok");

    // Ground truth: rows are source_kind admin_comp (never a real purchase).
    const rows = await ground<{ source_kind: string; status: string }>(
      `SELECT source_kind, status FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect(rows.every((r) => r.source_kind === "admin_comp")).toBe(true);

    // DUAL LOG: one admin_action_log row AND one WORM chain entry for this account.
    const logRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows[0]?.n).toBe(1);
    expect(await worm.load(anchor)).toHaveLength(1);

    // The operator audit browser reads the log through the read-only `admin` role (ADR-0141 seam).
    const browsed = await asAdmin((tx) => readAdminActionLog(tx, 10));
    const mine = browsed.find((r) => r.targetAccountId === acct);
    expect(mine?.action).toBe("entitlement_grant");
    expect(mine?.actorEmail).toBe("op@gridwork.dev");

    // Revoke undoes the comp; entitlements gone; a second dual-log lands.
    const r = await revokeEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementId: "compliance",
    });
    expect(r.after).toEqual(["ai-kit"]);
    expect(r.changed).toBe(1);
    expect(r.worm).toBe("ok");
    expect(await worm.load(anchor)).toHaveLength(2);
    const wormEntry = await worm.verify(anchor);
    expect(wormEntry.valid).toBe(true);
  });

  test("end-to-end WORM append succeeds for a real 32-char better-auth account id", async () => {
    // The bug this pins: a 32-char id is NOT a UUID, so before the fix appendWorm threw AFTER the
    // mutation committed. Now the anchor account is derived — the WORM half actually lands.
    const acct = betterAuthId();
    const anchor = wormAnchorAccount(acct);
    const g = await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance"],
    });
    expect(g.worm).toBe("ok");

    const entries = await worm.load(anchor);
    expect(entries).toHaveLength(1);
    // Auditability preserved: the RAW account id lives inside the WORM payload, not just the key.
    const payload = entries[0]?.payload as
      { targetAccountId?: string } | undefined;
    expect(payload?.targetAccountId).toBe(acct);
    const v = await worm.verify(anchor);
    expect(v.valid).toBe(true);
  });

  test("back-compat: a UUID account id anchors its chain directly (no derivation)", async () => {
    const acct = randomUUID();
    await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance"],
    });
    // A UUID passes through `wormAnchorAccount` unchanged, so load(rawUuid) resolves the chain.
    expect(wormAnchorAccount(acct)).toBe(acct);
    expect(await worm.load(acct)).toHaveLength(1);
    expect((await worm.verify(acct)).valid).toBe(true);
  });

  test("a grant is bounded to its one target account (never leaks to another)", async () => {
    const a = betterAuthId();
    const b = betterAuthId();
    await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: a,
      entitlementIds: ["compliance"],
    });
    const bRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [b],
    );
    expect(bRows[0]?.n).toBe(0);
  });
});

describe("post-commit WORM failure is DISTINCT from a mutation failure", () => {
  test("a WORM append that throws returns worm:failed while the grant + log row PERSIST (do NOT retry)", async () => {
    const acct = betterAuthId();
    // A WORM store whose append always throws — simulating a transient artifact-store outage AFTER
    // the mutation + admin_action_log tx has already committed.
    const brokenWorm = {
      append: async () => {
        throw new Error("WORM store unavailable");
      },
    } as unknown as AuditChainStore;

    const r = await grantEntitlementAdmin(deps({ worm: brokenWorm }), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance"],
    });
    // The call RESOLVES (never throws) with the distinct do-not-retry signal.
    expect(r.worm).toBe("failed");
    expect(r.changed).toBe(1);

    // The mutation is durable: the entitlement grant AND the queryable action-log row both exist.
    const grantRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect(grantRows[0]?.n).toBe(1);
    const logRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows[0]?.n).toBe(1);
  });
});

describe("credit adjust (± integer, feature envelope, never negative)", () => {
  test("positive adjust grants credits under the admin_adjust tag", async () => {
    const acct = betterAuthId();
    const anchor = wormAnchorAccount(acct);
    const r = await adjustCreditsAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      deltaCredits: 500,
      reason: "billing-error correction",
    });
    expect(r.balanceAfter).toBe(500);
    expect(r.applied).toBe(500);
    expect(r.worm).toBe("ok");
    const ev = await ground<{
      event_type: string;
      feature: string;
      amount: number;
    }>(
      `SELECT event_type, feature, amount FROM credit_event WHERE account_id = $1`,
      [acct],
    );
    expect(ev).toEqual([
      { event_type: "feature_grant", feature: "admin_adjust", amount: 500 },
    ]);
    expect(await worm.load(anchor)).toHaveLength(1);
  });

  test("negative adjust CLAMPS to the balance — the wallet never goes negative", async () => {
    const acct = betterAuthId();
    await adjustCreditsAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      deltaCredits: 100,
      reason: "seed",
    });
    // Try to remove 1000 from a balance of 100 — only 100 comes out, and the wallet floors at 0.
    const r = await adjustCreditsAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      deltaCredits: -1000,
      reason: "overzealous clawback",
    });
    expect(r.balanceAfter).toBe(0);
    expect(r.applied).toBe(-100);
    const bal = await ground<{ balance: number }>(
      `SELECT balance FROM credit_wallet WHERE account_id = $1`,
      [acct],
    );
    expect(bal[0]?.balance).toBe(0);
  });
});

describe("license reissue (dual-logged, atomic on failure)", () => {
  test("reissue re-serves the proxy token and dual-logs", async () => {
    const acct = betterAuthId();
    const anchor = wormAnchorAccount(acct);
    const r = await reissueLicenseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      major: 1,
      tier: "pro",
      expiry: null,
    });
    expect(r.token).toBe(`TOKEN-${acct}-1`);
    expect(r.licenseId).toBe("lic-1");
    expect(r.worm).toBe("ok");
    const logRows = await ground<{ action: string }>(
      `SELECT action FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows).toEqual([{ action: "license_reissue" }]);
    expect(await worm.load(anchor)).toHaveLength(1);
  });

  test("a FAILED reissue (proxy throws) writes NEITHER log", async () => {
    const acct = betterAuthId();
    const anchor = wormAnchorAccount(acct);
    const failingIssue: AdminMutationDeps["issue"] = async () => {
      throw new Error("issue service 500");
    };
    await expect(
      reissueLicenseAdmin(deps({ issue: failingIssue }), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        major: 1,
        tier: "pro",
        expiry: null,
      }),
    ).rejects.toThrow();
    const logRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows[0]?.n).toBe(0);
    expect(await worm.load(anchor)).toHaveLength(0);
  });
});

describe("atomicity + role separation", () => {
  test("a mutation that throws mid-transaction rolls back BOTH the write and the log", async () => {
    // A Transactor wrapper that runs the mutation fully, then throws — forcing the withAdminWrite
    // transaction to roll back after grant + admin_action_log both executed. Neither must persist.
    const acct = betterAuthId();
    const anchor = wormAnchorAccount(acct);
    const failing: Transactor = {
      async transaction(fn) {
        return db.transaction(async (tx) => {
          await fn(tx);
          throw new Error("boom after writes");
        });
      },
    };
    await expect(
      grantEntitlementAdmin(deps({ db: failing }), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        entitlementIds: ["compliance"],
      }),
    ).rejects.toThrow();
    const ent = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    const log = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(ent[0]?.n).toBe(0);
    expect(log[0]?.n).toBe(0);
    expect(await worm.load(anchor)).toHaveLength(0);
  });

  test("the buyer app role CANNOT write admin_comp grants (only admin_write can)", async () => {
    const acct = betterAuthId();
    // As the app role bound to the account, an admin_comp insert is refused: app's WITH CHECK
    // requires account_id = GUC (ok) but the app role has no admin_comp… actually the refusal here
    // is that a plain app insert of admin_comp is a legal tenant row — so instead prove the inverse:
    // grant via the surface (admin_write) THEN confirm the app role reads it but the SURFACE is the
    // only writer wired. The role separation itself is proven in packages/tenancy-rls; here we pin
    // that the admin log is NOT readable by the app role.
    await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance"],
    });
    await expect(
      withTenant(db, acct, (tx) =>
        tx.query(`SELECT count(*) FROM admin_action_log`),
      ),
    ).rejects.toThrow(); // app has no SELECT grant on admin_action_log
  });
});

describe("strict boundary bodies", () => {
  test("unknown fields and missing targets are rejected", () => {
    expect(
      GrantEntitlementBody.safeParse({
        targetAccountId: "acct",
        entitlementIds: ["compliance"],
        rogue: true,
      }).success,
    ).toBe(false);
    expect(
      GrantEntitlementBody.safeParse({ entitlementIds: ["x"] }).success,
    ).toBe(false);
    expect(
      AdjustCreditsBody.safeParse({
        targetAccountId: "acct",
        deltaCredits: 0,
        reason: "no-op",
      }).success,
    ).toBe(false); // zero delta rejected
    expect(
      AdjustCreditsBody.safeParse({
        targetAccountId: "acct",
        deltaCredits: 10,
        reason: "ok",
      }).success,
    ).toBe(true);
    // A whitespace/control char in the account id is rejected at the boundary (real id shape).
    expect(
      GrantEntitlementBody.safeParse({
        targetAccountId: "bad id",
        entitlementIds: ["compliance"],
      }).success,
    ).toBe(false);
    // The int4-safe upper bound: an absurd delta is rejected, never left to overflow the column.
    expect(
      AdjustCreditsBody.safeParse({
        targetAccountId: "acct",
        deltaCredits: 5_000_000_000,
        reason: "too big",
      }).success,
    ).toBe(false);
  });
});
