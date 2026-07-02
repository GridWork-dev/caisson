// src/app.ts — the license-ISSUER HTTP router (ADR-0110, implements ADR-0010). A pure
// `Request → Response` function over injected deps (token, signer, registry index, tenant Transactor)
// so it is testable without a live socket. Issuance is LAZY + bearer-gated: POST /issue mints a signed
// license for an account by resolving its server-side entitlements (the EXISTING `resolveAccountEntitlements`
// inside `withTenant`, RLS-scoped) and signing them via `@caisson/license-issue`. POST /issue is
// IDEMPOTENT per (accountId, major) ("persist & reuse"): the first call mints, signs, and persists the
// token via `license-grant-store.ts`; every later call for the same (accountId, major) re-serves the
// STORED token byte-identical — never re-mints, never proliferates fresh perpetual tokens for one
// purchase. A different major always mints its own grant. POST /webhook is the Paddle Merchant-of-Record
// destination (license.caisson.sh/webhook, ADR-0108/0116): it verifies the `Paddle-Signature` HMAC over
// the RAW body (timing-safe, fail-closed) and provisions a verified purchase by running BOTH the credit
// grant AND the entitlement grant in ONE tenant transaction. /health is public (like services/docs). Every
// response carries the gridwork security-floor headers (nosniff / frame-deny / HSTS). The Bearer gate is
// timing-safe over the VARIABLE-LENGTH token (SHA-256 → `timingSafeEqual`, the security-floor rule) and
// fail-closed when the token is unset. Server-to-server contract — no CORS.
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BillingProvider } from "@caisson/billing";
import { AuthnError } from "@caisson/kernel";
import { issueLicense, type Signer } from "@caisson/license-issue";
import { licenseTierSchema } from "@caisson/license-verify";
import { withRequestSpan } from "@caisson/observability";
import type { RegistryIndex } from "@caisson/registry-schema";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import type { DiscordGrantPush } from "./discord-notify.ts";
import { readLicenseGrant, storeLicenseGrant } from "./license-grant-store.ts";
import { clientIp, type RateBucket, type RateLimiter } from "./rate-limit.ts";
import { resolveAccountEntitlements } from "./resolve-entitlements.ts";
import { type BillingWebhookResult, handleBillingWebhook } from "./webhook.ts";

export interface IssueAppDeps {
  /** Bearer secret for POST /issue. Must be non-empty — server.ts fails closed if it is unset. */
  token: string;
  /** The signing identity (default Ed25519Signer over a PKCS8 env key; KMS is an un-wired seam). */
  signer: Signer;
  /** The built registry index — membership truth for entitlement expansion (ADR-0071). */
  index: RegistryIndex;
  /** The tenant Transactor — `resolveAccountEntitlements` runs inside `withTenant` over it (RLS). */
  db: Transactor;
  /**
   * The Paddle Merchant-of-Record billing provider (verify + parse, ADR-0108/0116). `null` when
   * `PADDLE_WEBHOOK_SECRET` is unset — POST /webhook then fails closed (401): an unverifiable payload
   * must NEVER provision. server.ts builds it from env and injects it.
   */
  provider: BillingProvider | null;
  /**
   * Per-IP token-bucket limiter (services-hardening #4). Gates POST /webhook (the public grey-origin MoR
   * surface) and POST /issue (defense-in-depth before the bearer check). The bearer / HMAC stay the
   * primary auth — this only caps an abusive flood. server.ts injects it.
   */
  limiter: RateLimiter;
  /**
   * The post-grant Discord role push (ADR-0203). `null` when SUPPORT_BOT_URL /
   * SUPPORT_BOT_GRANT_TOKEN are unset — the push is simply skipped. Fired DETACHED after the grant
   * commits; it must never delay or fail the webhook response (the injected implementation —
   * `notifyDiscordGrant` — never throws).
   */
  discordNotify: ((push: DiscordGrantPush) => Promise<void>) | null;
}

/**
 * POST /issue body. `.strict()` rejects unknown fields; the account id + version are bounded. The
 * tier is the SHARED `licenseTierSchema` (never re-declared). `entitlements` are NOT taken from the
 * caller — they are resolved server-side from the account's purchases (ADR-0071), so a caller cannot
 * mint itself entitlements it did not buy. `expiry` is an ISO-8601 instant or `null` (perpetual-per-major).
 *
 * TRUST ASSUMPTION (`tier`): unlike `entitlements`, `tier` is asserted by the caller. This is a
 * server-to-server, bearer-gated endpoint whose sole caller is the billing service, which derives the
 * tier from the same account-entitlement store. The bearer token (`LICENSE_ISSUE_TOKEN`) is the trust
 * boundary; there is no independent purchase→tier check here by design — downstream feature access gates
 * on the server-resolved `entitlements` list, not the `tier` label.
 */
const IssueBody = z
  .object({
    accountId: z.string().trim().min(1).max(256),
    tier: licenseTierSchema,
    major: z.number().int().nonnegative(),
    expiry: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

function respond(
  body: string,
  status: number,
  contentType: string,
  extra?: Record<string, string>,
): Response {
  return new Response(body, {
    status,
    headers: { ...SECURITY_HEADERS, "Content-Type": contentType, ...extra },
  });
}

const json = (data: unknown, status = 200): Response =>
  respond(JSON.stringify(data), status, "application/json; charset=utf-8");
const text = (
  body: string,
  status = 200,
  extra?: Record<string, string>,
): Response => respond(body, status, "text/plain; charset=utf-8", extra);

/**
 * Timing-safe Bearer check. `LICENSE_ISSUE_TOKEN` is an opaque secret of not-guaranteed-fixed length, so
 * per the security floor's VARIABLE-LENGTH rule both sides are SHA-256-digested to fixed 32-byte buffers
 * before `timingSafeEqual` — avoiding the equal-length guard that would leak the token's byte length to a
 * remote timing oracle. Normalization is identical on both sides (raw bytes), so only the value compares.
 */
function authorized(req: Request, token: string): boolean {
  if (token.length === 0) return false; // unconfigured ⇒ fail closed
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

/** Build the request handler. Async because /issue awaits the tenant read + the signer. */
export function createApp(
  deps: IssueAppDeps,
): (req: Request) => Promise<Response> {
  /**
   * Per-IP rate gate. Returns a 429 Response when the bucket is exhausted, or `null` to proceed. FAILS
   * OPEN on any limiter internal error (logs to stderr — never silently disables) so a limiter bug can
   * never take the commerce webhook or the issuer offline.
   */
  const rateLimited = (bucket: RateBucket, req: Request): Response | null => {
    try {
      // Per-IP FIRST, so per-IP abuse stays isolated to the abuser's own bucket. Only a per-IP-ALLOWED
      // request then charges the header-independent service-wide ceiling (Strix vuln-0001 defense-in-
      // depth) — charging global first would let one throttled IP drain it and 429 everyone else
      // (self-DoS amplification). Deny if EITHER trips.
      const decision = deps.limiter.check(bucket, clientIp(req));
      if (!decision.allowed) {
        return text("rate limit exceeded", 429, {
          "Retry-After": String(decision.retryAfterSec),
        });
      }
      const global = deps.limiter.checkGlobal(bucket);
      if (!global.allowed) {
        return text("rate limit exceeded", 429, {
          "Retry-After": String(global.retryAfterSec),
        });
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[service-license] rate-limiter error (failing open): ${msg}\n`,
      );
      return null;
    }
  };

  return withRequestSpan(async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    if (pathname === "/health") {
      return method === "GET"
        ? json({ ok: true })
        : text("method not allowed", 405);
    }

    if (pathname === "/issue") {
      if (method !== "POST") return text("method not allowed", 405);
      // Rate-gate BEFORE the bearer check (defense-in-depth) so an unauthenticated flood is capped too.
      const limited = rateLimited("issue", req);
      if (limited !== null) return limited;
      if (!authorized(req, deps.token))
        return json({ error: "unauthorized" }, 401);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const parsed = IssueBody.safeParse(raw);
      if (!parsed.success) {
        return json(
          { error: "invalid issue request", issues: parsed.error.issues },
          400,
        );
      }
      const { accountId, tier, major, expiry } = parsed.data;

      // Idempotent re-serve (persist & reuse): a prior /issue for this exact (accountId, major)
      // already minted + stored a token — return it byte-identical, never re-mint. Read is RLS-scoped
      // (withTenant), so this can only ever see the caller's own account's grants.
      const existing = await withTenant(deps.db, accountId, (tx) =>
        readLicenseGrant(tx, accountId, major),
      );
      if (existing !== null) {
        return json({ token: existing.token, licenseId: existing.licenseId });
      }

      // Server-side entitlement truth: resolve the account's purchases → member slugs, RLS-scoped.
      // A stored purchased id absent from the index fails closed (`expandEntitlements` throws); we map
      // that to a 422 with a GENERIC message (never echo internal ids).
      let entitlements: string[];
      try {
        const resolved = await withTenant(deps.db, accountId, (tx) =>
          resolveAccountEntitlements(tx, accountId, deps.index),
        );
        entitlements = [...resolved].sort();
      } catch {
        return json({ error: "could not resolve account entitlements" }, 422);
      }

      const claims = {
        licenseId: randomUUID(),
        tier,
        entitlements,
        major,
        expiry,
      };
      let token: string;
      try {
        token = await issueLicense(deps.signer, claims);
      } catch {
        // A signer failure (corrupted PKCS8 key, a future KMS adapter timeout) must surface as a
        // structured 500 — never an unhandled async rejection that Bun renders as a non-JSON body or
        // leaks internal error detail. Mirrors the entitlement-resolution guard above.
        return json({ error: "signing failed" }, 500);
      }

      // Persist, idempotently: a concurrent /issue for the same (accountId, major) may have minted
      // its OWN token and stored it first — `storeLicenseGrant`'s unique-index ON CONFLICT silently
      // drops the loser's insert. Re-read on a lost race so every caller converges on the SAME stored
      // (winning) token, never two live tokens for one (account, major).
      const stored = await withTenant(deps.db, accountId, (tx) =>
        storeLicenseGrant(tx, {
          accountId,
          major,
          licenseId: claims.licenseId,
          tier,
          expiry,
          token,
        }),
      );
      if (stored) {
        return json({ token, licenseId: claims.licenseId });
      }
      const winner = await withTenant(deps.db, accountId, (tx) =>
        readLicenseGrant(tx, accountId, major),
      );
      // The unique-index insert just reported a conflict, so a row MUST exist; this null branch is an
      // unreachable defensive fallback (never observed) rather than a silent re-mint on a read failure.
      return json(
        winner !== null
          ? { token: winner.token, licenseId: winner.licenseId }
          : { token, licenseId: claims.licenseId },
      );
    }

    if (pathname === "/webhook") {
      // The Paddle MoR webhook destination (license.caisson.sh/webhook, ADR-0108/0116). A real purchase
      // lands here; this route provisions it. It runs BOTH the credit grant AND the entitlement grant in
      // ONE tenant transaction (apply-billing-event.ts) — the seam the services-hardening audit (#3)
      // flagged as bound to no server.
      if (method !== "POST") return text("method not allowed", 405);

      // Rate-gate FIRST: /webhook is the public grey-origin (`*.up.railway.app`) surface, so an
      // unsigned flood (each costs an HMAC compute) is capped before any verify/DB work.
      const limited = rateLimited("webhook", req);
      if (limited !== null) return limited;

      // Fail closed when the webhook secret is unconfigured: a null provider cannot verify ANY signature,
      // so an unverifiable payload must be rejected, never provisioned (security floor — fail-closed auth).
      if (deps.provider === null) return json({ error: "unauthorized" }, 401);

      const signature = req.headers.get("paddle-signature") ?? "";
      // Verify against the RAW request body — a parsed + re-serialized payload would not match Paddle's
      // `ts:rawBody` HMAC. `req.text()` reads the bytes exactly as delivered.
      const rawBody = await req.text();
      let result: BillingWebhookResult;
      try {
        // handleBillingWebhook verifies the Paddle signature (throws AuthnError on a missing/invalid one
        // BEFORE any DB work) then applies the domain event inside `withTenant`: a one-time
        // purchase.completed grants its entitlements AND any credits; a subscription invoice.paid grants
        // the cycle credits AND the plan's entitlements — both in one RLS-scoped transaction (ADR-0071/
        // 0089/0113). The grant stores are idempotent on their natural keys (payment/invoice id), so a
        // Paddle retry of the same event_id re-applies as a no-op (ADR-0113) — no separate event-dedupe
        // table needed.
        result = await handleBillingWebhook(
          deps.db,
          deps.provider,
          rawBody,
          signature,
        );
      } catch (err) {
        if (err instanceof AuthnError) {
          // Missing/invalid signature — fail closed, never provision (no secret or body echoed back).
          return json({ error: "unauthorized" }, 401);
        }
        // A grant-time failure (unknown price id → fail-closed throw, or a DB error) MUST return non-2xx
        // so Paddle RETRIES the delivery — a 2xx here would silently drop a real, paid purchase.
        process.stderr.write("[service-license] webhook processing failed\n");
        return json({ error: "webhook processing failed" }, 500);
      }
      // Post-commit Discord role push (ADR-0203): DETACHED, fired only after the grant durably
      // landed, and OUTSIDE the grant's try/catch — a misbehaving notifier (even one throwing
      // synchronously) must never convert a committed grant into a 500 (which would trigger a
      // pointless Paddle re-delivery). `notifyDiscordGrant` itself never throws; the guards here
      // are belt-and-braces for injected doubles. Paddle's 2xx never waits on Discord.
      if (
        deps.discordNotify !== null &&
        result.event !== null &&
        result.grantedEntitlements.length > 0
      ) {
        const push: DiscordGrantPush = {
          accountId: result.event.accountId,
          entitlements: result.grantedEntitlements,
        };
        try {
          void deps.discordNotify(push).catch(() => {
            process.stderr.write(
              "[service-license] discord notify rejected (ignored)\n",
            );
          });
        } catch {
          process.stderr.write(
            "[service-license] discord notify threw (ignored)\n",
          );
        }
      }
      // 2xx ONLY after the grant commits, so Paddle stops retrying only on a durable success.
      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  });
}
