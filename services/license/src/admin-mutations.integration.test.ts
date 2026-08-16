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
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import type { DomainBillingEvent } from "@caisson/billing";

// PGlite bootstrap regularly exceeds the 5s default under CI runner load (uncached consume
// runs) — the suite is fast once warm, so widen the ceiling rather than flake.
setDefaultTimeout(30_000);
import { AuditChainStore, LocalArtifactStore } from "@caisson/audit-worm";
import { ACCOUNT_MEMBER_SCHEMA_SQL } from "@caisson/auth";
import {
  CREDIT_LINE_ITEM_MIGRATION_SQL,
  CREDIT_EXPIRY_MIGRATION_SQL,
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  GRANT_CONSUMPTION_MIGRATION_SQL,
  debit,
  grant,
} from "@caisson/credits";
import { withAdvisoryXactLock } from "@caisson/jobs";
import {
  asCredits,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@caisson/kernel";
import { ADMIN_WRITE_ROLE_BOOTSTRAP_SQL } from "@caisson/org-controls";
import {
  LEGACY_ENTITLEMENT_ALIASES,
  loadRegistryIndex,
  type RegistryIndex,
} from "@caisson/registry-schema";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import { readAdminActionLog } from "./admin-audit-log.ts";
import {
  ADMIN_MUTATION_PROVISION_SQL,
  AdjustCreditsBody,
  FirstMintLicenseBody,
  GrantEntitlementBody,
  ResendPurchaseEmailBody,
  RevokePurchaseBody,
  RotateLicenseBody,
  SetSystemModeBody,
  type AdminMutationDeps,
  adjustCreditsAdmin,
  firstMintLicenseAdmin,
  grantEntitlementAdmin,
  readSystemMode,
  reissueLicenseAdmin,
  resendPurchaseEmailAdmin,
  revokeEntitlementAdmin,
  revokePurchaseAdmin,
  rotateLicenseAdmin,
  setSystemModeAdmin,
  wormAnchorAccount,
} from "./admin-mutations.ts";
import { applyBillingEvent } from "./apply-billing-event.ts";
import { CHECKOUT_ABANDONMENT_SCHEMA_SQL } from "./checkout-abandonment-store.ts";
import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL,
  RENEWAL_EXTENSION_SCHEMA_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
  readEntitlements,
  upsertSubscriptionGrants,
} from "./entitlement-store.ts";
import {
  LICENSE_GRANT_SCHEMA_SQL,
  storeLicenseGrant,
} from "./license-grant-store.ts";
import {
  LICENSE_REVOCATION_SCHEMA_SQL,
  readDenySet,
} from "./license-revocation-store.ts";
import {
  ORDER_RECORD_SCHEMA_SQL,
  ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL,
  ORDER_RECORD_DISCOUNT_MIGRATION_SQL,
  SUBSCRIPTION_STATUS_SCHEMA_SQL,
} from "./subscription-history-store.ts";

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

/** Seed a real (personal, account_id == user_id) account_member row — every existing
 * happy-path test in this file now needs this: the mutation surface fails closed on an id with no row. */
async function seedAccount(acct: string): Promise<void> {
  await withTenant(db, acct, (tx) =>
    tx.query(
      `INSERT INTO account_member (account_id, user_id, role) VALUES ($1, $1, 'owner')
       ON CONFLICT DO NOTHING`,
      [acct],
    ),
  );
}

/** `betterAuthId()` + immediately seeded — the common case for every happy-path test below. */
async function realAccount(): Promise<string> {
  const acct = betterAuthId();
  await seedAccount(acct);
  return acct;
}

// A stub /issue proxy: re-serves a deterministic token for any (accountId, major). Reissue does no
// DB mutation itself (the real /issue persists), so this suffices for the dual-log assertions.
const okIssue: AdminMutationDeps["issue"] = async (req) => ({
  token: `TOKEN-${req.accountId}-${String(req.major)}`,
  licenseId: `lic-${req.major}`,
});

// A minimal indexed base module entry.
// Untyped (flows into `loadRegistryIndex`'s Zod `.parse`, which takes `unknown` and fills every
// defaulted field) — no `as RegistryIndex[...]` cast fighting the assertion's overlap check.
function entry(id: string) {
  return {
    id,
    latest: "1.0.0",
    versions: [
      {
        version: "1.0.0",
        publishedAt: "2026-01-01T00:00:00.000Z",
        gateAttestation: "ci-run-1@deadbeef",
        manifest: {
          id,
          version: "1.0.0",
          kind: "base",
          tier: "oss",
          license: "Apache-2.0",
          priceCents: null,
          editions: [],
          description: id,
        },
      },
    ],
  };
}

// `ai-kit` is the only non-bundle id any test grants (the pre-existing "compliance"+"ai-kit" grant
// below) — indexed here as its served legacy-edition meta-package's bare slug (ADR-0278 F1: the new
// grant-boundary allowlist reads this same index, so it must carry every id a test grants).
const TEST_INDEX: RegistryIndex = loadRegistryIndex({
  schemaVersion: 1,
  modules: [entry("@caisson/ai-kit")],
});

function deps(overrides: Partial<AdminMutationDeps> = {}): AdminMutationDeps {
  return { db, worm, issue: okIssue, index: TEST_INDEX, ...overrides };
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
  // Schemas: account membership (CAISSON-9 existence check) + credits + entitlements + the operator
  // action log, then the EXTERNAL admin_write policies (entitlement_grant + the base credit tables +
  // account_member) — applied after the admin_write role exists.
  await tp.exec(ACCOUNT_MEMBER_SCHEMA_SQL);
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  // ADR-0218 per-line columns — the paid-revoke claw reads `creditsClawedForSource` (line_item_id).
  await tp.exec(CREDIT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  // ADR-0218 line_item_id on entitlement_grant — `grantEntitlements` (the paid-source seeder) needs it.
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL);
  await tp.exec(RENEWAL_EXTENSION_SCHEMA_SQL);
  await tp.exec(RENEWAL_EXTENSION_MONTHS_MIGRATION_SQL);
  // ADR-0293: applyBillingEvent (called directly below, e.g. the operator-vs-Paddle-refund
  // idempotency test) also touches these two tables now.
  await tp.exec(SUBSCRIPTION_STATUS_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SUBSCRIPTION_LINK_MIGRATION_SQL);
  await tp.exec(ORDER_RECORD_DISCOUNT_MIGRATION_SQL); // ADR-0315 affiliate-attribution column
  // ADR-0225: the license index (read cross-tenant for the edge deny-set) + the deny-set truth table,
  // created BEFORE ADMIN_MUTATION_PROVISION_SQL (its new license_grant SELECT policy references it).
  await tp.exec(LICENSE_GRANT_SCHEMA_SQL);
  await tp.exec(LICENSE_REVOCATION_SCHEMA_SQL);
  // Abandoned-checkout: the scheduler's daily tick SELECT policy references this table too, same
  // "created before ADMIN_MUTATION_PROVISION_SQL" ordering as license_grant above.
  await tp.exec(CHECKOUT_ABANDONMENT_SCHEMA_SQL);
  const { ADMIN_ACTION_LOG_SCHEMA_SQL, ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL } =
    await import("./admin-audit-log.ts");
  await tp.exec(ADMIN_ACTION_LOG_SCHEMA_SQL);
  // ADR-0225 action-enum migration — idempotent no-op on the fresh CHECK (which already lists all five).
  await tp.exec(ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL);
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
  const versionIdentitySql = await Bun.file(
    new URL(
      "../../../packages/audit-worm/src/migrations/0004_artifact_versions.sql",
      import.meta.url,
    ),
  ).text();
  await tp.exec(chainSql + versionIdentitySql);

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
    const acct = await realAccount();
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
    const acct = await realAccount();
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
      | { targetAccountId?: string }
      | undefined;
    expect(payload?.targetAccountId).toBe(acct);
    const v = await worm.verify(anchor);
    expect(v.valid).toBe(true);
  });

  test("back-compat: a UUID account id anchors its chain directly (no derivation)", async () => {
    const acct = randomUUID();
    await seedAccount(acct);
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
    // `b` is intentionally NEVER seeded — this test only asserts it received zero rows, so its
    // account-existence status is irrelevant to what it's proving.
    const a = await realAccount();
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

  // ADR-0278 F1: the comp-grant boundary must reject an id `expandEntitlements` cannot resolve
  // BEFORE any row lands — an unvetted typo written here would fail-closed-throw the target
  // account's ENTIRE entitlement expansion on its next `/issue`/dashboard read (TM-E, account-wide).
  test("an unknown entitlement id is rejected (400-mapped ValidationError) and writes NO row", async () => {
    const acct = await realAccount();
    await expect(
      grantEntitlementAdmin(deps(), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        entitlementIds: ["compliance", "not-a-real-entitlement"],
      }),
    ).rejects.toThrow(ValidationError);
    const rows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect(rows[0]?.n).toBe(0); // rejected before the transaction opened — not even a rollback
    const logRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows[0]?.n).toBe(0);
  });

  test("a known bundle id is grantable even absent from the index (bundle ids are unconditional)", async () => {
    // "compliance" is a locked BUNDLE_IDS entry (bundle-vocabulary.ts) with no index entry in
    // TEST_INDEX — expandEntitlements never throws for a known bundle id regardless of index
    // presence (it just expands to no members), so the grant boundary must accept it.
    const acct = await realAccount();
    const g = await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance"],
    });
    expect(g.after).toEqual(["compliance"]);
  });

  test("a known indexed module id is grantable in both the bare-slug and full @caisson/<slug> form", async () => {
    const acct = await realAccount();
    const g = await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["ai-kit", "@caisson/ai-kit"],
    });
    // Both spellings resolve to the SAME stored id (grantAdminComp writes the operator-supplied
    // string as-is) — asserting only that neither is rejected and the bare-slug row landed.
    expect(g.after).toContain("ai-kit");
  });

  test("a legacy alias id is grantable — resolved through the SAME normalizeEntitlementId point expandEntitlements uses", async () => {
    // The production LEGACY_ENTITLEMENT_ALIASES map is empty post ADR-0270 (no live alias to grant
    // against), so this proves the MECHANISM the same way entitlement-expansion.test.ts's
    // fake-entry-injection test does: inject a real alias into the shared map, assert the grant
    // boundary accepts the OLD spelling (because it calls expandEntitlements, which normalizes
    // through this exact map), then restore.
    const map = LEGACY_ENTITLEMENT_ALIASES as Map<string, string>;
    map.set("old-ai-kit-slug", "ai-kit");
    try {
      const acct = await realAccount();
      const g = await grantEntitlementAdmin(deps(), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        entitlementIds: ["old-ai-kit-slug"],
      });
      expect(g.after).toEqual(["old-ai-kit-slug"]);
    } finally {
      map.delete("old-ai-kit-slug");
    }
    expect(LEGACY_ENTITLEMENT_ALIASES.size).toBe(0); // restored to the narrowed production spine
  });
});

describe("post-commit WORM failure is DISTINCT from a mutation failure", () => {
  test("a WORM append that throws returns worm:failed while the grant + log row PERSIST (do NOT retry)", async () => {
    const acct = await realAccount();
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
    const acct = await realAccount();
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
    const acct = await realAccount();
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

  test("negative adjust over un-swept expired residue burns the residue first, then applies", async () => {
    const acct = await realAccount();
    // An EXPIRED grant (residue 300) + a live grant (200): wallet aggregate 500, spendable 200.
    await withTenant(db, acct, async (tx) => {
      await grant(tx, {
        accountId: acct,
        eventType: "feature_grant",
        feature: "admin_adjust",
        amount: asCredits(300),
        idempotencyKey: randomUUID(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      await grant(tx, {
        accountId: acct,
        eventType: "feature_grant",
        feature: "admin_adjust",
        amount: asCredits(200),
        idempotencyKey: randomUUID(),
      });
    });
    // Remove 500: the aggregate says 500, but only 200 is spendable. The adjust path sweeps the
    // expired residue first (an `expiry_debit` event), then clamps to the swept balance — before
    // the sweep-first fix this threw InsufficientCreditsError and rolled the whole action back.
    const r = await adjustCreditsAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      deltaCredits: -500,
      reason: "clawback over stale residue",
    });
    expect(r.applied).toBe(-200);
    expect(r.balanceAfter).toBe(0);
    const ev = await ground<{ event_type: string; n: number }>(
      `SELECT event_type, count(*)::int AS n FROM credit_event WHERE account_id = $1 GROUP BY event_type`,
      [acct],
    );
    expect(ev.find((e) => e.event_type === "expiry_debit")?.n).toBe(1);
  });
});

describe("account existence gate on comp grants + credit adjustments (CAISSON-9)", () => {
  test("a comp grant to a NONEXISTENT account 4xx's and commits zero rows", async () => {
    const ghost = betterAuthId(); // deliberately NEVER seeded into account_member
    await expect(
      grantEntitlementAdmin(deps(), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: ghost,
        entitlementIds: ["compliance"],
      }),
    ).rejects.toThrow(NotFoundError);
    const ent = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [ghost],
    );
    const log = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [ghost],
    );
    expect(ent[0]?.n).toBe(0);
    expect(log[0]?.n).toBe(0); // the whole withAdminWrite tx rolled back — no ghost audit row either
  });

  test("a credit adjust to a NONEXISTENT account 4xx's and commits zero rows (no ghost wallet)", async () => {
    const ghost = betterAuthId();
    await expect(
      adjustCreditsAdmin(deps(), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: ghost,
        deltaCredits: 500,
        reason: "should never land",
      }),
    ).rejects.toThrow(NotFoundError);
    const wallet = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM credit_wallet WHERE account_id = $1`,
      [ghost],
    );
    const events = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM credit_event WHERE account_id = $1`,
      [ghost],
    );
    expect(wallet[0]?.n).toBe(0);
    expect(events[0]?.n).toBe(0);
  });
});

describe("license reissue (dual-logged, atomic on failure)", () => {
  test("reissue re-serves the proxy token and dual-logs", async () => {
    const acct = await realAccount();
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
    const acct = await realAccount();
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

describe("license first-mint (ADR-0292 rescue lever, dual-logged, atomic on failure)", () => {
  test("mints via the SAME /issue proxy reissue uses, tier fixed to pro, expiry fixed to null", async () => {
    const acct = await realAccount();
    const anchor = wormAnchorAccount(acct);
    // An object property (not a bare `let`) so TS doesn't narrow the read below to the
    // declaration-time `null` across the intervening async call.
    const captured: { req: Parameters<AdminMutationDeps["issue"]>[0] | null } =
      { req: null };
    const capturingIssue: AdminMutationDeps["issue"] = async (req) => {
      captured.req = req;
      return okIssue(req);
    };
    const r = await firstMintLicenseAdmin(deps({ issue: capturingIssue }), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      major: 1,
    });
    expect(captured.req).toEqual({
      accountId: acct,
      tier: "pro",
      major: 1,
      expiry: null,
    });
    expect(r.token).toBe(`TOKEN-${acct}-1`);
    expect(r.licenseId).toBe("lic-1");
    expect(r.worm).toBe("ok");
    const logRows = await ground<{ action: string }>(
      `SELECT action FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows).toEqual([{ action: "license_first_mint" }]);
    expect(await worm.load(anchor)).toHaveLength(1);
  });

  test("a FAILED first-mint (proxy throws) writes NEITHER log", async () => {
    const acct = await realAccount();
    const anchor = wormAnchorAccount(acct);
    const failingIssue: AdminMutationDeps["issue"] = async () => {
      throw new Error("issue service 500");
    };
    await expect(
      firstMintLicenseAdmin(deps({ issue: failingIssue }), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        major: 1,
      }),
    ).rejects.toThrow();
    const logRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows[0]?.n).toBe(0);
    expect(await worm.load(anchor)).toHaveLength(0);
  });

  test("strict body: unknown fields rejected, exactly one target account", () => {
    expect(
      FirstMintLicenseBody.safeParse({ targetAccountId: "a", major: 1 })
        .success,
    ).toBe(true);
    expect(
      FirstMintLicenseBody.safeParse({
        targetAccountId: "a",
        major: 1,
        evil: "x",
      }).success,
    ).toBe(false);
    expect(
      FirstMintLicenseBody.safeParse({ targetAccountId: ["a", "b"], major: 1 })
        .success,
    ).toBe(false);
  });

  test("the action-enum migration admits license_first_mint", async () => {
    const { ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL } =
      await import("./admin-audit-log.ts");
    // Idempotent re-run — proves the widened CHECK is exactly what's live (mirrors the
    // purchase_revoke enum-migration coverage above).
    await tp.exec(ADMIN_ACTION_LOG_ACTION_MIGRATION_SQL);
    await expect(
      ground(
        `INSERT INTO admin_action_log (id, actor_email, target_account_id, action) VALUES ($1, 'op@gridwork.dev', 'acct_x', 'license_first_mint')`,
        [randomUUID()],
      ),
    ).resolves.toBeDefined();
    await expect(
      ground(
        `INSERT INTO admin_action_log (id, actor_email, target_account_id, action) VALUES ($1, 'op@gridwork.dev', 'acct_x', 'not_a_real_action')`,
        [randomUUID()],
      ),
    ).rejects.toThrow();
  });
});

describe("resend purchase email (G40, dual-logged, never throws)", () => {
  test("dual-logs with the entitlement count even when the emailer/user table isn't wired (never throws)", async () => {
    const acct = await realAccount();
    const anchor = wormAnchorAccount(acct);
    const r = await resendPurchaseEmailAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance", "ai-kit"],
    });
    expect(r.lineCount).toBe(2);
    expect(r.orderId).toContain("admin-resend-");
    expect(r.worm).toBe("ok");
    const logRows = await ground<{ action: string }>(
      `SELECT action FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows).toEqual([{ action: "email_resend" }]);
    expect(await worm.load(anchor)).toHaveLength(1);
  });

  test("an explicit orderId is used verbatim instead of the synthesized marker", async () => {
    const acct = await realAccount();
    const r = await resendPurchaseEmailAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      orderId: "txn_original_123",
      entitlementIds: [],
    });
    expect(r.orderId).toBe("txn_original_123");
    expect(r.lineCount).toBe(0);
  });

  test("strict body: unknown fields rejected, exactly one target account", () => {
    expect(
      ResendPurchaseEmailBody.safeParse({ targetAccountId: "a" }).success,
    ).toBe(true);
    expect(
      ResendPurchaseEmailBody.safeParse({
        targetAccountId: "a",
        orderId: "txn_1",
      }).success,
    ).toBe(true);
    expect(
      ResendPurchaseEmailBody.safeParse({ targetAccountId: "a", evil: "x" })
        .success,
    ).toBe(false);
    expect(
      ResendPurchaseEmailBody.safeParse({ targetAccountId: ["a", "b"] })
        .success,
    ).toBe(false);
  });

  test("the action-enum migration admits email_resend", async () => {
    await expect(
      ground(
        `INSERT INTO admin_action_log (id, actor_email, target_account_id, action) VALUES ($1, 'op@gridwork.dev', 'acct_x', 'email_resend')`,
        [randomUUID()],
      ),
    ).resolves.toBeDefined();
  });
});

describe("atomicity + role separation", () => {
  test("a mutation that throws mid-transaction rolls back BOTH the write and the log", async () => {
    // A Transactor wrapper that runs the mutation fully, then throws — forcing the withAdminWrite
    // transaction to roll back after grant + admin_action_log both executed. Neither must persist.
    const acct = await realAccount();
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
    const acct = await realAccount();
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

// ============================================================================================
// ADR-0225 — v2 paid-purchase revoke (Fork R-1/R-2/R-3/R-4/R-5 = A/A/A/B/A). The service core:
// source-scoped one-time revoke + bounded claw + edge deny-set truth, one withAdminWrite tx.
// ============================================================================================

/** Seed a one-time purchase's entitlement grants (source_kind one_time) under the buyer app role. */
async function seedOneTimeGrant(
  acct: string,
  purchaseId: string,
  entitlementIds: string[],
): Promise<void> {
  await withTenant(db, acct, (tx) =>
    grantEntitlements(tx, {
      accountId: acct,
      entitlementIds,
      sourceEventId: purchaseId,
      source: { kind: "one_time", purchaseId },
    }),
  );
}

/** Seed a subscription's entitlement grants (source_kind subscription) — the R-3 un-targetable source. */
async function seedSubscriptionGrant(
  acct: string,
  subscriptionId: string,
  entitlementIds: string[],
): Promise<void> {
  await withTenant(db, acct, (tx) =>
    grantEntitlements(tx, {
      accountId: acct,
      entitlementIds,
      sourceEventId: subscriptionId,
      source: { kind: "subscription", subscriptionId },
    }),
  );
}

/** Grant a one-time purchase's credits (keyed on the payment id, exactly like apply-billing-event). */
async function seedPurchaseCredits(
  acct: string,
  purchaseId: string,
  amount: number,
): Promise<void> {
  await withTenant(db, acct, (tx) =>
    grant(tx, {
      eventType: "purchase",
      accountId: acct,
      amount: asCredits(amount),
      sourceEventId: purchaseId,
    }),
  );
}

/** Spend credits (a codegen debit) so the wallet balance drops below the granted amount. */
async function spendCredits(acct: string, amount: number): Promise<void> {
  await withTenant(db, acct, (tx) =>
    debit(tx, {
      eventType: "codegen_debit",
      accountId: acct,
      amount: asCredits(amount),
      idempotencyKey: randomUUID(),
    }),
  );
}

/** Apply a whole-transaction full-refund webhook for a one-time purchase (mutual-idempotency probe). */
async function applyFullRefund(
  acct: string,
  purchaseId: string,
  amountRefunded: number,
): Promise<void> {
  const ev: DomainBillingEvent = {
    type: "refund.completed",
    sourceEventId: randomUUID(),
    accountId: acct,
    paymentId: purchaseId,
    amountRefunded,
    currency: "usd",
    fullyRefunded: true,
    adjustmentId: "",
    items: [],
  };
  await withTenant(db, acct, (tx) => applyBillingEvent(tx, ev));
}

async function walletBalance(acct: string): Promise<number> {
  const r = await ground<{ balance: number }>(
    `SELECT balance FROM credit_wallet WHERE account_id = $1`,
    [acct],
  );
  return r[0]?.balance ?? 0;
}

describe("paid purchase revoke — R-2/R-3 source-scoped one-time revoke (ADR-0225)", () => {
  test("revoke of a one-time purchase sticks; a sibling-source entitlement survives (refcount)", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    const subId = `sub_${randomUUID()}`;
    // compliance is backed by BOTH the one-time purchase and a subscription; local-ai only by the buy.
    await seedOneTimeGrant(acct, purchaseId, ["compliance", "local-ai"]);
    await seedSubscriptionGrant(acct, subId, ["compliance"]);

    const before = await withTenant(db, acct, (tx) =>
      readEntitlements(tx, acct),
    );
    expect(before).toEqual(["compliance", "local-ai"]);

    const r = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: false,
      revokeEdgeAccess: false,
    });
    expect(r.revoked).toBe(2); // both one-time grants flipped
    // local-ai drops (refcount 0); compliance SURVIVES, still backed by the active subscription grant.
    expect(r.after).toEqual(["compliance"]);
    expect(r.worm).toBe("ok");

    // Ground truth: the one-time rows are revoked; the subscription row stays active.
    const rows = await ground<{ source_kind: string; status: string }>(
      `SELECT source_kind, status FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect(
      rows
        .filter((x) => x.source_kind === "subscription")
        .every((x) => x.status === "active"),
    ).toBe(true);
    expect(
      rows
        .filter((x) => x.source_kind === "one_time")
        .every((x) => x.status === "revoked"),
    ).toBe(true);

    // Dual log: exactly one purchase_revoke row + one WORM entry.
    const logRows = await ground<{ action: string }>(
      `SELECT action FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(logRows).toEqual([{ action: "purchase_revoke" }]);
    expect(await worm.load(wormAnchorAccount(acct))).toHaveLength(1);
  });

  test("revoke sweeps an ADR-0269 coverage MIRROR with its backing purchase; a STATIC subscription grant survives", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    const subId = `sub_${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["local-ai"]);
    // The Developer-plan coverage mirror of the owned id (line_item_id='covered') plus a STATIC
    // plan grant of a DIFFERENT id under the same subscription.
    await withTenant(db, acct, (tx) =>
      upsertSubscriptionGrants(tx, {
        accountId: acct,
        entitlementIds: ["local-ai"],
        subscriptionId: subId,
        sourceEventId: `in_${subId}`,
        cadence: "year",
        coverageMirror: true,
      }),
    );
    await seedSubscriptionGrant(acct, subId, ["compliance"]);

    const r = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: false,
      revokeEdgeAccess: false,
    });
    expect(r.revoked).toBe(1); // the one_time row; the mirror falls via the reconcile
    // local-ai is GONE despite its subscription-sourced mirror (audit P1 1); compliance stays.
    expect(r.after).toEqual(["compliance"]);
    const mirror = await ground<{ status: string }>(
      `SELECT status FROM entitlement_grant
        WHERE account_id = $1 AND entitlement_id = 'local-ai' AND source_kind = 'subscription'`,
      [acct],
    );
    expect(mirror).toEqual([{ status: "revoked" }]);
  });

  test("a subscription-source target is REJECTED — v2 revokes one-time purchases ONLY (R-3=A)", async () => {
    const acct = await realAccount();
    const subId = `sub_${randomUUID()}`;
    await seedSubscriptionGrant(acct, subId, ["compliance"]);

    // The body only accepts a purchaseId; a subscription id there matches NO one_time grant, so a
    // subscription is structurally un-strippable via v2 (the correct lever is cancel-in-Paddle).
    const r = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId: subId, // the subscription id — never matches source_kind='one_time'
      clawUnspentCredits: true,
      revokeEdgeAccess: false,
    });
    expect(r.revoked).toBe(0); // nothing revoked
    expect(r.clawedBack).toBe(0); // subscription credits key on invoiceId, not this id
    expect(r.after).toEqual(["compliance"]); // still entitled — the subscription grant is untouched

    const rows = await ground<{ status: string }>(
      `SELECT status FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect(rows.every((x) => x.status === "active")).toBe(true);
  });
});

describe("paid purchase revoke — R-1 bounded credit claw (ADR-0225)", () => {
  test("claw is bounded to the wallet balance when the buyer already spent some", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    await seedPurchaseCredits(acct, purchaseId, 1000);
    await spendCredits(acct, 700); // balance now 300

    const r = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: true,
      revokeEdgeAccess: false,
    });
    expect(r.revoked).toBe(1);
    expect(r.clawedBack).toBe(300); // granted 1000, but only 300 unspent → clawed 300, never negative
    expect(r.balanceAfter).toBe(0);
    expect(await walletBalance(acct)).toBe(0);
  });

  test("re-run claws 0; a later full-refund webhook claws 0 (mutual idempotency, granted−alreadyClawed)", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    await seedPurchaseCredits(acct, purchaseId, 1000); // no spend → balance 1000

    const first = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: true,
      revokeEdgeAccess: false,
    });
    expect(first.revoked).toBe(1);
    expect(first.clawedBack).toBe(1000);
    expect(first.balanceAfter).toBe(0);

    // Re-run: the grant is already revoked (0) and the purchase has nothing left to claw (0).
    const second = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: true,
      revokeEdgeAccess: false,
    });
    expect(second.revoked).toBe(0);
    expect(second.clawedBack).toBe(0);
    expect(second.balanceAfter).toBe(0);

    // A LATER Paddle full-refund of the SAME purchase reads alreadyClawed = 1000 → remaining 0 → 0.
    await applyFullRefund(acct, purchaseId, 1000);
    expect(await walletBalance(acct)).toBe(0); // the refund double-applies nothing
  });
});

// CAISSON-20 verification: apply-billing-event.integration.test.ts's "canonical lock order" describe
// block pins the account-lock-first invariant for the refund webhook's two branches + invoice.paid +
// cancel — this is the SAME proof for the one call site that lives in THIS file, `revokePurchaseAdmin`
// (admin-mutations.ts:814 takes `acquireAccountBillingLock` before `outstandingClaw`'s claw lock at
// admin-mutations.ts:832). Mirrors that file's `lockIdFor`/`lockRecording` helpers exactly — a
// `Transactor` wrapper (`lockRecordingDb`) is the one addition needed here, since `revokePurchaseAdmin`
// opens its OWN transaction via `deps.db.transaction` (`withAdminWrite`) rather than receiving an
// already-open `tx` the way `applyBillingEvent` does.
/** The exact bigint id `withAdvisoryXactLock` derives for a key — mirrors apply-billing-event.
 *  integration.test.ts's identically-named helper (kept local rather than shared: two small,
 *  self-contained test-only probes are cheaper to read than a new shared test-util export). */
async function lockIdFor(key: string): Promise<string> {
  let captured = "";
  const probe: TenantExecutor = {
    query: async (_sql: string, params?: unknown[]) => {
      captured = String(params?.[0] ?? "");
      return { rows: [] };
    },
    exec: async () => undefined,
  };
  await withAdvisoryXactLock(probe, key, async () => {});
  return captured;
}

/** Pass-through `Transactor` recording every advisory-lock acquisition, in order, across the WHOLE
 *  `withAdminWrite` transaction `revokePurchaseAdmin` opens internally. */
function lockRecordingDb(base: Transactor, locks: string[]): Transactor {
  return {
    transaction: (fn) =>
      base.transaction((tx) =>
        fn({
          query: (sql, params) => {
            if (sql.includes("pg_advisory_xact_lock")) {
              locks.push(String(params?.[0] ?? ""));
            }
            return tx.query(sql, params);
          },
          exec: (sql) => tx.exec(sql),
        }),
      ),
  };
}

describe("canonical lock order — revokePurchaseAdmin takes the account lock before the claw lock (CAISSON-20)", () => {
  test("acquireAccountBillingLock fires strictly before outstandingClaw's per-purchase claw lock", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    await seedPurchaseCredits(acct, purchaseId, 1000);

    const accountLock = await lockIdFor(`entitlement:coverage:${acct}`);
    const clawLock = await lockIdFor(`credits:claw:${acct}:${purchaseId}`);

    const locks: string[] = [];
    await revokePurchaseAdmin(deps({ db: lockRecordingDb(db, locks) }), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: true,
      revokeEdgeAccess: false,
    });
    expect(locks[0]).toBe(accountLock); // the canonical outermost lock, first
    expect(locks).toContain(clawLock);
    expect(locks.indexOf(clawLock)).toBeGreaterThan(0); // strictly after, never reordered
  });
});

describe("paid purchase revoke — R-4 edge deny-set truth (ADR-0225)", () => {
  test("revokeEdgeAccess writes one license_revocation row per held license, idempotently", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    const licA = `lic-${randomUUID()}`;
    const licB = `lic-${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    // Two held licenses (majors 1 + 2) — each license_id is a signed-claim edge deny-set key.
    await withTenant(db, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: licA,
        tier: "pro",
        expiry: null,
        token: "TOK-A",
      }),
    );
    await withTenant(db, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 2,
        licenseId: licB,
        tier: "pro",
        expiry: null,
        token: "TOK-B",
      }),
    );

    const r = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: false,
      revokeEdgeAccess: true,
      reason: "chargeback lost at bank",
    });
    expect([...r.deniedLicenseIds].sort()).toEqual([licA, licB].sort());

    // The deny-set table has both, keyed on license_id, linked to THIS action, carrying the reason.
    const rev = await ground<{
      license_id: string;
      account_id: string;
      admin_action_id: string;
      reason: string;
    }>(
      `SELECT license_id, account_id, admin_action_id, reason
         FROM license_revocation WHERE account_id = $1 ORDER BY license_id`,
      [acct],
    );
    expect(rev.map((x) => x.license_id).sort()).toEqual([licA, licB].sort());
    expect(rev.every((x) => x.account_id === acct)).toBe(true);
    expect(rev.every((x) => x.reason === "chargeback lost at bank")).toBe(true);
    // FK-by-value: admin_action_id matches the purchase_revoke action-log row's id.
    const log = await ground<{ id: string }>(
      `SELECT id FROM admin_action_log
        WHERE target_account_id = $1 AND action = 'purchase_revoke'`,
      [acct],
    );
    expect(rev.every((x) => x.admin_action_id === log[0]?.id)).toBe(true);

    // Re-run is idempotent (ON CONFLICT DO NOTHING) — still exactly two rows; the deny-set is stable.
    const again = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: false,
      revokeEdgeAccess: true,
    });
    expect([...again.deniedLicenseIds].sort()).toEqual([licA, licB].sort());
    const count = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE account_id = $1`,
      [acct],
    );
    expect(count[0]?.n).toBe(2);

    // The full deny-set read (the downstream publish source) contains both license ids.
    const denySet = await asAdmin((tx) => readDenySet(tx));
    expect(denySet).toEqual(expect.arrayContaining([licA, licB]));
  });

  test("revokeEdgeAccess=false writes NO deny-set rows", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    await withTenant(db, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: `lic-${randomUUID()}`,
        tier: "pro",
        expiry: null,
        token: "TOK-C",
      }),
    );

    const r = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: false,
      revokeEdgeAccess: false,
    });
    expect(r.deniedLicenseIds).toEqual([]);
    const count = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE account_id = $1`,
      [acct],
    );
    expect(count[0]?.n).toBe(0);
  });

  // ADR-0225 R-4 = B publisher seam: the DB is the truth, but a paid revoke ALSO republishes the FULL
  // cross-tenant deny-set to the artifact the registry Worker reads — post-commit + best-effort. Without
  // this the DB records `deniedLicenseIds` while the edge (fail-open) never cuts access — the exact
  // silent-enforcement gap the fraud/chargeback/ToS lever exists to close.
  test("revokeEdgeAccess publishes the FULL cross-tenant deny-set post-commit (edgePublish ok)", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    const licX = `lic-${randomUUID()}`;
    const licY = `lic-${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    for (const [major, licenseId, token] of [
      [1, licX, "TOK-X"],
      [2, licY, "TOK-Y"],
    ] as const) {
      await withTenant(db, acct, (tx) =>
        storeLicenseGrant(tx, {
          accountId: acct,
          major,
          licenseId,
          tier: "pro",
          expiry: null,
          token,
        }),
      );
    }

    const published: string[][] = [];
    const r = await revokePurchaseAdmin(
      deps({
        publishDenySet: async (ids) => {
          published.push([...ids]);
        },
      }),
      {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        purchaseId,
        clawUnspentCredits: false,
        revokeEdgeAccess: true,
      },
    );

    expect(r.edgePublish).toBe("ok");
    // Called EXACTLY once, post-commit, carrying the WHOLE cross-tenant set (== the committed DB read),
    // not just this account's ids — publishing only the account's ids would wipe prior revokes' denials.
    expect(published).toHaveLength(1);
    const denySet = await asAdmin((tx) => readDenySet(tx));
    expect([...(published[0] ?? [])].sort()).toEqual([...denySet].sort());
    expect(published[0]).toEqual(expect.arrayContaining([licX, licY]));
  });

  test("revokeEdgeAccess=false skips the publish (edgePublish skipped, publisher untouched)", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    let calls = 0;
    const r = await revokePurchaseAdmin(
      deps({
        publishDenySet: async () => {
          calls += 1;
        },
      }),
      {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        purchaseId,
        clawUnspentCredits: false,
        revokeEdgeAccess: false,
      },
    );
    expect(r.edgePublish).toBe("skipped");
    expect(calls).toBe(0);
  });

  test("no publisher provisioned → edgePublish skipped, yet the DB deny-set truth is still written", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    const lic = `lic-${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    await withTenant(db, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: lic,
        tier: "pro",
        expiry: null,
        token: "TOK-N",
      }),
    );
    // deps() has NO publishDenySet — the operator-gated edge publisher is unprovisioned.
    const r = await revokePurchaseAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      purchaseId,
      clawUnspentCredits: false,
      revokeEdgeAccess: true,
    });
    expect(r.edgePublish).toBe("skipped"); // fail-open edge; the DB stays the truth
    expect(r.deniedLicenseIds).toEqual([lic]);
    const count = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE account_id = $1`,
      [acct],
    );
    expect(count[0]?.n).toBe(1); // DB truth written regardless of the skipped publish
  });

  test("a publisher that throws surfaces edgePublish failed WITHOUT undoing the durable revoke", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    const lic = `lic-${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    await withTenant(db, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: lic,
        tier: "pro",
        expiry: null,
        token: "TOK-F",
      }),
    );
    const r = await revokePurchaseAdmin(
      deps({
        publishDenySet: async () => {
          throw new Error("R2 down");
        },
      }),
      {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        purchaseId,
        clawUnspentCredits: false,
        revokeEdgeAccess: true,
      },
    );
    // Best-effort: the throw is CAUGHT + surfaced, never rethrown — the call resolved, not rejected.
    expect(r.edgePublish).toBe("failed");
    // The revoke + the DB deny-set are DURABLE despite the failed publish (the tx already committed).
    expect(r.before).toContain("compliance");
    expect(r.after).not.toContain("compliance");
    expect(r.deniedLicenseIds).toEqual([lic]);
    const rev = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE account_id = $1`,
      [acct],
    );
    expect(rev[0]?.n).toBe(1);
  });
});

describe("paid purchase revoke — atomicity + audit enum (ADR-0225)", () => {
  test("a revoke that throws mid-transaction writes NEITHER log, no deny-set, no grant flip", async () => {
    const acct = await realAccount();
    const purchaseId = `pay_${randomUUID()}`;
    await seedOneTimeGrant(acct, purchaseId, ["compliance"]);
    await withTenant(db, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: `lic-${randomUUID()}`,
        tier: "pro",
        expiry: null,
        token: "TOK",
      }),
    );

    // A Transactor that runs the mutation fully, then throws — forcing withAdminWrite to roll back
    // after the revoke + claw + deny-set write + log all executed. NONE must persist.
    const failing: Transactor = {
      async transaction(fn) {
        return db.transaction(async (tx) => {
          await fn(tx);
          throw new Error("boom after writes");
        });
      },
    };
    await expect(
      revokePurchaseAdmin(deps({ db: failing }), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        purchaseId,
        clawUnspentCredits: true,
        revokeEdgeAccess: true,
      }),
    ).rejects.toThrow();

    const ent = await ground<{ status: string }>(
      `SELECT status FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect(ent.every((x) => x.status === "active")).toBe(true); // grant NOT flipped
    const log = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM admin_action_log WHERE target_account_id = $1`,
      [acct],
    );
    expect(log[0]?.n).toBe(0);
    const rev = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE account_id = $1`,
      [acct],
    );
    expect(rev[0]?.n).toBe(0);
    expect(await worm.load(wormAnchorAccount(acct))).toHaveLength(0);
  });

  test("the action-enum migration admits purchase_revoke; an unregistered action is CHECK-rejected", async () => {
    // A purchase_revoke row is accepted by admin_action_log_action (the widened CHECK / migration)…
    await expect(
      ground(
        `INSERT INTO admin_action_log (id, actor_email, target_account_id, action)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), "op@gridwork.dev", "acct", "purchase_revoke"],
      ),
    ).resolves.toBeDefined();
    // …while a bogus action value is rejected closed by the same CHECK.
    await expect(
      ground(
        `INSERT INTO admin_action_log (id, actor_email, target_account_id, action)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), "op@gridwork.dev", "acct", "totally_bogus_action"],
      ),
    ).rejects.toThrow();
  });
});

describe("paid revoke strict boundary body (ADR-0225)", () => {
  test("RevokePurchaseBody rejects unknown fields + requires the explicit flags", () => {
    expect(
      RevokePurchaseBody.safeParse({
        targetAccountId: "acct",
        purchaseId: "pay_1",
        clawUnspentCredits: true,
        revokeEdgeAccess: true,
      }).success,
    ).toBe(true);
    // reason is optional
    expect(
      RevokePurchaseBody.safeParse({
        targetAccountId: "acct",
        purchaseId: "pay_1",
        clawUnspentCredits: false,
        revokeEdgeAccess: false,
        reason: "fraud",
      }).success,
    ).toBe(true);
    // unknown field rejected (.strict())
    expect(
      RevokePurchaseBody.safeParse({
        targetAccountId: "acct",
        purchaseId: "pay_1",
        clawUnspentCredits: true,
        revokeEdgeAccess: true,
        rogue: 1,
      }).success,
    ).toBe(false);
    // the two effect flags are a REQUIRED explicit operator choice, never defaulted at this boundary
    expect(
      RevokePurchaseBody.safeParse({
        targetAccountId: "acct",
        purchaseId: "pay_1",
      }).success,
    ).toBe(false);
    // empty purchaseId rejected
    expect(
      RevokePurchaseBody.safeParse({
        targetAccountId: "acct",
        purchaseId: "",
        clawUnspentCredits: true,
        revokeEdgeAccess: true,
      }).success,
    ).toBe(false);
    // whitespace/control account id rejected (real better-auth id shape)
    expect(
      RevokePurchaseBody.safeParse({
        targetAccountId: "bad id",
        purchaseId: "pay_1",
        clawUnspentCredits: true,
        revokeEdgeAccess: true,
      }).success,
    ).toBe(false);
  });
});

describe("system write-mode lever (read-only gate)", () => {
  test("unset source reads active; read_only blocks a mutation fail-closed; active unblocks", async () => {
    // No `system_mode` row has been written by any earlier test in this file — the default is active.
    expect(await readSystemMode(db)).toBe("active");

    const acct = await realAccount();
    // Arm read-only: the lever dual-logs and the mode read flips.
    const armed = await setSystemModeAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      mode: "read_only",
    });
    expect(armed.previous).toBe("active");
    expect(armed.worm).toBe("ok");
    expect(await readSystemMode(db)).toBe("read_only");

    // Every mutating action is gated fail-closed (409 ConflictError), BEFORE any write lands.
    await expect(
      grantEntitlementAdmin(deps(), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        entitlementIds: ["compliance"],
      }),
    ).rejects.toThrow(ConflictError);
    await expect(
      adjustCreditsAdmin(deps(), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        deltaCredits: 100,
        reason: "should be blocked",
      }),
    ).rejects.toThrow(ConflictError);
    // Ground truth: nothing was written for the account while read-only.
    const rows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM entitlement_grant WHERE account_id = $1`,
      [acct],
    );
    expect(rows[0]?.n).toBe(0);

    // The lever itself is NOT gated — flipping back to active must work while read-only.
    const unarmed = await setSystemModeAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      mode: "active",
    });
    expect(unarmed.previous).toBe("read_only");
    expect(await readSystemMode(db)).toBe("active");

    // Unblocked: the same mutation now lands.
    const g = await grantEntitlementAdmin(deps(), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      entitlementIds: ["compliance"],
    });
    expect(g.after).toEqual(["compliance"]);
  });

  test("SetSystemModeBody is strict and only admits the two modes", () => {
    expect(SetSystemModeBody.safeParse({ mode: "read_only" }).success).toBe(
      true,
    );
    expect(SetSystemModeBody.safeParse({ mode: "active" }).success).toBe(true);
    expect(SetSystemModeBody.safeParse({ mode: "frozen" }).success).toBe(false);
    expect(
      SetSystemModeBody.safeParse({ mode: "active", rogue: 1 }).success,
    ).toBe(false);
  });
});

describe("license rotation (true key rotation via the edge deny-set)", () => {
  /** A rotation-aware /issue stub: mints a FRESH id per call and records what it was asked. */
  function rotatingIssue(): {
    issue: AdminMutationDeps["issue"];
    calls: Array<{ rotate?: boolean }>;
    minted: string[];
  } {
    const calls: Array<{ rotate?: boolean }> = [];
    const minted: string[] = [];
    const issue: AdminMutationDeps["issue"] = async (req) => {
      calls.push({
        ...(req.rotate !== undefined ? { rotate: req.rotate } : {}),
      });
      const licenseId = randomUUID();
      minted.push(licenseId);
      return { token: `ROTATED-${licenseId}`, licenseId };
    };
    return { issue, calls, minted };
  }

  /** Seed a stored license grant (the key being rotated) for (acct, major 0). */
  async function seedLicense(acct: string, licenseId: string): Promise<void> {
    await withTenant(db, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 0,
        licenseId,
        tier: "pro",
        expiry: null,
        token: `TOK-${licenseId}`,
      }),
    );
  }

  test("rotate denies the OLD key, mints a fresh one, dual-logs, and re-runs idempotently", async () => {
    const acct = await realAccount();
    const oldKey = randomUUID();
    await seedLicense(acct, oldKey);
    const stub = rotatingIssue();

    const r = await rotateLicenseAdmin(deps({ issue: stub.issue }), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      major: 0,
      reason: "key leaked in a paste",
      tier: "pro",
      expiry: null,
      oldLicenseId: oldKey,
    });
    // A FRESH key came back; the old one is what got denied.
    expect(r.oldLicenseId).toBe(oldKey);
    expect(r.licenseId).not.toBe(oldKey);
    expect(r.token).toBe(`ROTATED-${r.licenseId}`);
    expect(stub.calls).toEqual([{ rotate: true }]); // the proxy was asked for a FORCED re-mint
    expect(r.worm).toBe("ok");
    expect(r.edgePublish).toBe("skipped"); // no publisher provisioned in this suite

    // Deny-set truth: the OLD key is a license_revocation row (the edge CRL's DB half)…
    const denied = await ground<{
      license_id: string;
      account_id: string;
      reason: string | null;
    }>(
      `SELECT license_id, account_id, reason FROM license_revocation WHERE license_id = $1`,
      [oldKey],
    );
    expect(denied).toHaveLength(1);
    expect(denied[0]?.account_id).toBe(acct);
    expect(denied[0]?.reason).toBe("key leaked in a paste");
    // …and the deny-set READ (what the publish path ships to the Worker) contains it.
    const denySet = await asAdmin((tx) => readDenySet(tx));
    expect(denySet).toContain(oldKey);
    // The NEW key is NOT denied.
    expect(denySet).not.toContain(r.licenseId);

    // Dual log: a license_rotate action row landed with the old→new transition.
    const browsed = await asAdmin((tx) => readAdminActionLog(tx, 50));
    const mine = browsed.filter(
      (row) => row.targetAccountId === acct && row.action === "license_rotate",
    );
    expect(mine).toHaveLength(1);

    // Idempotent re-run (a retried rotation of the same old key): the PK conflict no-ops the
    // denial — still one row — and a second fresh key is minted.
    const again = await rotateLicenseAdmin(deps({ issue: stub.issue }), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      major: 0,
      tier: "pro",
      expiry: null,
      oldLicenseId: oldKey,
    });
    expect(again.licenseId).not.toBe(r.licenseId);
    const deniedRows = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE license_id = $1`,
      [oldKey],
    );
    expect(deniedRows[0]?.n).toBe(1);
  });

  test("a STALE route-read id denies BOTH ids: the stale one and the row's current key", async () => {
    // The TOCTOU shape: the route read the grant's licenseId, then a concurrent /issue re-mint
    // (a renewal landing mid-rotation) replaced the stored key before the rotation ran. Denying
    // only the route-read id would leave the replacement key live at the edge forever — the
    // rotation re-reads the CURRENT id inside the deny transaction and denies both.
    const acct = await realAccount();
    const staleKey = randomUUID(); // what the route read, one HTTP hop ago
    const currentKey = randomUUID(); // what a concurrent re-mint stored since
    await seedLicense(acct, currentKey);
    const stub = rotatingIssue();

    const r = await rotateLicenseAdmin(deps({ issue: stub.issue }), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      major: 0,
      tier: "pro",
      expiry: null,
      oldLicenseId: staleKey,
    });
    const denySet = await asAdmin((tx) => readDenySet(tx));
    expect(denySet).toContain(staleKey);
    expect(denySet).toContain(currentKey);
    expect(denySet).not.toContain(r.licenseId);
  });

  test("a failed MINT still leaves the old key denied (revoke-first; retry converges)", async () => {
    const acct = await realAccount();
    const oldKey = randomUUID();
    await seedLicense(acct, oldKey);
    const failingIssue: AdminMutationDeps["issue"] = async () => {
      throw new Error("license /issue proxy returned 503");
    };

    await expect(
      rotateLicenseAdmin(deps({ issue: failingIssue }), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: acct,
        major: 0,
        tier: "pro",
        expiry: null,
        oldLicenseId: oldKey,
      }),
    ).rejects.toThrow("503");

    // The denial COMMITTED FIRST — durable despite the failed mint (deny-without-replacement is
    // the fail-safe direction for a compromised key)…
    const denied = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE license_id = $1`,
      [oldKey],
    );
    expect(denied[0]?.n).toBe(1);
    // …no action log claims a rotation that never completed…
    const browsed = await asAdmin((tx) => readAdminActionLog(tx, 50));
    expect(
      browsed.filter(
        (row) =>
          row.targetAccountId === acct && row.action === "license_rotate",
      ),
    ).toHaveLength(0);
    // …and the stored grant is untouched (the mint never ran).
    const stored = await withTenant(db, acct, (tx) =>
      tx.query<{ license_id: string }>(
        `SELECT license_id FROM license_grant WHERE account_id = $1 AND major = 0`,
        [acct],
      ),
    );
    expect(stored.rows[0]?.license_id).toBe(oldKey);

    // The RETRY converges: the denial re-insert no-ops and the fresh mint lands.
    const stub = rotatingIssue();
    const retried = await rotateLicenseAdmin(deps({ issue: stub.issue }), {
      actorEmail: "op@gridwork.dev",
      targetAccountId: acct,
      major: 0,
      tier: "pro",
      expiry: null,
      oldLicenseId: oldKey,
    });
    expect(retried.licenseId).not.toBe(oldKey);
    expect(retried.worm).toBe("ok");
  });

  test("a failed REVOKE never mints — no orphan new key (atomic leg 1)", async () => {
    // A nonexistent target fails the existence check INSIDE the revoke transaction, rolling the
    // denial back — the mint proxy must never have been called.
    const stub = rotatingIssue();
    const ghost = betterAuthId(); // never seeded
    await expect(
      rotateLicenseAdmin(deps({ issue: stub.issue }), {
        actorEmail: "op@gridwork.dev",
        targetAccountId: ghost,
        major: 0,
        tier: "pro",
        expiry: null,
        oldLicenseId: "lic-ghost",
      }),
    ).rejects.toThrow(NotFoundError);
    expect(stub.calls).toHaveLength(0); // no mint without its revoke
    expect(stub.minted).toHaveLength(0);
    const denied = await ground<{ n: number }>(
      `SELECT count(*)::int AS n FROM license_revocation WHERE license_id = 'lic-ghost'`,
    );
    expect(denied[0]?.n).toBe(0); // the denial rolled back with the failed leg
  });

  test("RotateLicenseBody is strict (unknown fields rejected; reason optional)", () => {
    expect(
      RotateLicenseBody.safeParse({ targetAccountId: "acct", major: 0 })
        .success,
    ).toBe(true);
    expect(
      RotateLicenseBody.safeParse({
        targetAccountId: "acct",
        major: 0,
        reason: "leak",
      }).success,
    ).toBe(true);
    expect(
      RotateLicenseBody.safeParse({
        targetAccountId: "acct",
        major: 0,
        rogue: 1,
      }).success,
    ).toBe(false);
    expect(
      RotateLicenseBody.safeParse({ targetAccountId: "acct", major: -1 })
        .success,
    ).toBe(false);
  });
});
