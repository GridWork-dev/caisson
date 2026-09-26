// ADR-0162 — the tenant BYOK key store on PGlite + real withTenant RLS + field-crypto. Asserts:
// a key round-trips (sealed on write, opened on read); a re-put REPLACES (rotatable credential); a
// missing key reads undefined; RLS isolates accounts (tenant A cannot read tenant B's key); the
// ciphertext at rest is NOT the plaintext (encrypted-at-rest).
import {
  beforeAll,
  afterAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { type TestPg, newTestPg } from "@caisson-sh/testing";
import { withTenant } from "@caisson-sh/tenancy-rls";
import {
  DerivedKeyProvider,
  derivedContext,
  type FieldCryptoContext,
} from "@caisson-sh/field-crypto";
import {
  TENANT_AI_CREDENTIAL_SCHEMA_SQL,
  getTenantProviderKey,
  putTenantProviderKey,
} from "./byok-store.ts";

// A per-deployment master key + salt (32 bytes each); non-secret salt (ADR-0043).
const MASTER = Buffer.alloc(32, 7);
const SALT = Buffer.alloc(32, 9);
const provider = new DerivedKeyProvider(MASTER, SALT);
const ctxFor = (accountId: string): FieldCryptoContext =>
  derivedContext(provider, accountId);

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(TENANT_AI_CREDENTIAL_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

describe("tenant_ai_credential (ADR-0162, RLS + field-crypto)", () => {
  test("a key round-trips: sealed on write, opened on read", async () => {
    const acct = "acct_byok_rt";
    await withTenant(tp.pg, acct, (tx) =>
      putTenantProviderKey(tx, ctxFor(acct), "openai", "sk-secret-123"),
    );
    const got = await withTenant(tp.pg, acct, (tx) =>
      getTenantProviderKey(tx, ctxFor(acct), "openai"),
    );
    expect(got).toBe("sk-secret-123");
  });

  test("a re-put REPLACES the stored key (rotatable credential)", async () => {
    const acct = "acct_byok_rotate";
    await withTenant(tp.pg, acct, (tx) =>
      putTenantProviderKey(tx, ctxFor(acct), "openai", "sk-old"),
    );
    await withTenant(tp.pg, acct, (tx) =>
      putTenantProviderKey(tx, ctxFor(acct), "openai", "sk-new"),
    );
    const got = await withTenant(tp.pg, acct, (tx) =>
      getTenantProviderKey(tx, ctxFor(acct), "openai"),
    );
    expect(got).toBe("sk-new");
    // Exactly one row per (account, provider) — the UNIQUE + upsert, not an append.
    const rows = await withTenant(tp.pg, acct, (tx) =>
      tx.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM tenant_ai_credential WHERE account_id = $1 AND provider = $2`,
        [acct, "openai"],
      ),
    );
    expect(rows.rows[0]?.n).toBe("1");
  });

  test("a missing key reads undefined", async () => {
    const acct = "acct_byok_missing";
    const got = await withTenant(tp.pg, acct, (tx) =>
      getTenantProviderKey(tx, ctxFor(acct), "anthropic"),
    );
    expect(got).toBeUndefined();
  });

  test("RLS isolates accounts — tenant B cannot read tenant A's key", async () => {
    const a = "acct_byok_a";
    const b = "acct_byok_b";
    await withTenant(tp.pg, a, (tx) =>
      putTenantProviderKey(tx, ctxFor(a), "openai", "sk-a-only"),
    );
    // B, scoped to its own tenant, sees nothing for the same provider.
    const bSees = await withTenant(tp.pg, b, (tx) =>
      getTenantProviderKey(tx, ctxFor(b), "openai"),
    );
    expect(bSees).toBeUndefined();
  });

  test("the ciphertext at rest is not the plaintext (encrypted-at-rest)", async () => {
    const acct = "acct_byok_atrest";
    await withTenant(tp.pg, acct, (tx) =>
      putTenantProviderKey(tx, ctxFor(acct), "openai", "sk-plainsecret"),
    );
    const raw = await withTenant(tp.pg, acct, (tx) =>
      tx.query<{ ciphertext: string }>(
        `SELECT ciphertext FROM tenant_ai_credential WHERE account_id = $1 AND provider = $2`,
        [acct, "openai"],
      ),
    );
    const stored = raw.rows[0]?.ciphertext ?? "";
    expect(stored.length).toBeGreaterThan(0);
    expect(stored).not.toContain("sk-plainsecret");
  });
});
