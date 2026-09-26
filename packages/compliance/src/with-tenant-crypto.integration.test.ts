// withTenantCrypto integration proof (ADR-0005/0055): proves an encrypted write outside the RLS
// scope fails closed. Runs the REAL `withTenant` + the REAL field-crypto context against PGlite (a true Postgres
// with FORCE RLS, SET ROLE, WITH CHECK) — no network, no live cloud/KMS. The boundary == boundary
// invariant proven from both sides: an encrypted SEC/HIPAA field lands ONLY when both the RLS tenant
// scope and the crypto context are bound; either one missing → fail-closed, nothing written.
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { randomUUID } from "node:crypto";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { TenancyError } from "@caisson-sh/kernel";
import {
  buildTenantPolicySql,
  type TenantExecutor,
  withTenant,
} from "@caisson-sh/tenancy-rls";
import {
  currentFieldCryptoContext,
  decryptField,
  DerivedKeyProvider,
  derivedContext,
  encryptField,
  parseEnvelope,
  withFieldCryptoContext,
} from "@caisson-sh/field-crypto";
import { withTenantCrypto } from "./with-tenant-crypto.ts";

const MASTER = Buffer.alloc(32, 0x11);
const SALT = Buffer.alloc(32, 0x22);
const A = "acct_a";
const B = "acct_b";
const COL = "phi_record.ssn";
const SSN = "078-05-1120";

// A SEC/HIPAA table: a client-minted crypto.randomUUID() PK (so the row id exists pre-INSERT for the
// row-bound AAD, ADR-0055) + an encrypted-at-rest column, fail-closed tenant-isolated.
const SCHEMA = `
CREATE TABLE phi_record (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  ssn text NOT NULL
);
${buildTenantPolicySql("phi_record")}
`;

let tp: TestPg;
let provider: DerivedKeyProvider;

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  provider = new DerivedKeyProvider(MASTER, SALT);
  await tp.exec(`DROP TABLE IF EXISTS phi_record;`);
  await tp.exec(SCHEMA);
});

afterAll(async () => {
  await tp.close();
});

/**
 * Encrypt under the AMBIENT field-crypto context (throws without `withFieldCryptoContext`), then
 * INSERT under the active RLS scope (refused without `withTenant`). Deliberately exercises BOTH
 * halves at once so a missing half surfaces as a fail-closed throw.
 */
async function writePhi(
  tx: TenantExecutor,
  accountId: string,
  rowId: string,
  ssn: string,
): Promise<void> {
  const sealed = encryptField(currentFieldCryptoContext(), COL, rowId, ssn);
  await tx.query(
    `INSERT INTO phi_record (id, account_id, ssn) VALUES ($1, $2, $3)`,
    [rowId, accountId, sealed],
  );
}

async function rowCount(): Promise<number> {
  const r = await tp.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM phi_record`,
  );
  return r[0]!.n;
}

describe("withTenantCrypto — boundary == boundary (ADR-0005)", () => {
  test("binds the SAME account into BOTH the RLS GUC and the crypto context", async () => {
    await withTenantCrypto(tp.pg, A, provider, async (tx) => {
      // The crypto context is scoped to A...
      expect(currentFieldCryptoContext().tenantId).toBe(A);
      // ...and so is the RLS GUC, inside the same transaction.
      const r = await tx.query<{ a: string | null }>(
        `SELECT current_setting('app.current_account', true) AS a`,
      );
      expect(r.rows[0]?.a).toBe(A);
    });
  });

  test("an encrypted SEC/HIPAA field round-trips under the composed scope", async () => {
    const rowId = randomUUID();
    await withTenantCrypto(tp.pg, A, provider, (tx) =>
      writePhi(tx, A, rowId, SSN),
    );

    // Ground truth (superuser, RLS bypassed): the stored cell is an envelope, never the plaintext.
    const stored = await tp.query<{ ssn: string }>(
      `SELECT ssn FROM phi_record WHERE id = $1`,
      [rowId],
    );
    expect(stored[0]!.ssn).not.toBe(SSN);
    expect(parseEnvelope(stored[0]!.ssn).keyVersion).toBe(1);

    // Read back under the SAME composed scope → decrypts (row-bound AAD authenticates).
    const got = await withTenantCrypto(tp.pg, A, provider, async (tx) => {
      const r = await tx.query<{ ssn: string }>(
        `SELECT ssn FROM phi_record WHERE id = $1`,
        [rowId],
      );
      return decryptField(
        currentFieldCryptoContext(),
        COL,
        rowId,
        r.rows[0]!.ssn,
      );
    });
    expect(got).toBe(SSN);
  });
});

describe("withTenantCrypto — fail-closed when EITHER half is missing (TM-N)", () => {
  test("RLS scope WITHOUT the crypto context: encryption refuses unscoped, nothing written", async () => {
    // `withTenant` alone binds the GUC but NOT the field-crypto context → currentFieldCryptoContext()
    // throws before any INSERT runs.
    await expect(
      withTenant(tp.pg, A, (tx) => writePhi(tx, A, randomUUID(), SSN)),
    ).rejects.toThrow(/no tenant context bound/);
    expect(await rowCount()).toBe(0);
  });

  test("crypto context WITHOUT the RLS scope: RLS refuses the write, nothing written", async () => {
    // The crypto context is bound (encryption succeeds), but the write runs as `app` with NO tenant
    // GUC → the INSERT's WITH CHECK evaluates against a NULL account and is refused.
    await expect(
      withFieldCryptoContext(derivedContext(provider, A), () =>
        tp.asAppNoTenant((tx) => writePhi(tx, A, randomUUID(), SSN)),
      ),
    ).rejects.toThrow();
    expect(await rowCount()).toBe(0);
  });

  test("refuses an empty account id (delegates to the withTenant fail-closed guard)", async () => {
    await expect(
      withTenantCrypto(tp.pg, "", provider, async () => undefined),
    ).rejects.toBeInstanceOf(TenancyError);
  });
});

describe("withTenantCrypto — cross-tenant isolation from both boundaries", () => {
  test("a second tenant can neither READ (RLS) nor DECRYPT (crypto) the first tenant's field", async () => {
    const rowId = randomUUID();
    await withTenantCrypto(tp.pg, A, provider, (tx) =>
      writePhi(tx, A, rowId, SSN),
    );

    // Storage boundary: tenant B, under its own composed scope, sees no row.
    const seenByB = await withTenantCrypto(tp.pg, B, provider, async (tx) => {
      const r = await tx.query<{ id: string }>(
        `SELECT id FROM phi_record WHERE id = $1`,
        [rowId],
      );
      return r.rows.length;
    });
    expect(seenByB).toBe(0);

    // Crypto boundary: even given A's ciphertext, B's context cannot authenticate it.
    const aCipher = (
      await tp.query<{ ssn: string }>(
        `SELECT ssn FROM phi_record WHERE id = $1`,
        [rowId],
      )
    )[0]!.ssn;
    await expect(
      withTenantCrypto(tp.pg, B, provider, async () =>
        decryptField(currentFieldCryptoContext(), COL, rowId, aCipher),
      ),
    ).rejects.toThrow();

    // ...and A still round-trips its own.
    const got = await withTenantCrypto(tp.pg, A, provider, async () =>
      decryptField(currentFieldCryptoContext(), COL, rowId, aCipher),
    );
    expect(got).toBe(SSN);
  });
});
