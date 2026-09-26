// Cross-tenant isolation — the ADR-0043/0005 binding: the encryption boundary EQUALS the RLS tenant
// boundary. Runs on PGlite inside `withTenant` (SET ROLE app), so RLS is real (a superuser would
// BYPASSRLS and mask a fail-closed bug). Proves: two tenants derive distinct keys; tenant B can
// neither SEE (RLS) nor DECRYPT (crypto) tenant A's field; and a pre-rotation v1 ciphertext still
// decrypts after the tenant rotates to v2.
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
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import { buildTenantPolicySql, withTenant } from "@caisson-sh/tenancy-rls";
import { DerivedKeyProvider } from "./provider.ts";
import { TenantFieldCrypto } from "./crypto.ts";
import { parseEnvelope } from "./envelope.ts";

const MASTER = Buffer.alloc(32, 0x11);
const SALT = Buffer.alloc(32, 0x22);
const A = "acct_a";
const B = "acct_b";
const COL = "secret_doc.body";

const SCHEMA = `
CREATE TABLE secret_doc (
  account_id text NOT NULL,
  id text NOT NULL,
  body text NOT NULL,
  PRIMARY KEY (account_id, id)
);
${buildTenantPolicySql("secret_doc")}
`;

let tp: TestPg;

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await tp.exec(`DROP TABLE IF EXISTS secret_doc;`);
  await tp.exec(SCHEMA);
});

afterAll(async () => {
  await tp.close();
});

describe("field-crypto cross-tenant isolation (PGlite + withTenant)", () => {
  test("two tenants derive distinct keys", () => {
    const provider = new DerivedKeyProvider(MASTER, SALT);
    expect(provider.deriveKey(A, 1).toString("hex")).not.toBe(
      provider.deriveKey(B, 1).toString("hex"),
    );
  });

  test("a field is stored encrypted, RLS hides the row, and B's key cannot decrypt it", async () => {
    const provider = new DerivedKeyProvider(MASTER, SALT);
    const crypto = new TenantFieldCrypto(provider);

    // Tenant A writes an encrypted field through its own RLS-scoped transaction.
    await withTenant(tp.pg, A, async (tx) => {
      const sealed = await crypto.encryptField(A, "A-secret", COL);
      await tx.query(
        `INSERT INTO secret_doc (account_id, id, body) VALUES ($1, $2, $3)`,
        [A, "d1", sealed],
      );
    });

    // Ground truth (superuser): the stored body is an envelope, not the plaintext.
    const stored = await tp.query<{ body: string }>(
      `SELECT body FROM secret_doc WHERE id = $1`,
      ["d1"],
    );
    expect(stored[0]!.body).not.toBe("A-secret");
    expect(parseEnvelope(stored[0]!.body).keyVersion).toBe(1);

    // Storage boundary: tenant B cannot SEE A's row (RLS).
    const seenByB = await withTenant(tp.pg, B, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM secret_doc WHERE id = $1`, [
        "d1",
      ]),
    );
    expect(seenByB.rows.length).toBe(0);

    // ...and A can.
    const seenByA = await withTenant(tp.pg, A, (tx) =>
      tx.query<{ id: string }>(`SELECT id FROM secret_doc WHERE id = $1`, [
        "d1",
      ]),
    );
    expect(seenByA.rows.length).toBe(1);

    // Crypto boundary: even given A's ciphertext, B's derived key cannot decrypt it.
    const aBody = stored[0]!.body;
    await expect(crypto.decryptField(B, aBody, COL)).rejects.toThrow();
    expect(await crypto.decryptField(A, aBody, COL)).toBe("A-secret");
  });

  test("a v1 ciphertext still decrypts after the tenant rotates to v2", async () => {
    const provider = new DerivedKeyProvider(MASTER, SALT);
    const crypto = new TenantFieldCrypto(provider);

    const v1 = await crypto.encryptField(A, "old", COL);
    expect(parseEnvelope(v1).keyVersion).toBe(1);

    provider.registry.rotate(A); // → v2
    expect(await crypto.decryptField(A, v1, COL)).toBe("old"); // old still decrypts

    const v2 = await crypto.encryptField(A, "new", COL);
    expect(parseEnvelope(v2).keyVersion).toBe(2); // new write uses the rotated version
  });
});
