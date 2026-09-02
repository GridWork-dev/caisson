// src/app.ts — the license-ISSUER HTTP router (ADR-0110, implements ADR-0010). A pure
// `Request → Response` function over injected deps (token, signer, registry index, tenant Transactor)
// so it is testable without a live socket. Issuance is LAZY + bearer-gated: POST /issue mints a signed
// license carrying the account's PURCHASED entitlement ids (the claims contract — every consumer
// expands them against the index at verification: Worker resolveGate, MCP server). The read is
// RLS-scoped inside `withTenant` and validated fail-closed via `expandEntitlements` before signing
// (`@caisson/license-issue`); the expansion is VALIDATION ONLY, never the signed set — signing the
// expansion would orphan the purchased-id-keyed `updatesWindows`/`entitledSince` maps at the edge
// (the Worker's window fold matches token entitlements against those keys; audit F2 2026-07-06). POST /issue is
// IDEMPOTENT per (accountId, major) ("persist & reuse"): the first call mints, signs, and persists the
// token via `license-grant-store.ts`; every later call for the same (accountId, major) re-serves the
// STORED token byte-identical — never proliferates fresh perpetual tokens for one purchase — UNLESS
// the account's computed ADR-0244/0255 per-entitlement updates windows differ (canonically) from the
// stored token's signed `updatesWindows` map (a renewal landed), in which case /issue RE-MINTS and
// replaces the stored token in place (ADR-0251 Decision 3; still one row per (account, major)). A
// different major always mints its own grant. POST /webhook is the Paddle Merchant-of-Record
// destination (license.caisson.sh/webhook, ADR-0108/0116): it verifies the `Paddle-Signature` HMAC over
// the RAW body (timing-safe, fail-closed) and provisions a verified purchase by running BOTH the credit
// grant AND the entitlement grant in ONE tenant transaction. /health is public (like services/docs). Every
// response carries the standard security-floor headers (nosniff / frame-deny / HSTS). The Bearer gate is
// timing-safe over the VARIABLE-LENGTH token (SHA-256 → `timingSafeEqual`, the security-floor rule) and
// fail-closed when the token is unset. Server-to-server contract — no CORS.
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BillingProvider } from "@caisson/billing";
import { AuthnError, ConflictError } from "@caisson/kernel";
import {
  loadOriginGateConfig,
  originRequestAuthorized,
  servingRevision,
  REVISION_HEADER,
  type OriginGateConfig,
} from "@caisson/kernel/node";
import { issueLicense, type Signer } from "@caisson/license-issue";
import {
  decodeToken,
  licenseClaimsSchema,
  licenseTierSchema,
  type LicenseTier,
} from "@caisson/license-verify";
import { withRequestSpan } from "@caisson/observability";
import { withAdminWrite } from "@caisson/org-controls";
import {
  expandEntitlements,
  type RegistryIndex,
} from "@caisson/registry-schema";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import type { ChargebackAlert } from "./chargeback-notify.ts";
import {
  createEvalApplication,
  readEvalApplication,
  recordIssuedEval,
} from "./eval-store.ts";
import {
  type DomainSignals,
  type EvalConfig,
  extractDomain,
  scoreApplication,
  validateEvalScope,
} from "./eval-verification.ts";
import type { DiscordGrantPush } from "./discord-notify.ts";
import type {
  PurchaseEmailNotice,
  RenewalEmailNotice,
  RevokeEmailNotice,
} from "./email-notify.ts";
import {
  computeEntitledSince,
  computeUpdatesWindows,
  readEntitlements,
} from "./entitlement-store.ts";
import {
  readLicenseGrant,
  storeLicenseGrant,
  updateLicenseGrantToken,
} from "./license-grant-store.ts";
import type { PurchaseCapture } from "./posthog-capture.ts";
import { clientIp, type RateBucket, type RateLimiter } from "./rate-limit.ts";
import { type BillingWebhookResult, handleBillingWebhook } from "./webhook.ts";
import type {
  RateLimiterFailureMode,
  RateLimiterInfraAlert,
} from "./alerting.ts";

/** The one path exempt from the origin gate. MUST equal `healthcheckPath` in
 *  services/license/railway.toml — a test pins the pair, because a drift there silently re-freezes
 *  the fleet deploy with no local signal. */
export const HEALTH_PROBE_PATH = "/health";

export interface IssueAppDeps {
  /** Bearer secret for POST /issue. Must be non-empty — server.ts fails closed if it is unset. */
  token: string;
  /**
   * A SECOND, admin-scoped Bearer that also authorizes POST /issue (ADR-0220 Fork AM-5). Distinct
   * from `token` (`LICENSE_ISSUE_TOKEN`) so the apps/admin reissue proxy authenticates WITHOUT ever
   * holding the primary issue secret — routing a CF-Access session through the shared token would
   * let any CF-Access identity mint licenses for any account. Empty/unset ⇒ no admin path (the
   * default; a normal license service never sets it). Compared timing-safe like `token`.
   */
  adminToken?: string;
  /** The signing identity (default Ed25519Signer over a PKCS8 env key; KMS is an un-wired seam). */
  signer: Signer;
  /** The built registry index — membership truth for entitlement expansion (ADR-0071). */
  index: RegistryIndex;
  /** The tenant Transactor — the /issue entitlement reads run inside `withTenant` over it (RLS). */
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
  /** Cloudflare Worker origin gate. Omitted only when the runtime loader supplies the config. */
  originGate?: OriginGateConfig;
  /**
   * Detached operational alert for limiter infrastructure failures. The payload is intentionally
   * redacted to route bucket + applied failure policy; it never receives request or error data.
   */
  rateLimiterAlert: (alert: RateLimiterInfraAlert) => Promise<void>;
  /**
   * The post-grant Discord role push (ADR-0203). `null` when SUPPORT_BOT_URL /
   * SUPPORT_BOT_GRANT_TOKEN are unset — the push is simply skipped. Fired DETACHED after the grant
   * commits; it must never delay or fail the webhook response (the injected implementation —
   * `notifyDiscordGrant` — never throws).
   */
  discordNotify: ((push: DiscordGrantPush) => Promise<void>) | null;
  /**
   * Server-side PostHog `purchase` capture (ADR-0237 F8). `null` when POSTHOG_CAPTURE_KEY is
   * unset — the capture is simply skipped. Same post-commit detached contract as `discordNotify`
   * (the injected implementation — `capturePostHogPurchase` — never throws).
   */
  posthogCapture: ((capture: PurchaseCapture) => Promise<void>) | null;
  /**
   * Abandoned-checkout conversion capture (SPEC outputs/specs/deferred-respec/
   * SPEC-abandoned-checkout-email.md §e, 2026-07-10 lock). Optional and `null`-able like
   * `posthogCapture` (absent when POSTHOG_CAPTURE_KEY is unset) — the injected implementation
   * itself checks whether this account has a recent abandoned-checkout notice
   * (`hasRecentAbandonedCheckoutNotice`) before firing anything, so this gate here is only "did a
   * real, granting purchase land," same as `posthogCapture`'s own gate.
   */
  abandonedCheckoutConverted?: ((accountId: string) => Promise<void>) | null;
  /**
   * The post-grant purchase-confirmation email. Unlike `discordNotify`/`posthogCapture` this is
   * never `null` — `server.ts` always wires `email-notify.ts#resolveEmailer()` (Resend or the
   * capture driver), so email is always "sent" somewhere. Same detached, never-throw contract as
   * `discordNotify` (the injected implementation — `notifyPurchaseEmail` — never throws).
   */
  purchaseEmailNotify: (notice: PurchaseEmailNotice) => Promise<void>;
  /**
   * The post-grant renewal-confirmation email (ADR-0251) — the SIBLING send for a RENEWAL_BOOK
   * line, which grants nothing so it never fires `purchaseEmailNotify`. Same never-`null`,
   * always-wired, detached, never-throw contract. A mixed cart (a new entitlement line + a
   * renewal line in one event) fires BOTH `purchaseEmailNotify` and this; only the purchase
   * receipt carries the whole-event total (this notice's `amountTotalMinor` is omitted there).
   */
  renewalEmailNotify: (notice: RenewalEmailNotice) => Promise<void>;
  /**
   * G27 (buyer-lifecycle audit 2026-07-07) — the post-revoke "your access changed" email, fired
   * only when a subscription cancel or a refund ACTUALLY revoked an active grant (see
   * `RevokeNotice`). Same never-`null`, always-wired, detached, never-throw contract as
   * `purchaseEmailNotify`/`renewalEmailNotify`.
   */
  revokeEmailNotify: (notice: RevokeEmailNotice) => Promise<void>;
  /**
   * ADR-0294 chargeback/dispute operator alert. Unlike `discordNotify`/`posthogCapture` this is
   * never `null` — `server.ts` always wires `chargeback-notify.ts#notifyChargebackAlert`, which
   * itself always logs the stderr ALERT floor and additionally posts to a Discord Incoming
   * Webhook when configured. Same detached, never-throw contract as the other post-commit pushes.
   */
  chargebackAlert: (alert: ChargebackAlert) => Promise<void>;
  /**
   * Index-parity probe surface (the F-1 index-parity residual: three independently-baked copies of
   * registry/index.json can drift). The sha256 (first 12 hex) of the index.json BYTES this service
   * loaded at boot, plus the entry count — echoed additively on GET /health. Absent ⇒ /health keeps
   * its bare `{ ok: true }` shape (existing probes grep it). server.ts always supplies both.
   */
  indexDigest?: string;
  indexEntries?: number;
  /**
   * The evaluation-access surface (ADR-0274 §2 / ADR-0280 verified time-boxed eval licenses).
   * `null`/absent ⇒ POST /eval/* returns 404 (a deploy without the eval tables provisioned simply
   * does not serve them; /issue + /webhook are unaffected). server.ts always wires it.
   */
  eval?: EvalAppDeps | null;
}

/** Injected dependencies for the eval-access routes. */
export interface EvalAppDeps {
  /** Verification thresholds (ADR-0274/0280) — from `loadEvalConfig`. */
  config: EvalConfig;
  /**
   * Resolve a domain's verification signals (MX / age / enrichment). INJECTED so scoring is
   * network-free in tests and config-gated in prod (`eval-signals.ts#resolveDomainSignals`). Every
   * failure resolves to an `undefined` field (uncertainty → review), never a pass.
   */
  resolveSignals: (domain: string) => Promise<DomainSignals>;
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
// Exported so tools/security/emit-openapi.ts can generate a true-to-code OpenAPI spec for schema
// fuzzing (Schemathesis) without re-declaring the shape — the emit is the fuzz contract's source.
export const IssueBody = z
  .object({
    accountId: z.string().trim().min(1).max(256),
    tier: licenseTierSchema,
    major: z.number().int().nonnegative(),
    expiry: z.string().datetime({ offset: true }).nullable(),
    // TRUE key rotation (the admin rotation lever): skip the idempotent re-serve and mint a FRESH
    // token + licenseId even when the stored claims are unchanged, replacing the stored grant in
    // place. The caller is responsible for denying the OLD licenseId (the edge deny-set) BEFORE
    // requesting this mint — this flag only forces the re-mint. Grants no new privilege: both
    // bearers can already mint; absent/false keeps the persist-and-reuse contract byte-identical.
    rotate: z.boolean().optional(),
  })
  .strict();

/**
 * POST /eval/apply body (ADR-0280). `.strict()` rejects unknown fields. `email` is the applicant's
 * WORK email (Zod-validated + bounded); the domain is derived server-side (never trusted from the
 * caller). `entitlements` is the purchased-id scope to evaluate (validated against the registry
 * index at /eval/issue). `accountId` is the buyer account (from a verified session upstream).
 */
export const EvalApplyBody = z
  .object({
    accountId: z.string().trim().min(1).max(256),
    email: z.string().trim().email().max(320),
    entitlements: z.array(z.string().trim().min(1).max(128)).min(1).max(64),
  })
  .strict();

/** POST /eval/issue body. `.strict()`. `evalId` is the application id; `major` the license major. */
export const EvalIssueBody = z
  .object({
    evalId: z.string().uuid(),
    major: z.number().int().nonnegative(),
  })
  .strict();

/**
 * POST /admin/affiliate/mint body (ADR-0315/0320). `.strict()`. The admin-scoped, server-to-server
 * affiliate mint: apps/admin's mint proxy sends the redeemable `code` + an internal `description`
 * (the affiliate name); this endpoint holds `PADDLE_API_KEY` and calls the billing driver's
 * `createDiscount` so that credential never enters the admin app. The 10%/30% program parameters are
 * inlined in the driver (operator-locked, ADR-0320) — never taken from this body.
 */
export const AffiliateMintBody = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .regex(/^[A-Za-z0-9]+$/, "code must be letters and digits only"),
    description: z.string().trim().min(1).max(200),
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
    headers: {
      ...SECURITY_HEADERS,
      // Ungated on purpose, unlike the health body's indexDigest: this must stay readable exactly
      // when the origin gate is the thing misbehaving, which is the case it exists to diagnose.
      // An opaque commit id for a private repo discloses nothing actionable on its own.
      [REVISION_HEADER]: servingRevision(),
      "Content-Type": contentType,
      ...extra,
    },
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
function tokenMatches(presented: string, token: string): boolean {
  if (token.length === 0) return false; // unconfigured ⇒ fail closed
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(token).digest();
  return timingSafeEqual(a, b);
}

/**
 * Timing-safe Bearer check against the primary issue token AND (if configured) the distinct
 * admin-scoped token (ADR-0220). BOTH digests are always computed before either compares, so the
 * presence of the admin token never changes the timing profile of a primary-token request. An
 * empty presented bearer matches neither (both configured secrets are non-empty by construction).
 */
function authorized(req: Request, token: string, adminToken: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  const primary = tokenMatches(presented, token);
  const admin = tokenMatches(presented, adminToken);
  return primary || admin;
}

/**
 * The re-mint-relevant claims carried by a STORED wire token — the signed `entitlements` (sorted
 * purchased ids) plus the per-entitlement `updatesWindows` (ADR-0251 D3 / ADR-0255) AND
 * `entitledSince` snapshot instants (ADR-0257 §1.2). Decode-only (no signature verify — the stored
 * token was minted by THIS service and is re-verified offline by every consumer; the baked verify
 * key here is prod, which a dev/test-signed stored token would fail). An absent/null map field (a
 * pre-window / pre-snapshot token) normalizes to the EMPTY map, so a subscription-only account's
 * stored token keeps re-serving byte-identical. A decode/parse failure reads as empty claims — the
 * fresh comparison then differs (any entitled account has a non-empty purchased set) and the corrupt
 * stored token is RE-MINTED in place rather than re-served: a token the verifier would reject helps
 * nobody, and the grant row stays unique per (account, major).
 */
function storedRemintClaims(token: string): {
  entitlements: string[];
  updatesWindows: Record<string, string>;
  entitledSince: Record<string, string>;
} {
  try {
    const claims = licenseClaimsSchema.parse(
      JSON.parse(decodeToken(token).payload) as unknown,
    );
    return {
      entitlements: [...claims.entitlements].sort(),
      updatesWindows: claims.updatesWindows ?? {},
      entitledSince: claims.entitledSince ?? {},
    };
  } catch {
    return { entitlements: [], updatesWindows: {}, entitledSince: {} };
  }
}

/**
 * Canonical form of a `purchasedEntitlementId → ISO` map for the re-mint equality check (ADR-0255
 * Decision 4): sorted-key JSON, so key insertion order never fakes a change. Used for both the
 * `updatesWindows` and `entitledSince` maps.
 */
function canonicalMap(map: Record<string, string>): string {
  return JSON.stringify(
    Object.entries(map).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

interface IssueOrReuseInput {
  accountId: string;
  tier: LicenseTier;
  major: number;
  expiry: string | null;
  /** True → skip the re-serve equality check and ALWAYS mint fresh (key rotation). The stored
   *  grant is still replaced in place — one row per (account, major) holds either way. */
  forceRemint?: boolean;
}

/**
 * The discriminated outcome of {@link issueOrReuseLicense} — the SAME two failure modes the
 * POST /issue route has always mapped to a 422/500 JSON body (see the route below), returned as
 * data instead of a `Response` so the ADR-0292 webhook-push mint (`mintLicensePostCommit`) can map
 * a failure onto its own log-and-alert contract instead.
 */
type IssueOutcome =
  | { kind: "ok"; token: string; licenseId: string }
  | { kind: "unresolved" }
  | { kind: "sign_failed" };

/**
 * The shared POST /issue core — ADR-0110's "persist & reuse" idempotent mint, extracted 2026-07-07
 * (ADR-0292) so the webhook-push first-mint reuses this EXACT signing + persistence path rather
 * than a second implementation. See the POST /issue route below for the full behavior contract
 * (idempotent re-serve, the ADR-0251 Decision 3 window-changed re-mint, the race-loser re-read).
 */
async function issueOrReuseLicense(
  deps: Pick<IssueAppDeps, "db" | "signer" | "index">,
  input: IssueOrReuseInput,
): Promise<IssueOutcome> {
  const { accountId, tier, major, expiry } = input;
  const { existing, updatesWindows, entitledSince, purchased } =
    await withTenant(deps.db, accountId, async (tx) => ({
      existing: await readLicenseGrant(tx, accountId, major),
      updatesWindows: await computeUpdatesWindows(tx, accountId),
      entitledSince: await computeEntitledSince(tx, accountId),
      purchased: await readEntitlements(tx, accountId),
    }));
  // The SIGNED entitlements are the account's PURCHASED ids, sorted — the claims contract every
  // consumer expands against the index at verification. Signing the EXPANSION instead orphans the
  // purchased-id-keyed `updatesWindows`/`entitledSince` maps (audit F2, 2026-07-06).
  const entitlements = [...purchased].sort();
  if (existing !== null && input.forceRemint !== true) {
    const stored = storedRemintClaims(existing.token);
    if (
      stored.entitlements.join(" ") === entitlements.join(" ") &&
      canonicalMap(stored.updatesWindows) === canonicalMap(updatesWindows) &&
      canonicalMap(stored.entitledSince) === canonicalMap(entitledSince)
    ) {
      return {
        kind: "ok",
        token: existing.token,
        licenseId: existing.licenseId,
      };
    }
  }

  // Fail-closed TM-E VALIDATION only (never the signed set): a stored purchased id absent from the
  // index — and not reserved — throws; mapped to the generic "unresolved" outcome (never echoing
  // internal ids).
  try {
    expandEntitlements(deps.index, purchased);
  } catch {
    return { kind: "unresolved" };
  }

  const claims = {
    licenseId: randomUUID(),
    tier,
    entitlements,
    major,
    expiry,
    updatesWindows,
    entitledSince,
  };
  let token: string;
  try {
    token = await issueLicense(deps.signer, claims);
  } catch {
    // A signer failure (corrupted PKCS8 key, a future KMS adapter timeout) — never an unhandled
    // async rejection.
    return { kind: "sign_failed" };
  }

  // Window-changed RE-MINT (ADR-0251 Decision 3): a stored grant exists but its signed window is
  // stale — replace the stored row's token in place (still exactly one row per (account, major)).
  // Late-loser caveat: a mint that hit the `withDeadline` timeout but keeps running in the
  // background (abandoned, not canceled) can still land HERE late — if two renewals for the SAME
  // account race within seconds, the late one's UPDATE can clobber a newer token with a stale one.
  // Self-heals on the account's next renewal event; only reachable once a slow KMS signer replaces
  // the current instant local Ed25519 signer (which never triggers the deadline in the first place).
  if (existing !== null) {
    await withTenant(deps.db, accountId, (tx) =>
      updateLicenseGrantToken(tx, {
        accountId,
        major,
        licenseId: claims.licenseId,
        tier,
        expiry,
        token,
      }),
    );
    return { kind: "ok", token, licenseId: claims.licenseId };
  }

  // Persist, idempotently: a concurrent /issue for the same (accountId, major) may have minted its
  // OWN token and stored it first — `storeLicenseGrant`'s unique-index ON CONFLICT silently drops
  // the loser's insert. Re-read on a lost race so every caller converges on the SAME stored
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
    return { kind: "ok", token, licenseId: claims.licenseId };
  }
  const winner = await withTenant(deps.db, accountId, (tx) =>
    readLicenseGrant(tx, accountId, major),
  );
  // The unique-index insert just reported a conflict, so a row MUST exist; this null branch is an
  // unreachable defensive fallback (never observed) rather than a silent re-mint on a read failure.
  return winner !== null
    ? { kind: "ok", token: winner.token, licenseId: winner.licenseId }
    : { kind: "ok", token, licenseId: claims.licenseId };
}

// The local Ed25519 signer never blocks, but a future KMS-backed `Signer`
// could — and `mintLicensePostCommit` is AWAITED inline in the webhook response path. This bounds
// an otherwise-INFINITE hang and preserves the never-5xx contract (the mint always resolves one way
// or another within this window). It does NOT guarantee the response stays inside Paddle's own ~5s
// total webhook timeout on a slow signer: this deadline stacks on top of the grant transaction that
// already ran before it, so a slow signer can still push the delivery past Paddle's window — Paddle
// then retries, which is benign (both the grant and the mint are idempotent), not silent data loss.
const MINT_POST_COMMIT_TIMEOUT_MS = 5_000;

/**
 * Race `work` against `timeoutMs` — REJECTS with a deadline error if `work` hasn't settled in time
 * (mirrors `packages/guardrails`'s `moderateWithDeadline` race idiom). A pending `work` that later
 * settles past the deadline must not surface as an unhandled rejection.
 */
function withDeadline<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  work.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`mint deadline exceeded (${String(timeoutMs)}ms)`)),
      timeoutMs,
    );
  });
  return Promise.race([work, deadline]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

/**
 * ADR-0292 — license first-mint webhook-push. Mint (or idempotently re-serve, per
 * {@link issueOrReuseLicense}'s own persist-and-reuse discipline) the buyer's license post-commit,
 * called only after a GRANTING or RENEWING billing event has already durably committed. NEVER
 * throws — the grant already landed, so a mint failure (a signer outage, a transient DB error, OR
 * a signer that exceeds {@link MINT_POST_COMMIT_TIMEOUT_MS}) must not turn an already-successful
 * webhook into a needless Paddle retry; it logs one operator-visible ALERT line and resolves
 * `null`. major/tier mirror the launch runbook's manual first-mint curl and the eval-issue path's
 * own default (major 0, perpetual; tier "pro" — a cosmetic label only, downstream access gates on
 * the signed `entitlements` list, never `tier`). Self-healing by construction: a failed OR
 * timed-out mint recovers on the account's NEXT granting/renewing event, or via the admin
 * first-mint lever (`POST /issue` through the admin reissue proxy) — a timeout leaves the
 * underlying signer call simply abandoned (never canceled — Ed25519/KMS signing has no cancel
 * primitive), so it may still complete in the background; the NEXT recovery path re-mints
 * idempotently regardless.
 */
async function mintLicensePostCommit(
  deps: Pick<IssueAppDeps, "db" | "signer" | "index">,
  accountId: string,
): Promise<string | null> {
  try {
    const outcome = await withDeadline(
      issueOrReuseLicense(deps, {
        accountId,
        tier: "pro",
        major: 0,
        expiry: null,
      }),
      MINT_POST_COMMIT_TIMEOUT_MS,
    );
    if (outcome.kind === "ok") return outcome.token;
    process.stderr.write(
      `[service-license] ALERT: first-mint license failed (${outcome.kind}) for account ${accountId} — no automated license issued this delivery; the next grant/renewal or the admin first-mint lever recovers\n`,
    );
    return null;
  } catch (err) {
    process.stderr.write(
      `[service-license] ALERT: first-mint license threw for account ${accountId}: ${err instanceof Error ? err.message : String(err)} — no automated license issued this delivery; the next grant/renewal or the admin first-mint lever recovers\n`,
    );
    return null;
  }
}

/** Build the request handler. Async because /issue awaits the tenant read + the signer. */
export function createApp(
  deps: IssueAppDeps,
): (req: Request) => Promise<Response> {
  const originGate = deps.originGate ?? loadOriginGateConfig(process.env);
  /** Per-IP rate gate. A real bucket denial is always 429. Infrastructure failure follows the
   * caller's explicit route policy and emits a detached, redacted operational alert. */
  const rateLimited = (
    bucket: RateBucket,
    req: Request,
    failureMode: RateLimiterFailureMode,
  ): Response | null => {
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
    } catch {
      process.stderr.write(
        `[service-license] ALERT: rate-limiter infrastructure failure; bucket=${bucket}; policy=fail-${failureMode}\n`,
      );
      try {
        void deps
          .rateLimiterAlert({ bucket, failureMode })
          .catch(() =>
            process.stderr.write(
              "[service-license] rate-limiter alert rejected (ignored)\n",
            ),
          );
      } catch {
        process.stderr.write(
          "[service-license] rate-limiter alert threw (ignored)\n",
        );
      }
      return failureMode === "closed"
        ? json({ error: "rate limiter unavailable" }, 503)
        : null;
    }
  };

  return withRequestSpan(async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const { pathname } = url;
    const method = req.method.toUpperCase();

    // Railway's platform healthcheck reaches the container internally and cannot carry the
    // Worker-injected secret, so gating the probe path froze every deploy in the fleet (ADR-0416
    // ruling 1). Exact equality, never a prefix — Railway probes the configured healthcheckPath
    // and nothing else, so exempting more than the literal string widens the carve for no benefit.
    const healthProbe = pathname === HEALTH_PROBE_PATH;
    const originAuthorized = originRequestAuthorized(req, originGate);
    if (!healthProbe && !originAuthorized) {
      return json({ error: "forbidden" }, 403);
    }

    if (healthProbe) {
      if (method !== "GET") return text("method not allowed", 405);
      // Additive: `ok` stays first + always present (existing probes grep it). The index digest +
      // entry count ride alongside whenever server.ts supplies them, with no origin-secret gate
      // (ADR-0417, superseding the gated half of ADR-0416 ruling 1). The gate never protected
      // anything: originRequestAuthorized proves PROVENANCE (the request arrived through the
      // Cloudflare Worker), not authentication of caller identity, and the Worker injects the
      // secret into every edge request — so every public caller on license.caisson.sh is already
      // "authorized" by construction. Gating on it withheld the field from exactly one class (a
      // direct-to-origin *.up.railway.app caller) while the front door handed it to the entire
      // internet. And there was no secret to protect in the first place: the digest is a
      // sha256-first-12 of registry/index.json, a file the registry Worker already serves
      // publicly at registry.caisson.sh. Measured 2026-09-01: the edge and the raw origin both
      // reach this handler; only the edge path used to carry the fields. Publish unconditionally.
      return json({
        ok: true,
        ...(deps.indexDigest !== undefined
          ? { indexDigest: deps.indexDigest, indexEntries: deps.indexEntries }
          : {}),
      });
    }

    if (pathname === "/issue") {
      if (method !== "POST") return text("method not allowed", 405);
      // Rate-gate BEFORE the bearer check (defense-in-depth) so an unauthenticated flood is capped too.
      const limited = rateLimited("issue", req, "closed");
      if (limited !== null) return limited;
      if (!authorized(req, deps.token, deps.adminToken ?? ""))
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
      const { accountId, tier, major, expiry, rotate } = parsed.data;

      // Idempotent re-serve (persist & reuse) with the ADR-0251 Decision 3 window-changed re-mint
      // and the race-loser re-read -- the full behavior contract lives on issueOrReuseLicense
      // above (extracted 2026-07-07, ADR-0292, so the webhook-push first-mint below shares this
      // EXACT path rather than a second implementation). `rotate: true` (the admin rotation
      // lever) forces a fresh mint instead of the re-serve — see IssueBody.
      const outcome = await issueOrReuseLicense(deps, {
        accountId,
        tier,
        major,
        expiry,
        forceRemint: rotate === true,
      });
      if (outcome.kind === "unresolved") {
        // Fail-closed TM-E VALIDATION only (never the signed set): a stored purchased id absent
        // from the index -- and not reserved -- throws inside issueOrReuseLicense; mapped here to
        // a 422 with a GENERIC message (never echo internal ids).
        return json({ error: "could not resolve account entitlements" }, 422);
      }
      if (outcome.kind === "sign_failed") {
        // A signer failure (corrupted PKCS8 key, a future KMS adapter timeout) must surface as a
        // structured 500 -- never an unhandled async rejection that Bun renders as a non-JSON body
        // or leaks internal error detail.
        return json({ error: "signing failed" }, 500);
      }
      return json({ token: outcome.token, licenseId: outcome.licenseId });
    }

    // ADR-0315/0320 — the admin-scoped affiliate discount mint. Server-to-server, bearer-gated (the
    // apps/admin mint proxy holds the admin token), rate-limited under the same "issue" bucket. This
    // endpoint holds `PADDLE_API_KEY` and calls the billing driver's `createDiscount` so that
    // credential never enters the admin app; it does NOT touch the DB (the affiliate_code
    // registration + dual-log run in apps/admin as `admin_write`). Returns only the minted
    // `{ discountId, code }`.
    if (pathname === "/admin/affiliate/mint") {
      if (method !== "POST") return text("method not allowed", 405);
      const limited = rateLimited("issue", req, "closed");
      if (limited !== null) return limited;
      if (!authorized(req, deps.token, deps.adminToken ?? ""))
        return json({ error: "unauthorized" }, 401);
      if (deps.provider === null || deps.provider.createDiscount === undefined)
        return json({ error: "affiliate minting not configured" }, 501);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const parsed = AffiliateMintBody.safeParse(raw);
      if (!parsed.success) {
        return json(
          { error: "invalid mint request", issues: parsed.error.issues },
          400,
        );
      }
      try {
        const minted = await deps.provider.createDiscount({
          code: parsed.data.code,
          description: parsed.data.description,
        });
        return json({ discountId: minted.discountId, code: minted.code });
      } catch {
        // createDiscount throws on any Paddle failure (bad key, duplicate code, network) — map to a
        // generic 502 (never echo the provider's raw error). The admin orchestrator's proxy treats a
        // non-2xx as a mint failure and writes no affiliate_code row.
        return json({ error: "discount creation failed" }, 502);
      }
    }

    // ADR-0274 §2 / ADR-0280 — the verified time-boxed eval-license surface. Both routes are
    // bearer-gated (server-to-server; the apps/site "request an evaluation" surface proxies /apply,
    // holding the bearer) and rate-limited under the same "issue" bucket. The store runs cross-tenant
    // (`withAdminWrite`) because the anti-abuse invariants (one active eval per domain, a global cap,
    // card-fingerprint reuse) are inherently cross-account.
    if (pathname === "/eval/apply") {
      if (method !== "POST") return text("method not allowed", 405);
      const evalDeps = deps.eval;
      if (evalDeps === null || evalDeps === undefined)
        return json({ error: "not found" }, 404);
      const limited = rateLimited("issue", req, "closed");
      if (limited !== null) return limited;
      if (!authorized(req, deps.token, deps.adminToken ?? ""))
        return json({ error: "unauthorized" }, 401);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const parsed = EvalApplyBody.safeParse(raw);
      if (!parsed.success) {
        return json(
          { error: "invalid eval application", issues: parsed.error.issues },
          400,
        );
      }
      const { accountId, email, entitlements } = parsed.data;
      // Scope ceiling (fail-closed shape check, before any signal lookup): an eval is never the full
      // catalog or a multi-bundle grant — see validateEvalScope for the exact allowed shapes.
      const scopeError = validateEvalScope(entitlements);
      if (scopeError !== null) return json({ error: scopeError }, 400);
      // Derive the domain server-side; a structurally invalid/unresolvable work email is a hard 400
      // (no row) — extractDomain reduces to the REGISTRABLE domain (eTLD+1, F3), so a.corp.com and
      // b.corp.com collide on the same one-active-eval-per-domain slot rather than each minting one.
      const domain = extractDomain(email);
      if (domain === null) return json({ error: "invalid work email" }, 400);

      // Resolve signals (may hit the network — bounded by the resolver's own per-lookup timeout),
      // then score. A resolver failure surfaces as an `undefined` signal (uncertainty → review),
      // never a throw here (`resolveDomainSignals` never throws) — but guard anyway.
      let signals: DomainSignals;
      try {
        signals = await evalDeps.resolveSignals(domain);
      } catch {
        signals = {
          mx: undefined,
          ageDays: undefined,
          enrichmentRisk: undefined,
        };
      }
      const score = scoreApplication(email, signals, evalDeps.config);
      const status =
        score.decision === "auto_approve"
          ? "approved"
          : score.decision === "auto_reject"
            ? "rejected"
            : "pending_review";

      try {
        const created = await withAdminWrite(deps.db, (tx) =>
          createEvalApplication(
            tx,
            {
              accountId,
              email,
              domain,
              entitlements,
              status,
              risk: score.risk,
              reason: score.reason,
            },
            evalDeps.config,
          ),
        );
        return json({
          evalId: created.id,
          decision: score.decision,
          status: created.status,
          risk: score.risk,
        });
      } catch (err) {
        if (err instanceof ConflictError) {
          // domain-active / global-cap — a generic non-leaking message; 409.
          return json(
            {
              error:
                err.message === "global-cap"
                  ? "evaluation capacity reached — try again later"
                  : "an active evaluation already exists for this domain",
            },
            409,
          );
        }
        process.stderr.write("[service-license] eval apply failed\n");
        return json({ error: "eval application failed" }, 500);
      }
    }

    if (pathname === "/eval/issue") {
      if (method !== "POST") return text("method not allowed", 405);
      const evalDeps = deps.eval;
      if (evalDeps === null || evalDeps === undefined)
        return json({ error: "not found" }, 404);
      const limited = rateLimited("issue", req, "closed");
      if (limited !== null) return limited;
      if (!authorized(req, deps.token, deps.adminToken ?? ""))
        return json({ error: "unauthorized" }, 401);

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const parsed = EvalIssueBody.safeParse(raw);
      if (!parsed.success) {
        return json(
          { error: "invalid eval issue request", issues: parsed.error.issues },
          400,
        );
      }
      const { evalId, major } = parsed.data;

      // TRUST BOUNDARY: like /issue, this is a server-to-server, bearer-gated contract — evalId is
      // trusted as-is, with no independent evalId→session/account binding check here. When a public
      // apps/site proxy surface fronts this route, it must bind the eval to the caller's session
      // before forwarding evalId (mirroring /issue's own documented tier-trust boundary above).
      const application = await withAdminWrite(deps.db, (tx) =>
        readEvalApplication(tx, evalId),
      );
      if (application === null) return json({ error: "eval not found" }, 404);
      // Idempotent re-serve: an already-issued eval returns its stored token byte-identical.
      if (
        application.status === "issued" &&
        application.licenseToken !== null &&
        application.licenseId !== null
      ) {
        return json({
          token: application.licenseToken,
          licenseId: application.licenseId,
          expiry: application.windowEnd,
        });
      }
      // FAIL-CLOSED: a license is minted ONLY for an operator/auto-approved eval whose card-on-file
      // leg validated (ADR-0280). Anything else (pending_review, rejected, revoked, expired, or
      // approved-but-card-unvalidated) is not issuable.
      if (application.status !== "approved" || !application.cardValidated) {
        return json({ error: "eval not issuable" }, 409);
      }

      // Validate the eval scope against the index (fail-closed, VALIDATION only — the SIGNED
      // entitlements are the purchased ids, never the expansion, the repo invariant). A generic 422.
      try {
        expandEntitlements(deps.index, application.entitlements);
      } catch {
        return json({ error: "could not resolve eval entitlements" }, 422);
      }

      const windowEnd = new Date(
        Date.now() + evalDeps.config.windowDays * 86_400_000,
      ).toISOString();
      const claims = {
        licenseId: randomUUID(),
        tier: "pro" as const,
        entitlements: [...application.entitlements].sort(),
        major,
        // The eval's fail-closed lever: a short signed expiry the verifier enforces offline — an
        // expired eval degrades to the community floor everywhere, no revocation round-trip needed.
        expiry: windowEnd,
        // Eval licenses carry no purchased-id windows/snapshots (those are one-time-grant concepts).
        updatesWindows: {},
        entitledSince: {},
        // The anti-exfiltration discriminator (ADR-0274/0280) — THIS is the ONLY signer of `eval:
        // true` anywhere in the service; the paid /issue path above never sets this key, so paid
        // claims stay byte-for-byte unchanged. Downstream (tarball watermarking, no-redistribution
        // enforcement) keys off this flag rather than inferring "is this eval" from expiry alone.
        eval: true as const,
      };
      let token: string;
      try {
        token = await issueLicense(deps.signer, claims);
      } catch {
        return json({ error: "signing failed" }, 500);
      }

      try {
        // Atomically transition approved+card-validated → issued. The UPDATE's WHERE re-checks the
        // gate, so a concurrent revoke between the read above and here fails closed (ConflictError).
        const issued = await withAdminWrite(deps.db, (tx) =>
          recordIssuedEval(tx, {
            evalId,
            licenseId: claims.licenseId,
            licenseToken: token,
            windowEnd,
          }),
        );
        return json({
          token,
          licenseId: claims.licenseId,
          expiry: issued.windowEnd,
        });
      } catch (err) {
        if (err instanceof ConflictError) {
          return json({ error: "eval not issuable" }, 409);
        }
        process.stderr.write("[service-license] eval issue failed\n");
        return json({ error: "eval issue failed" }, 500);
      }
    }

    if (pathname === "/webhook") {
      // The Paddle MoR webhook destination (license.caisson.sh/webhook, ADR-0108/0116). A real purchase
      // lands here; this route provisions it. It runs BOTH the credit grant AND the entitlement grant in
      // ONE tenant transaction (apply-billing-event.ts) — the seam the services-hardening audit (#3)
      // flagged as bound to no server.
      if (method !== "POST") return text("method not allowed", 405);

      // Rate-gate FIRST: /webhook is the public grey-origin (`*.up.railway.app`) surface, so an
      // unsigned flood (each costs an HMAC compute) is capped before any verify/DB work.
      const limited = rateLimited("webhook", req, "open");
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
      // ADR-0292 — license first-mint webhook-push. AWAITED here — unlike the Discord/PostHog/email
      // pushes below, which stay genuinely fire-and-forget — so the purchase-confirmation email
      // built further down can carry the freshly-minted token in THIS SAME delivery, synchronously,
      // rather than racing a detached mint against an already-fired email. Still strictly
      // post-commit: the grant's own `withTenant` transaction already committed inside
      // `handleBillingWebhook` above; the mint runs its OWN separate transaction(s) via
      // `issueOrReuseLicense`. NEVER throws (`mintLicensePostCommit` catches everything and logs an
      // operator ALERT on failure) — awaiting it can only ever add a few DB round trips to the
      // response, never turn a durable grant into a failed webhook. Mints on a GRANT (new
      // entitlements) or a RENEWAL (an updates-window extension, which grants nothing but still
      // needs a fresh signed window) — the same two triggers stage 5 and stage 7 of the
      // buyer-lifecycle audit named as the P0's root cause.
      const licenseToken: string | null =
        result.event !== null &&
        (result.grantedEntitlements.length > 0 ||
          result.renewedEntitlements.length > 0)
          ? await mintLicensePostCommit(deps, result.event.accountId)
          : null;
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
      // Post-commit PostHog purchase capture (ADR-0237 F8): same detached contract as the Discord
      // push — fired only on a durable grant, never delays or fails Paddle's 2xx. Re-deliveries
      // short-circuit on the grant claim with an empty grant list, so a purchase captures once.
      // `amountTotal` narrows the event union to the money-carrying kinds (purchase/invoice).
      if (
        deps.posthogCapture !== null &&
        result.event !== null &&
        "amountTotal" in result.event &&
        result.grantedEntitlements.length > 0
      ) {
        const capture: PurchaseCapture = {
          accountId: result.event.accountId,
          entitlements: result.grantedEntitlements,
          amountTotalMinor: result.event.amountTotal,
          currency: result.event.currency,
          sourceEventId: result.event.sourceEventId,
          skuLines: result.skuLines,
          // G33: the SAME subscription-cycle-vs-first-purchase computation the sibling email
          // notice makes, further down.
          subscriptionCycle:
            result.event.type === "invoice.paid" &&
            result.event.billingReason === "subscription_cycle",
          // ADR-0320: the `amountTotal` narrowing also admits refund/chargeback, which carry
          // no discountId — the `in` guard keeps this compiling across the whole union.
          discountId:
            "discountId" in result.event
              ? (result.event.discountId ?? null)
              : null,
        };
        try {
          void deps.posthogCapture(capture).catch(() => {
            process.stderr.write(
              "[service-license] posthog capture rejected (ignored)\n",
            );
          });
        } catch {
          process.stderr.write(
            "[service-license] posthog capture threw (ignored)\n",
          );
        }
      }
      // Post-commit abandoned-checkout conversion capture (SPEC-abandoned-checkout-email.md §e,
      // 2026-07-10 lock): same detached contract as the PostHog purchase capture above, gated
      // identically (a granting, non-re-delivery event only) — the injected implementation itself
      // decides whether this account actually has a recent abandoned-checkout notice before
      // firing anything.
      if (
        deps.abandonedCheckoutConverted !== undefined &&
        deps.abandonedCheckoutConverted !== null &&
        result.event !== null &&
        result.grantedEntitlements.length > 0
      ) {
        const accountId = result.event.accountId;
        try {
          void deps.abandonedCheckoutConverted(accountId).catch(() => {
            process.stderr.write(
              "[service-license] abandoned checkout converted capture rejected (ignored)\n",
            );
          });
        } catch {
          process.stderr.write(
            "[service-license] abandoned checkout converted capture threw (ignored)\n",
          );
        }
      }
      // Post-commit purchase-confirmation email: same detached, never-throw contract as the
      // Discord push / PostHog capture above, gated identically (a granting, money-carrying,
      // non-re-delivery event only). Unlike those two, `purchaseEmailNotify` is never null
      // (server.ts always wires a real-or-capture `@caisson/email` transport) — the gate below is
      // what decides WHEN to send, not whether email is configured.
      //
      // INFO (SHIP review 2026-07-08): a credit-pack-only purchase grants no entitlement
      // (`grantedEntitlements` stays empty), so it never trips this gate and gets no BRANDED
      // receipt from Caisson. Deliberate, not a gap — Paddle is the merchant of record and already
      // sends its own transactional payment receipt for every charge, branded or not.
      if (
        result.event !== null &&
        "amountTotal" in result.event &&
        result.grantedEntitlements.length > 0
      ) {
        // distinguish a subscription-CYCLE charge from a first purchase. A Paddle
        // `transaction.completed` carrying a subscription_id whose subscription already granted
        // maps to `invoice.paid` with `billingReason: "subscription_cycle"` (origin
        // `subscription_recurring`); `subscription_create` (the first charge) and every one-time
        // `purchase.completed` stay first-purchase receipts. The mixed-cart rule is unaffected: a
        // subscription invoice is single-line by design and never carries a renewal-book line, so
        // this receipt always states its own grand total.
        const notice: PurchaseEmailNotice = {
          accountId: result.event.accountId,
          orderId: result.event.sourceEventId,
          currency: result.event.currency,
          amountTotalMinor: result.event.amountTotal,
          lines: result.skuLines.map((line) => ({
            productSlug: line.productSlug,
          })),
          subscriptionCycle:
            result.event.type === "invoice.paid" &&
            result.event.billingReason === "subscription_cycle",
          // ADR-0292: the already-awaited first-mint result rides along when it succeeded. A mint
          // failure (`null`, already logged as an operator ALERT) sends the receipt WITHOUT a token
          // rather than not sending at all — a missing license is recoverable (the next event, or
          // the admin first-mint lever); a missing receipt is not.
          ...(licenseToken !== null ? { licenseToken } : {}),
        };
        try {
          void deps.purchaseEmailNotify(notice).catch(() => {
            process.stderr.write(
              "[service-license] purchase confirmation email rejected (ignored)\n",
            );
          });
        } catch {
          process.stderr.write(
            "[service-license] purchase confirmation email threw (ignored)\n",
          );
        }
      }
      // Post-commit renewal-confirmation email (ADR-0251): the SIBLING send for a RENEWAL_BOOK
      // line, which grants nothing so it never trips the `grantedEntitlements.length > 0` gate
      // above. Same detached, never-throw contract, gated on `renewedEntitlements` instead. A
      // mixed cart (a purchase line + a renewal line in one event) fires BOTH emails — the
      // purchase receipt states the whole-event total, so THIS notice omits it (two emails each
      // claiming the full cart total would read as a double charge).
      if (
        result.event !== null &&
        "amountTotal" in result.event &&
        result.renewedEntitlements.length > 0
      ) {
        const notice: RenewalEmailNotice = {
          accountId: result.event.accountId,
          orderId: result.event.sourceEventId,
          currency: result.event.currency,
          amountTotalMinor:
            result.grantedEntitlements.length > 0
              ? undefined
              : result.event.amountTotal,
          lines: result.renewedEntitlements.map((r) => ({
            entitlementId: r.entitlementId,
            newWindowEnd: r.newWindowEnd,
          })),
        };
        try {
          void deps.renewalEmailNotify(notice).catch(() => {
            process.stderr.write(
              "[service-license] renewal confirmation email rejected (ignored)\n",
            );
          });
        } catch {
          process.stderr.write(
            "[service-license] renewal confirmation email threw (ignored)\n",
          );
        }
      }
      // Post-commit revoke/refund notice (G27): same detached, never-throw contract as every
      // push above, gated on `revokeNotices` — populated ONLY when `applyBillingEvent` actually
      // revoked an active grant this delivery (a redelivery or a Resend of an already-revoked
      // purchase revokes nothing further, so this stays empty with no separate idempotency gate).
      for (const revoke of result.revokeNotices) {
        try {
          void deps.revokeEmailNotify(revoke).catch(() => {
            process.stderr.write(
              "[service-license] revoke notice email rejected (ignored)\n",
            );
          });
        } catch {
          process.stderr.write(
            "[service-license] revoke notice email threw (ignored)\n",
          );
        }
      }
      // Post-commit chargeback/dispute operator alert (ADR-0294): same detached, never-throw
      // contract as every push above, gated on `chargebackAlerts` (populated ONLY by the
      // ALERT-ONLY `chargeback.detected` case in apply-billing-event.ts — no grant/revoke/claw
      // runs for it). `deps.chargebackAlert` is never `null` (server.ts always wires it; the
      // stderr ALERT floor fires even with no Discord layer configured).
      for (const alert of result.chargebackAlerts) {
        try {
          void deps.chargebackAlert(alert).catch(() => {
            process.stderr.write(
              "[service-license] chargeback alert rejected (ignored)\n",
            );
          });
        } catch {
          process.stderr.write(
            "[service-license] chargeback alert threw (ignored)\n",
          );
        }
      }
      // 2xx ONLY after the grant commits, so Paddle stops retrying only on a durable success.
      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  });
}
