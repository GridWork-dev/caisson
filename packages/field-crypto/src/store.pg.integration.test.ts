// Integration proof for the DB-backed, append-only key-version + wrapped-DEK stores (ADR-0055/0043/
// 0014). Runs the REAL `0001_field_keys.sql` migration + the REAL `withTenant` against PGlite (a true
// Postgres with FORCE RLS, SET ROLE, bytea, plpgsql triggers). No network, no live cloud/KMS — the
// KMS itself is the local wrap double. Proves: a current version + wrapped DEK persist across
// transactions; a field encrypted under an OLD version still decrypts after rotation (lazy
// re-encrypt); a minted DEK is immutable (different-bytes re-put → ConflictError, UPDATE/DELETE
// refused as `app` and by the belt trigger as superuser); and one tenant never sees another's keys.
//
// `withTenant` appears ONLY in this test — the runtime store is kernel-only (ADR-0043/0003) and takes
// a pre-tenant-scoped executor.
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
import { buildTenantPolicySql, withTenant } from "@caisson-sh/tenancy-rls";
import { ConflictError, ValidationError } from "@caisson-sh/kernel";
import { PgKeyVersionStore, PgWrappedKeyStore } from "./store.pg.ts";
import { KmsKeyProvider, LocalKmsClient } from "./kms.ts";
import { TenantFieldCrypto } from "./crypto.ts";
import { parseEnvelope } from "./envelope.ts";

const COL = "patient.ssn";
let tp: TestPg;
let migrationSql: string;

beforeAll(async () => {
  // Concatenate BOTH migration files: 0002 DROP+CREATEs both tenant-isolation policies with the
  // pgbouncer/pooler NULLIF hardening (ADR-0006 append-only — 0001 already shipped, so the
  // hardening is a follow-up migration, never an edit to 0001). The drift-guard below checks the
  // EFFECTIVE (post-0002) policy against buildTenantPolicySql's current output.
  const m1 = await Bun.file(
    new URL("./migrations/0001_field_keys.sql", import.meta.url),
  ).text();
  const m2 = await Bun.file(
    new URL("./migrations/0002_field_keys_rls_nullif.sql", import.meta.url),
  ).text();
  migrationSql = m1 + m2;
  tp = await newTestPg();
  await tp.exec(m1);
  await tp.exec(m2);
});

afterAll(async () => {
  await tp.close();
});

describe("PgKeyVersionStore — append-only current version (derived-key path)", () => {
  test("get is undefined until set; then tracks the greatest recorded version", async () => {
    const acct = randomUUID();
    await withTenant(tp.pg, acct, async (tx) => {
      const s = new PgKeyVersionStore(tx);
      expect(await s.get(acct)).toBeUndefined();
      await s.set(acct, 1);
      expect(await s.get(acct)).toBe(1);
      await s.set(acct, 2);
      expect(await s.get(acct)).toBe(2);
      // Recording an existing version is idempotent (ON CONFLICT DO NOTHING) — tx stays usable.
      await s.set(acct, 2);
      expect(await s.get(acct)).toBe(2);
    });
  });

  test("a recorded version persists across transactions (true DB-backing)", async () => {
    const acct = randomUUID();
    await withTenant(tp.pg, acct, (tx) =>
      new PgKeyVersionStore(tx).set(acct, 7),
    );
    const seen = await withTenant(tp.pg, acct, (tx) =>
      new PgKeyVersionStore(tx).get(acct),
    );
    expect(seen).toBe(7);
  });

  test("a key version outside the uint16 envelope bound is rejected", async () => {
    const acct = randomUUID();
    await withTenant(tp.pg, acct, async (tx) => {
      const s = new PgKeyVersionStore(tx);
      await expect(s.set(acct, 0)).rejects.toBeInstanceOf(ValidationError);
      await expect(s.set(acct, 70000)).rejects.toBeInstanceOf(ValidationError);
    });
  });
});

describe("PgWrappedKeyStore + KmsKeyProvider — old versions stay decryptable", () => {
  test("a first-provision CAS loser adopts the durable version-1 winner and keeps the transaction usable", async () => {
    const acct = randomUUID();
    const master = Buffer.alloc(32, 0x45);
    const winnerKms = new LocalKmsClient(master);
    const winner = await winnerKms.generateDataKey(acct);

    await withTenant(tp.pg, acct, async (tx) => {
      const store = new PgWrappedKeyStore(tx);
      // Commit-equivalent winner state. The wrapper below models READ COMMITTED visibility: the
      // loser's first version read happened before this winner committed, while the SQL CAS and
      // required re-read happen after it became visible. PGlite has one connection, so it cannot
      // run two simultaneous transactions; the real ON CONFLICT loser path still executes here.
      expect(await store.putWrappedIfAbsent(acct, 1, winner.wrappedKey)).toBe(
        true,
      );
      await store.setCurrentVersion(acct, 1);

      let currentReads = 0;
      const staleFirstReadStore = {
        getWrapped: store.getWrapped.bind(store),
        putWrappedIfAbsent: store.putWrappedIfAbsent.bind(store),
        putWrapped: store.putWrapped.bind(store),
        async currentVersion(tenantId: string) {
          currentReads += 1;
          return currentReads === 1
            ? undefined
            : store.currentVersion(tenantId);
        },
        setCurrentVersion: store.setCurrentVersion.bind(store),
      };
      const loser = new KmsKeyProvider(
        new LocalKmsClient(master),
        staleFirstReadStore,
      );
      expect(await loser.ensureProvisioned(acct)).toBe(1);
      expect(currentReads).toBe(2);
      expect(await store.currentVersion(acct)).toBe(1);
      expect((await loser.keyFor(acct, 1)).equals(winner.plaintextKey)).toBe(
        true,
      );
      await expect(tx.query("SELECT 1")).resolves.toBeDefined();
    });

    winner.plaintextKey.fill(0);
    const rows = await tp.query<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM field_wrapped_dek
        WHERE account_id = $1 AND key_version = 1`,
      [acct],
    );
    expect(rows[0]?.count).toBe(1);
  });

  test("a SEC/HIPAA field round-trips, and a v1 ciphertext still decrypts after rotation to v2", async () => {
    const acct = randomUUID();
    const kms = new LocalKmsClient(Buffer.alloc(32, 0x33));

    // Tx 1: provision v1, encrypt a field under it. The wrapped DEK commits to the DB.
    const env1 = await withTenant(tp.pg, acct, async (tx) => {
      const provider = new KmsKeyProvider(kms, new PgWrappedKeyStore(tx));
      expect(await provider.provision(acct)).toBe(1);
      return new TenantFieldCrypto(provider).encryptField(
        acct,
        "078-05-1120",
        COL,
      );
    });
    expect(parseEnvelope(env1).keyVersion).toBe(1);

    // Tx 2: a FRESH provider reads the committed current version, rotates to v2, encrypts anew.
    const env2 = await withTenant(tp.pg, acct, async (tx) => {
      const provider = new KmsKeyProvider(kms, new PgWrappedKeyStore(tx));
      expect(await provider.provision(acct)).toBe(2); // read committed v1 → next is 2
      return new TenantFieldCrypto(provider).encryptField(
        acct,
        "1985-04-12",
        COL,
      );
    });
    expect(parseEnvelope(env2).keyVersion).toBe(2);

    // Tx 3: a FRESH provider decrypts BOTH — the v1 wrapped DEK is still stored, so the pre-rotation
    // ciphertext authenticates (lazy re-encrypt: old versions are never destroyed by a rotation).
    await withTenant(tp.pg, acct, async (tx) => {
      const store = new PgWrappedKeyStore(tx);
      const tfc = new TenantFieldCrypto(new KmsKeyProvider(kms, store));
      expect(await tfc.decryptField(acct, env1, COL)).toBe("078-05-1120");
      expect(await tfc.decryptField(acct, env2, COL)).toBe("1985-04-12");
      expect(await store.currentVersion(acct)).toBe(2);
      expect(await store.getWrapped(acct, 99)).toBeUndefined();
    });
  });

  test("a minted wrapped DEK is immutable: identical re-put is a no-op, different bytes conflict", async () => {
    const acct = randomUUID();
    const original = Buffer.alloc(48, 0xa1);
    await withTenant(tp.pg, acct, async (tx) => {
      const s = new PgWrappedKeyStore(tx);
      await s.putWrapped(acct, 5, original);
      // Idempotent: same version, same bytes → no-op, transaction stays usable.
      await s.putWrapped(acct, 5, Buffer.from(original));
      // Different bytes for the same version → refused before any write (never overwrite key material).
      await expect(
        s.putWrapped(acct, 5, Buffer.alloc(48, 0xff)),
      ).rejects.toBeInstanceOf(ConflictError);
      // The original bytes survive untouched.
      const got = await s.getWrapped(acct, 5);
      expect(got !== undefined && got.equals(original)).toBe(true);
    });
  });
});

describe("immutability — append-only by withheld GRANT + belt trigger (TM-D)", () => {
  test("the app role may append but is DENIED UPDATE and DELETE on both tables", async () => {
    const acct = randomUUID();
    await withTenant(tp.pg, acct, async (tx) => {
      await new PgWrappedKeyStore(tx).putWrapped(
        acct,
        1,
        Buffer.alloc(40, 0x07),
      );
    });
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(
          `UPDATE field_wrapped_dek SET wrapped = $1 WHERE account_id = $2`,
          [Buffer.alloc(40, 0x00), acct],
        ),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(`DELETE FROM field_wrapped_dek WHERE account_id = $1`, [acct]),
      ),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tp.asTenant(acct, (tx) =>
        tx.query(`DELETE FROM field_key_version WHERE account_id = $1`, [acct]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  test("even the superuser cannot UPDATE or DELETE — the belt trigger RAISEs", async () => {
    const acct = randomUUID();
    await withTenant(tp.pg, acct, async (tx) => {
      const s = new PgWrappedKeyStore(tx);
      await s.putWrapped(acct, 1, Buffer.alloc(40, 0x08));
      await s.setCurrentVersion(acct, 1); // a field_key_version row to attempt to mutate
    });
    await expect(
      tp.query(
        `UPDATE field_wrapped_dek SET wrapped = $1 WHERE account_id = $2`,
        [Buffer.alloc(40, 0x00), acct],
      ),
    ).rejects.toThrow(/append-only/i);
    await expect(
      tp.query(`DELETE FROM field_wrapped_dek WHERE account_id = $1`, [acct]),
    ).rejects.toThrow(/append-only/i);
    await expect(
      tp.query(
        `UPDATE field_key_version SET key_version = 9 WHERE account_id = $1`,
        [acct],
      ),
    ).rejects.toThrow(/append-only/i);
  });
});

describe("tenant isolation (ADR-0005, fail-closed)", () => {
  test("one tenant's wrapped DEK + version never bleed into another", async () => {
    const a = randomUUID();
    const b = randomUUID();
    const aWrapped = Buffer.alloc(44, 0xaa);
    await withTenant(tp.pg, a, async (tx) => {
      const s = new PgWrappedKeyStore(tx);
      await s.putWrapped(a, 1, aWrapped);
      await s.setCurrentVersion(a, 1);
    });

    // Tenant B, under its own RLS scope, sees none of A's keys.
    await withTenant(tp.pg, b, async (tx) => {
      const s = new PgWrappedKeyStore(tx);
      expect(await s.getWrapped(a, 1)).toBeUndefined();
      expect(await s.currentVersion(a)).toBeUndefined();
    });

    // ...and A still sees its own.
    await withTenant(tp.pg, a, async (tx) => {
      const s = new PgWrappedKeyStore(tx);
      const got = await s.getWrapped(a, 1);
      expect(got !== undefined && got.equals(aWrapped)).toBe(true);
      expect(await s.currentVersion(a)).toBe(1);
    });
  });
});

describe("migration shape (append-only by withheld GRANT + belt trigger)", () => {
  for (const table of ["field_key_version", "field_wrapped_dek"]) {
    test(`${table} RLS mirrors buildTenantPolicySql but withholds + REVOKEs UPDATE/DELETE`, () => {
      // Every ENABLE/FORCE/POLICY line from the canonical builder is present verbatim (drift guard)…
      for (const line of buildTenantPolicySql(table).split("\n")) {
        if (line.startsWith("GRANT ")) continue; // …except the grant, which we narrow.
        expect(migrationSql).toContain(line);
      }
      expect(migrationSql).toContain(
        `GRANT SELECT, INSERT ON ${table} TO app;`,
      );
      expect(migrationSql).toContain(
        `REVOKE UPDATE, DELETE ON ${table} FROM app;`,
      );
      expect(migrationSql).not.toMatch(
        new RegExp(`GRANT[^;]*\\b(?:UPDATE|DELETE)\\b[^;]*ON ${table}`, "i"),
      );
    });

    test(`${table} has a belt trigger for both UPDATE and DELETE`, () => {
      expect(migrationSql).toMatch(
        new RegExp(`BEFORE UPDATE ON ${table}`, "i"),
      );
      expect(migrationSql).toMatch(
        new RegExp(`BEFORE DELETE ON ${table}`, "i"),
      );
    });
  }
});
