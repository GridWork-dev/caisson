// ADR-0225 R-6 — the paid-revoke impact preview reader, on PGlite via @caisson/testing. Proves the
// three load-bearing preview facts against seeded fixtures: (1) the picker lists every active
// one-time purchase (and ONLY one-time — a subscription is un-targetable, R-3); (2) refcount
// survival — an entitlement a sibling source still backs SURVIVES, one backed only by the target
// DROPS; (3) the claw preview is the EXACT arithmetic the mutation runs, `min(max(0, granted −
// alreadyClawed), balance)`. Seeds as the buyer `app` role (withTenant), reads as the read-only
// `admin` role — the same seam the route uses.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
import { asCredits } from "@caisson/kernel";
import {
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  LICENSE_GRANT_SCHEMA_SQL,
  grantEntitlements,
  storeLicenseGrant,
} from "@caisson/service-license";
import {
  withTenant,
  type TenantExecutor,
  type Transactor,
} from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import { buildAdminReadPolicySql } from "./admin-read.ts";
import {
  previewAccountPurchaseRevokes,
  readTenants,
  type AccountRevokePreview,
} from "./business-reads.ts";

// G29 email-lookup double: mirrors the identical minimal test-double
// `services/license/src/email-notify.integration.test.ts` already uses for better-auth's own
// "user" table (the real one is created by better-auth's getMigrations).
const BETTER_AUTH_USER_DOUBLE_SQL = `
CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "name" text
);
`;

let tp: TestPg;
let db: Transactor;

/** Read as the read-only `admin` role (the ADR-0141 cross-tenant cockpit seam the route uses). */
async function asAdmin<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE admin`);
    return fn(tx);
  });
}

async function seedOneTime(
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

async function seedSubscription(
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

async function spend(acct: string, amount: number): Promise<void> {
  await withTenant(db, acct, (tx) =>
    debit(tx, {
      eventType: "codegen_debit",
      accountId: acct,
      amount: asCredits(amount),
      idempotencyKey: randomUUID(),
    }),
  );
}

async function seedLicense(acct: string, major: number): Promise<void> {
  await withTenant(db, acct, (tx) =>
    storeLicenseGrant(tx, {
      accountId: acct,
      major,
      licenseId: `lic-${acct}-${String(major)}`,
      tier: "compliance",
      expiry: null,
      token: `TOKEN-${acct}-${String(major)}`,
    }),
  );
}

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin NOLOGIN; END IF;
  END $$;`);
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(CREDIT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(CREDIT_EXPIRY_MIGRATION_SQL);
  await tp.exec(GRANT_CONSUMPTION_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(LICENSE_GRANT_SCHEMA_SQL);
  // G29: account_member (the email-lookup join source) + the better-auth "user" double + its grant.
  await tp.exec(ACCOUNT_MEMBER_SCHEMA_SQL);
  await tp.exec(BETTER_AUTH_USER_DOUBLE_SQL);
  await tp.exec(`GRANT SELECT ON "user" TO admin;`);
  // The ADR-0141 admin-read policies for every table the preview reads — INCLUDING credit_event
  // (the ADR-0225 addition the claw preview needs) and credit_wallet (the balance ceiling).
  for (const table of [
    "credit_wallet",
    "credit_event",
    "entitlement_grant",
    "license_grant",
    "account_member",
  ]) {
    await tp.exec(buildAdminReadPolicySql(table));
  }
});

afterAll(async () => {
  await tp.close();
});

describe("previewAccountPurchaseRevokes (ADR-0225 R-6 impact preview)", () => {
  test("lists both one-time sources (never the subscription) with per-source refcount survival", async () => {
    const acct = `acct_${randomUUID()}`;
    const payA = `pay_${randomUUID()}`;
    const payB = `pay_${randomUUID()}`;
    const sub = `sub_${randomUUID()}`;
    // payA backs compliance (ALSO backed by the subscription → survives) + local-ai (only payA → drops).
    await seedOneTime(acct, payA, ["compliance", "local-ai"]);
    // payB backs ai-kit only (no sibling → drops).
    await seedOneTime(acct, payB, ["ai-kit"]);
    await seedSubscription(acct, sub, ["compliance"]);

    const preview: AccountRevokePreview = await asAdmin((tx) =>
      previewAccountPurchaseRevokes(tx, acct),
    );

    // The picker lists BOTH one-time purchases and ONLY them — never the subscription (R-3).
    expect(preview.sources.map((s) => s.purchaseId).sort()).toEqual(
      [payA, payB].sort(),
    );

    const a = preview.sources.find((s) => s.purchaseId === payA);
    expect(a?.entitlementsSurviving).toEqual(["compliance"]); // refcounted by the subscription
    expect(a?.entitlementsDropping).toEqual(["local-ai"]);

    const b = preview.sources.find((s) => s.purchaseId === payB);
    expect(b?.entitlementsSurviving).toEqual([]);
    expect(b?.entitlementsDropping).toEqual(["ai-kit"]);
  });

  test("claw preview is min(max(0, granted − alreadyClawed), balance) — the mutation's exact math", async () => {
    const acct = `acct_${randomUUID()}`;
    const pay = `pay_${randomUUID()}`;
    await seedOneTime(acct, pay, ["compliance"]);
    await seedPurchaseCredits(acct, pay, 1000); // granted 1000
    await spend(acct, 300); // wallet balance now 700 < granted

    const preview = await asAdmin((tx) =>
      previewAccountPurchaseRevokes(tx, acct),
    );
    const s = preview.sources.find((x) => x.purchaseId === pay);
    expect(s?.granted).toBe(1000);
    expect(s?.alreadyClawed).toBe(0);
    // min(max(0, 1000 − 0), 700) = 700 — bounded to the balance, never the raw grant.
    expect(preview.balance).toBe(700);
    expect(s?.clawPreview).toBe(700);
  });

  test("held licenses populate the edge deny-set size; no one-time purchases yields no sources", async () => {
    const acct = `acct_${randomUUID()}`;
    const sub = `sub_${randomUUID()}`;
    await seedSubscription(acct, sub, ["compliance"]); // subscription only → un-targetable
    await seedLicense(acct, 1);
    await seedLicense(acct, 2);

    const preview = await asAdmin((tx) =>
      previewAccountPurchaseRevokes(tx, acct),
    );
    expect(preview.sources).toEqual([]); // no one-time purchase to revoke
    expect(preview.licensesToDeny.length).toBe(2); // both held licenses would be denied at the edge
  });
});

describe("readTenants (G29 email lookup + search + pagination)", () => {
  async function seedUser(userId: string, email: string): Promise<void> {
    await tp.query(`INSERT INTO "user" (id, email) VALUES ($1, $2)`, [
      userId,
      email,
    ]);
  }
  async function seedMember(acct: string, userId: string): Promise<void> {
    await withTenant(db, acct, (tx) =>
      tx.query(
        `INSERT INTO account_member (account_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [acct, userId],
      ),
    );
  }

  test("resolves the owner's email via account_member -> user", async () => {
    const acct = `acct_${randomUUID()}`;
    const email = `buyer-${randomUUID()}@example.com`;
    await seedOneTime(acct, `pay_${randomUUID()}`, ["compliance"]);
    await seedUser(acct, email);
    await seedMember(acct, acct);

    const { rows } = await asAdmin((tx) => readTenants(tx));
    const row = rows.find((r) => r.accountId === acct);
    expect(row?.email).toBe(email);
  });

  test("a tenant with no account_member row resolves email null (never throws)", async () => {
    const acct = `acct_${randomUUID()}`;
    await seedOneTime(acct, `pay_${randomUUID()}`, ["ai-kit"]);

    const { rows } = await asAdmin((tx) => readTenants(tx));
    const row = rows.find((r) => r.accountId === acct);
    expect(row?.email).toBeNull();
  });

  test("search matches by account id OR by email substring", async () => {
    const acct = `acct_findme_${randomUUID()}`;
    const email = `findme-${randomUUID()}@example.com`;
    await seedOneTime(acct, `pay_${randomUUID()}`, ["compliance"]);
    await seedUser(acct, email);
    await seedMember(acct, acct);

    const byAccount = await asAdmin((tx) =>
      readTenants(tx, { search: "findme" }),
    );
    expect(byAccount.rows.some((r) => r.accountId === acct)).toBe(true);

    const byEmail = await asAdmin((tx) => readTenants(tx, { search: email }));
    expect(byEmail.rows.map((r) => r.accountId)).toEqual([acct]);

    const noMatch = await asAdmin((tx) =>
      readTenants(tx, { search: `nobody-${randomUUID()}` }),
    );
    expect(noMatch.rows).toEqual([]);
    expect(noMatch.total).toBe(0);
  });

  test("limit/offset paginate; total reflects the full matching count, not the page size", async () => {
    const tag = randomUUID();
    const accts = Array.from(
      { length: 3 },
      (_, i) => `acct_page_${tag}_${String(i)}`,
    );
    for (const acct of accts) {
      await seedOneTime(acct, `pay_${randomUUID()}`, ["compliance"]);
    }

    const page1 = await asAdmin((tx) =>
      readTenants(tx, { search: `page_${tag}`, limit: 2, offset: 0 }),
    );
    expect(page1.rows.length).toBe(2);
    expect(page1.total).toBe(3);

    const page2 = await asAdmin((tx) =>
      readTenants(tx, { search: `page_${tag}`, limit: 2, offset: 2 }),
    );
    expect(page2.rows.length).toBe(1);
    expect(page2.total).toBe(3);
  });
});
