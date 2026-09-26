// license_grant store on PGlite + real withTenant RLS ("persist & reuse", implements ADR-0110/0010).
// Asserts: a fresh (account, major) grant persists and reads back verbatim; a same-(account, major)
// store call is idempotent — `storeLicenseGrant` reports the loss and no second row lands; a DIFFERENT
// major for the same account persists its own independent row; RLS isolates accounts (a cross-tenant
// read sees nothing, and a forged cross-tenant write is refused by the policy WITH CHECK). Each test
// uses its own account id — no cross-test cleanup.
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
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  LICENSE_GRANT_SCHEMA_SQL,
  readLicenseGrant,
  storeLicenseGrant,
} from "./license-grant-store.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(LICENSE_GRANT_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("license_grant store (persist & reuse, RLS)", () => {
  test("a fresh grant persists and reads back verbatim", async () => {
    const acct = "acct_store_fresh";
    const stored = await withTenant(tp.pg, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: "lic_1",
        tier: "pro",
        expiry: null,
        token: "CAISSON-PRO-deadbeef",
      }),
    );
    expect(stored).toBe(true);
    const grant = await withTenant(tp.pg, acct, (tx) =>
      readLicenseGrant(tx, acct, 1),
    );
    expect(grant).not.toBeNull();
    expect(grant?.licenseId).toBe("lic_1");
    expect(grant?.tier).toBe("pro");
    expect(grant?.major).toBe(1);
    expect(grant?.token).toBe("CAISSON-PRO-deadbeef");
  });

  test("reading a (account, major) with no grant returns null", async () => {
    const acct = "acct_store_miss";
    expect(
      await withTenant(tp.pg, acct, (tx) => readLicenseGrant(tx, acct, 9)),
    ).toBeNull();
  });

  test("a same-(account, major) store is idempotent — no second row, original token wins", async () => {
    const acct = "acct_store_idem";
    const first = await withTenant(tp.pg, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: "lic_first",
        tier: "pro",
        expiry: null,
        token: "CAISSON-PRO-first",
      }),
    );
    expect(first).toBe(true);
    // A second mint for the SAME (account, major) — e.g. a lost race — must NOT overwrite.
    const second = await withTenant(tp.pg, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: "lic_second",
        tier: "pro",
        expiry: null,
        token: "CAISSON-PRO-second",
      }),
    );
    expect(second).toBe(false);
    const grant = await withTenant(tp.pg, acct, (tx) =>
      readLicenseGrant(tx, acct, 1),
    );
    expect(grant?.licenseId).toBe("lic_first"); // the FIRST writer's row, untouched
    expect(grant?.token).toBe("CAISSON-PRO-first");
    const rows = await tp.query(
      `SELECT count(*)::int AS n FROM license_grant WHERE account_id = $1`,
      [acct],
    );
    expect((rows[0] as { n: number }).n).toBe(1); // exactly one row, no proliferation
  });

  test("a different major for the same account mints its own independent grant", async () => {
    const acct = "acct_store_major";
    await withTenant(tp.pg, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 1,
        licenseId: "lic_v1",
        tier: "pro",
        expiry: null,
        token: "CAISSON-PRO-v1",
      }),
    );
    const storedV2 = await withTenant(tp.pg, acct, (tx) =>
      storeLicenseGrant(tx, {
        accountId: acct,
        major: 2,
        licenseId: "lic_v2",
        tier: "pro",
        expiry: null,
        token: "CAISSON-PRO-v2",
      }),
    );
    expect(storedV2).toBe(true);
    const v1 = await withTenant(tp.pg, acct, (tx) =>
      readLicenseGrant(tx, acct, 1),
    );
    const v2 = await withTenant(tp.pg, acct, (tx) =>
      readLicenseGrant(tx, acct, 2),
    );
    expect(v1?.token).toBe("CAISSON-PRO-v1");
    expect(v2?.token).toBe("CAISSON-PRO-v2");
  });

  test("RLS isolates accounts — B never sees A's grant", async () => {
    const a = "acct_grant_a";
    const b = "acct_grant_b";
    await withTenant(tp.pg, a, (tx) =>
      storeLicenseGrant(tx, {
        accountId: a,
        major: 1,
        licenseId: "lic_a",
        tier: "pro",
        expiry: null,
        token: "CAISSON-PRO-a",
      }),
    );
    const crossRead = await withTenant(tp.pg, b, (tx) =>
      readLicenseGrant(tx, a, 1),
    );
    expect(crossRead).toBeNull();
  });

  test("a cross-tenant write is refused by the policy WITH CHECK (fail-closed)", async () => {
    const owner = "acct_grant_owner";
    const attacker = "acct_grant_attacker";
    await expect(
      withTenant(tp.pg, attacker, (tx) =>
        storeLicenseGrant(tx, {
          accountId: owner,
          major: 1,
          licenseId: "lic_forged",
          tier: "pro",
          expiry: null,
          token: "CAISSON-PRO-forged",
        }),
      ),
    ).rejects.toThrow();
    const grant = await withTenant(tp.pg, owner, (tx) =>
      readLicenseGrant(tx, owner, 1),
    );
    expect(grant).toBeNull(); // nothing was written under the owner
  });
});
