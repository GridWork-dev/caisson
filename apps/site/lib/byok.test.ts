// BYOK edge unit + round-trip checks (ADR-0183/0182). Covers the security-sensitive bits: the strict
// boundary, live-validation branching (no key in the error), masking, and the write-only round-trip
// (submit -> masked metadata reads back; the plaintext is decryptable from the ENCRYPTED store but is
// never surfaced by the read-back path). Uses the in-memory PGlite double (DATABASE_URL unset).
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { getTenantProviderKey } from "@caisson/ai-kit";
import { derivedContext } from "@caisson/field-crypto";
import { withTenant, getDb } from "./db.ts";
import {
  ByokSubmitBody,
  getDevFieldKeyProvider,
  maskLast4,
  readKeyStatuses,
  submitTenantKey,
  validateProviderKey,
} from "./byok.ts";

// Force the hermetic in-memory PGlite double (same pattern as auth-account.test.ts) and rebuild the
// memoized transactor, so the round-trip never touches a real Postgres.
beforeAll(() => {
  delete process.env.DATABASE_URL;
  const g = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: unknown;
  };
  g.caissonTransactor = undefined;
  g.caissonPglite = undefined;
});

afterAll(async () => {
  const g = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: { close(): Promise<void> };
  };
  await g.caissonPglite?.close();
  g.caissonTransactor = undefined;
  g.caissonPglite = undefined;
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(status: number): void {
  globalThis.fetch = (async () =>
    new Response(status === 200 ? "{}" : "err", {
      status,
    })) as unknown as typeof fetch;
}

test("maskLast4 reveals only the last 4 chars", () => {
  expect(maskLast4("sk-supersecret-abcd")).toBe("••••abcd");
});

test("ByokSubmitBody rejects unknown fields and short keys, accepts a valid body", () => {
  expect(
    ByokSubmitBody.safeParse({ provider: "openai", apiKey: "sk-abcdefgh" })
      .success,
  ).toBe(true);
  expect(
    ByokSubmitBody.safeParse({ provider: "openai", apiKey: "short" }).success,
  ).toBe(false);
  expect(
    ByokSubmitBody.safeParse({ provider: "nope", apiKey: "sk-abcdefgh" })
      .success,
  ).toBe(false);
  expect(
    ByokSubmitBody.safeParse({
      provider: "openai",
      apiKey: "sk-abcdefgh",
      extra: 1,
    }).success,
  ).toBe(false);
});

test("validateProviderKey: 200 ok; 401 rejects; neither leaks the key", async () => {
  stubFetch(200);
  expect(await validateProviderKey("openai", "sk-leakme-1234")).toEqual({
    ok: true,
  });

  stubFetch(401);
  const bad = await validateProviderKey("openai", "sk-leakme-1234");
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(bad.reason.includes("sk-leakme-1234")).toBe(false);
});

test("the google probe carries the key in x-goog-api-key, never in the URL", async () => {
  let seenUrl = "";
  let seenHeaders: Record<string, string> = {};
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seenUrl = String(url);
    seenHeaders = (init.headers ?? {}) as Record<string, string>;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const key = "AIza-secret-xyz-1234";
  expect(await validateProviderKey("google", key)).toEqual({ ok: true });
  // Query-string secrets leak into infra/proxy/provider logs — the key must NOT be in the URL.
  expect(seenUrl.includes(key)).toBe(false);
  expect(seenUrl.includes("key=")).toBe(false);
  expect(seenHeaders["x-goog-api-key"]).toBe(key);
});

test("the derived BYOK provider is unreachable in production", () => {
  const g = globalThis as unknown as { caissonByokDevKeyProvider?: unknown };
  const env = process.env as Record<string, string | undefined>; // NODE_ENV is typed read-only
  const previousNodeEnv = env.NODE_ENV;
  try {
    g.caissonByokDevKeyProvider = undefined;
    env.NODE_ENV = "production";
    expect(() => getDevFieldKeyProvider()).toThrow(/disabled in production/);
  } finally {
    g.caissonByokDevKeyProvider = undefined;
    env.NODE_ENV = previousNodeEnv;
  }
});

test("production submission fails closed on missing KMS config without a demo fallback", async () => {
  stubFetch(200);
  const g = globalThis as unknown as {
    caissonSiteAzureKmsClient?: unknown;
  };
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;
  const previousVaultUrl = env.AZURE_KEY_VAULT_URL;
  try {
    g.caissonSiteAzureKmsClient = undefined;
    env.NODE_ENV = "production";
    delete env.AZURE_KEY_VAULT_URL;
    await expect(
      submitTenantKey("acct-kms-unconfigured", "openai", "sk-no-fallback-1234"),
    ).rejects.toThrow(/Azure Key Vault/);
  } finally {
    g.caissonSiteAzureKmsClient = undefined;
    env.NODE_ENV = previousNodeEnv;
    if (previousVaultUrl === undefined) delete env.AZURE_KEY_VAULT_URL;
    else env.AZURE_KEY_VAULT_URL = previousVaultUrl;
  }
});

test("submit -> encrypted store round-trip; read-back is masked metadata only", async () => {
  stubFetch(200);
  const account = "acct-byok-1";
  const key = "sk-round-trip-9876";

  const res = await submitTenantKey(account, "openai", key);
  expect(res.ok).toBe(true);
  if (res.ok) expect(res.status.maskedLast4).toBe("••••9876");

  // Read-back path never returns the key — only masked metadata.
  const statuses = await readKeyStatuses(account);
  expect(statuses).toHaveLength(1);
  expect(statuses[0]?.provider).toBe("openai");
  expect(statuses[0]?.maskedLast4).toBe("••••9876");
  expect(JSON.stringify(statuses).includes(key)).toBe(false);

  // The plaintext IS recoverable from the ENCRYPTED store (proves encrypt-on-write persisted it),
  // but only via the decrypting store call — never the buyer-facing read path.
  const db = await getDb();
  const ctx = derivedContext(getDevFieldKeyProvider(), account);
  const decrypted = await withTenant(db, account, (tx) =>
    getTenantProviderKey(tx, ctx, "openai"),
  );
  expect(decrypted).toBe(key);

  // Rotation: a second submit UPSERTs (still one row, new tail).
  const rotated = await submitTenantKey(account, "openai", "sk-rotated-0000");
  expect(rotated.ok).toBe(true);
  const after = await readKeyStatuses(account);
  expect(after).toHaveLength(1);
  expect(after[0]?.maskedLast4).toBe("••••0000");
});
