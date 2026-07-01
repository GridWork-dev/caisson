// BYOK buyer edge (ADR-0183 / ADR-0182). The tenant-facing seam over the server-side BYOK store
// (@caisson/ai-kit, ADR-0162): a buyer submits/rotates their OWN provider key, we VALIDATE it live
// before persist, encrypt-on-write via `putTenantProviderKey`, and NEVER read the key back.
//
// WRITE-ONLY (ADR-0183): the plaintext key is sealed into `tenant_ai_credential` (field-crypto, FORCE
// RLS) and immediately dropped. The only thing this app can render afterwards is metadata — provider,
// key version, masked last-4, timestamps — stored in a SEPARATE app-owned `byok_key_meta` table that
// holds NO secret. The key is never logged, never echoed in an error, never selected back.
//
// FREE (ADR-0182): a BYOK lane debits $0 Caisson credits — the buyer pays their provider directly.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fetchWithTimeout } from "@caisson/kernel";
import {
  DerivedKeyProvider,
  derivedContext,
  type SyncFieldKeyProvider,
} from "@caisson/field-crypto";
import { putTenantProviderKey } from "@caisson/ai-kit";
import { getDb, withTenant } from "./db.ts";
import { BYOK_PROVIDERS, type ByokProvider } from "./byok-providers.ts";

// Re-export so existing server-side importers of ./byok keep working.
export { BYOK_PROVIDERS, type ByokProvider };

/** The `POST /api/byok` body — Zod `.strict()` at the trust boundary (rejects unknown fields). */
export const ByokSubmitBody = z
  .object({
    provider: z.enum(BYOK_PROVIDERS),
    // Bounded; never logged. Provider keys are well under 500 chars.
    apiKey: z.string().trim().min(8).max(500),
  })
  .strict();
export type ByokSubmitBody = z.infer<typeof ByokSubmitBody>;

/** Displayable key metadata (NO secret). This is the only shape the read-back path ever returns. */
export interface ByokKeyStatus {
  readonly provider: ByokProvider;
  /** Masked tail, e.g. `••••abcd` — the only fragment of the key ever surfaced. */
  readonly maskedLast4: string;
  readonly keyVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Mask a key to a `••••<last4>` display string. Pure; the input is never persisted or logged. */
export function maskLast4(apiKey: string): string {
  const tail = apiKey.slice(-4);
  return `••••${tail}`;
}

// --- validate-on-submit (a live, minimal-scope provider call BEFORE persist, ADR-0183) -----------

interface ProviderProbe {
  /** A cheap authenticated GET that a valid key returns 2xx for (models-list / key-info). */
  readonly url: string;
  readonly headers: (apiKey: string) => Record<string, string>;
}

// Minimal-scope, read-only probes. The key ALWAYS rides in a header, never the URL — query-string
// secrets leak into infra/proxy/provider access logs (security floor). This module never logs the
// URL or the headers.
const PROVIDER_PROBES: Record<ByokProvider, ProviderProbe> = {
  openai: {
    url: "https://api.openai.com/v1/models",
    headers: (k) => ({ authorization: `Bearer ${k}` }),
  },
  anthropic: {
    url: "https://api.anthropic.com/v1/models",
    headers: (k) => ({ "x-api-key": k, "anthropic-version": "2023-06-01" }),
  },
  google: {
    // Gemini accepts the key as `x-goog-api-key` — keep it out of the URL. Bounded read-only list call.
    url: "https://generativelanguage.googleapis.com/v1beta/models",
    headers: (k) => ({ "x-goog-api-key": k }),
  },
  openrouter: {
    // `/key` echoes the key's own metadata — the cheapest authenticated probe.
    url: "https://openrouter.ai/api/v1/key",
    headers: (k) => ({ authorization: `Bearer ${k}` }),
  },
};

export type ValidationResult =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

/**
 * Fire ONE minimal-scope live call to confirm the key works before we persist it (ADR-0183). Never
 * activates a dead key. The plaintext key is used only to build the request — it is NEVER included in
 * the returned reason (no secret in an error surface, security floor).
 */
export async function validateProviderKey(
  provider: ByokProvider,
  apiKey: string,
): Promise<ValidationResult> {
  const probe = PROVIDER_PROBES[provider];
  try {
    const res = await fetchWithTimeout(
      probe.url,
      { method: "GET", headers: probe.headers(apiKey) },
      { timeoutMs: 8_000 },
    );
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: `${provider} rejected the key (unauthorized).`,
      };
    }
    return {
      ok: false,
      reason: `Could not validate the key — ${provider} returned status ${String(res.status)}.`,
    };
  } catch {
    // AbortError (timeout) or network failure. Never surface the underlying error object (could echo
    // the request, which carries the key) — a fixed, key-free message only.
    return {
      ok: false,
      reason: `Could not reach ${provider} to validate the key. Try again.`,
    };
  }
}

// --- field-crypto provider (env master secret, or a labelled dev vector) -------------------------

interface ByokGlobal {
  caissonByokKeyProvider?: SyncFieldKeyProvider;
}
const g = globalThis as unknown as ByokGlobal;

/**
 * The field-crypto key provider backing the encrypted BYOK store. Prefers the real per-deployment
 * master secret (`MASTER_FIELD_KEY` / `FIELD_CRYPTO_SALT`); otherwise a labelled, deterministic DEMO
 * vector (NOT a production secret) so `bun dev` / `bun test` run zero-config — mirrors
 * `apps/local-ai`'s `demoProvider`. HMR-safe singleton (Next re-evaluates the module on every edit).
 */
export function getFieldKeyProvider(): SyncFieldKeyProvider {
  if (g.caissonByokKeyProvider) return g.caissonByokKeyProvider;
  const hasEnv =
    process.env.MASTER_FIELD_KEY !== undefined &&
    process.env.FIELD_CRYPTO_SALT !== undefined;
  if (!hasEnv && process.env.NODE_ENV === "production") {
    // Fail closed: never seal real tenant BYOK secrets under the public demo vector in production
    // (security floor — no constant/hardcoded key material). A deployment MUST set both.
    throw new Error(
      "BYOK field-crypto is not configured: set MASTER_FIELD_KEY and FIELD_CRYPTO_SALT.",
    );
  }
  // ponytail: dev/test fallback is a fixed reference vector, clearly not a real secret — a real
  // deployment always sets MASTER_FIELD_KEY/FIELD_CRYPTO_SALT (same posture as local-ai).
  g.caissonByokKeyProvider = hasEnv
    ? DerivedKeyProvider.fromEnv(process.env)
    : new DerivedKeyProvider(Buffer.alloc(32, 0xa1), Buffer.alloc(32, 0xb2));
  return g.caissonByokKeyProvider;
}

// --- write (validate → encrypt-on-write → upsert display metadata, ALL in one tenant transaction) -

export type SubmitResult =
  | { readonly ok: true; readonly status: ByokKeyStatus }
  | { readonly ok: false; readonly reason: string };

/**
 * Validate a key live, then atomically store it. Rotation = the same path (UPSERT). Both the encrypted
 * key (`putTenantProviderKey`) and the display metadata (`byok_key_meta`) are written inside ONE
 * `withTenant` transaction, so a replacement is all-or-nothing (atomic rotation, ADR-0183). The key is
 * dropped the instant this returns; only the masked tail survives.
 */
export async function submitTenantKey(
  accountId: string,
  provider: ByokProvider,
  apiKey: string,
): Promise<SubmitResult> {
  const validation = await validateProviderKey(provider, apiKey);
  if (!validation.ok) return { ok: false, reason: validation.reason };

  const keyProvider = getFieldKeyProvider();
  const ctx = derivedContext(keyProvider, accountId);
  const keyVersion = ctx.currentVersion();
  const last4 = maskLast4(apiKey);
  const db = await getDb();

  // The store + meta write share ONE tenant-scoped transaction (withTenant = BEGIN..COMMIT), so a
  // rotation is all-or-nothing. `putTenantProviderKey` seals + upserts the key; the meta row carries
  // NO secret (masked tail + version only).
  await withTenant(db, accountId, async (tx) => {
    await putTenantProviderKey(tx, ctx, provider, apiKey);
    await tx.query(
      `INSERT INTO byok_key_meta (id, account_id, provider, last4, key_version, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (account_id, provider)
       DO UPDATE SET last4 = EXCLUDED.last4, key_version = EXCLUDED.key_version, updated_at = now()`,
      [randomUUID(), accountId, provider, last4, keyVersion],
    );
  });

  return {
    ok: true,
    status: {
      provider,
      maskedLast4: last4,
      keyVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Read the tenant's stored-key METADATA (never the key). RLS scopes the read to the caller's account.
 * This is what the dashboard renders — the plaintext is irretrievable post-save (write-only, ADR-0183).
 */
export async function readKeyStatuses(
  accountId: string,
): Promise<ByokKeyStatus[]> {
  const db = await getDb();
  return withTenant(db, accountId, async (tx) => {
    const res = await tx.query<{
      provider: string;
      last4: string;
      key_version: number;
      created_at: string | Date;
      updated_at: string | Date;
    }>(
      `SELECT provider, last4, key_version, created_at, updated_at
       FROM byok_key_meta ORDER BY provider ASC`,
    );
    return res.rows.map((r) => ({
      provider: r.provider as ByokProvider,
      maskedLast4: r.last4,
      keyVersion: r.key_version,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  });
}
