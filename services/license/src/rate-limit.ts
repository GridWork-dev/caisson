// src/rate-limit.ts — a per-IP token-bucket limiter for the license service (services-hardening #4).
//
// WHY per-IP (and a LOCAL COPY of the docs limiter): ADR-0112's rate-limit store is keyed per-ACCOUNT,
// but the two surfaces here are not account-identified at the edge — POST /webhook is hit by Paddle (and
// anyone else on the grey `*.up.railway.app` origin) BEFORE the signature is verified, and POST /issue is
// bearer-gated but the limiter is defense-in-depth that must apply BEFORE the bearer check absorbs an
// unauthenticated flood. The only identity available pre-auth is the client IP. This is an in-process,
// single-instance limiter (good enough for one Railway replica); a multi-replica deploy needs a shared
// store — tracked as a follow-up, same as services/docs.
//
// This is a deliberate near-duplicate of services/docs/src/rate-limit.ts (different bucket names + env
// keys). The two services do not share a package, and the task scoped a local copy over premature
// extraction; if a third surface needs this, lift it into a shared @caisson/* helper then.
//
// The limiter NEVER throws on a hot path; the handler still fails OPEN on any internal error (logs, never
// silently disables) so a limiter bug can't take the commerce webhook offline.
import { z } from "zod";

/** One route-class budget: `capacity` requests per `windowMs`, refilled whole at the window boundary. */
export interface BucketConfig {
  /** Burst capacity = max requests allowed within one window. */
  readonly capacity: number;
  /** Window length in ms; tokens reset to `capacity` when it elapses. */
  readonly windowMs: number;
}

/** Validated limiter config: one budget per route class plus a hard cap on tracked (bucket,ip) entries. */
export interface RateLimitConfig {
  readonly webhook: BucketConfig;
  readonly issue: BucketConfig;
  /** Hard cap on distinct (bucket,ip) entries held in memory before prune evicts. */
  readonly maxEntries: number;
}

/** Which route-class budget to charge a request against. */
export type RateBucket = "webhook" | "issue";

/** Limiter verdict. `retryAfterSec` is meaningful only when `allowed` is false. */
export interface RateDecision {
  readonly allowed: boolean;
  readonly retryAfterSec: number;
}

export interface RateLimiter {
  check(bucket: RateBucket, ip: string): RateDecision;
}

const PosInt = z.coerce.number().int().positive();

/**
 * Parse the limiter config from env with safe defaults, Zod-validated. An empty/unset var falls back to
 * the default; a PRESENT-but-invalid var (non-numeric, zero, negative) throws — fail-closed on bad config
 * rather than serving with a silently-wrong budget. Defaults are generous (Paddle's legitimate webhook
 * volume and the dashboard's /issue volume are both low) so only an abusive flood is capped.
 */
const EnvSchema = z
  .object({
    webhookBurst: PosInt.default(120),
    webhookWindowSec: PosInt.default(60),
    issueBurst: PosInt.default(60),
    issueWindowSec: PosInt.default(60),
    maxEntries: PosInt.default(10_000),
  })
  .strict();

/** Read an env var, treating unset OR blank as absent so the Zod default applies. */
function present(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() !== "" ? value : undefined;
}

export function loadRateLimitConfig(
  env: Record<string, string | undefined> = process.env,
): RateLimitConfig {
  const raw: Record<string, string> = {};
  const map: Record<string, string> = {
    webhookBurst: "LICENSE_RL_WEBHOOK_BURST",
    webhookWindowSec: "LICENSE_RL_WEBHOOK_WINDOW_SEC",
    issueBurst: "LICENSE_RL_ISSUE_BURST",
    issueWindowSec: "LICENSE_RL_ISSUE_WINDOW_SEC",
    maxEntries: "LICENSE_RL_MAX_ENTRIES",
  };
  for (const [key, envName] of Object.entries(map)) {
    const v = present(env[envName]);
    if (v !== undefined) raw[key] = v;
  }
  const c = EnvSchema.parse(raw);
  return {
    webhook: { capacity: c.webhookBurst, windowMs: c.webhookWindowSec * 1000 },
    issue: { capacity: c.issueBurst, windowMs: c.issueWindowSec * 1000 },
    maxEntries: c.maxEntries,
  };
}

interface Entry {
  tokens: number;
  resetAt: number;
}

/**
 * In-memory fixed-window token bucket. `now` is injectable so tests can advance the clock deterministically
 * (no `sleep`). Map keys are `${bucket}|${ip}`; insertion order gives an approximate-FIFO eviction order
 * for the overflow prune.
 */
export class TokenBucketLimiter implements RateLimiter {
  readonly #webhook: BucketConfig;
  readonly #issue: BucketConfig;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();

  constructor(config: RateLimitConfig, now: () => number = Date.now) {
    this.#webhook = config.webhook;
    this.#issue = config.issue;
    this.#maxEntries = config.maxEntries;
    this.#now = now;
  }

  check(bucket: RateBucket, ip: string): RateDecision {
    const cfg = bucket === "webhook" ? this.#webhook : this.#issue;
    const now = this.#now();
    const key = `${bucket}|${ip}`;
    let entry = this.#entries.get(key);
    if (entry === undefined || now >= entry.resetAt) {
      entry = { tokens: cfg.capacity, resetAt: now + cfg.windowMs };
      this.#entries.set(key, entry);
      this.#prune(now);
    }
    if (entry.tokens > 0) {
      entry.tokens -= 1;
      return { allowed: true, retryAfterSec: 0 };
    }
    // Retry-After is the whole-seconds wait until the window resets (>=1 so clients never busy-spin).
    const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  /** Keep the map bounded: drop expired entries first, then FIFO-evict the oldest if still over cap. */
  #prune(now: number): void {
    if (this.#entries.size <= this.#maxEntries) return;
    for (const [k, e] of this.#entries) {
      if (now >= e.resetAt) this.#entries.delete(k);
    }
    if (this.#entries.size <= this.#maxEntries) return;
    const overflow = this.#entries.size - this.#maxEntries;
    let dropped = 0;
    for (const k of this.#entries.keys()) {
      if (dropped >= overflow) break;
      this.#entries.delete(k);
      dropped += 1;
    }
  }
}

/**
 * Derive the client IP. TRUST MODEL (corrected — the leftmost-XFF read this replaces was
 * client-spoofable): `X-Forwarded-For` is a comma-appended list a CLIENT can seed with arbitrary
 * leftmost entries of its own choosing before the request ever reaches Railway's edge — an
 * attacker rotates a fake leftmost hop on every request to mint a fresh rate-limit bucket per
 * request, defeating the limiter entirely. Prefer Railway's own `X-Envoy-External-Address`
 * (single-value, edge-set, not attacker-appendable) when present. Otherwise fall back to the
 * RIGHTMOST `X-Forwarded-For` hop — the entry the edge proxy itself appended for the connection it
 * directly observed, never a client-supplied one — and NEVER the leftmost. If neither is present,
 * all such requests collapse onto one shared "unknown" bucket — conservative (collectively
 * throttled) rather than fail-open per request.
 */
export function clientIp(req: Request): string {
  const envoy = req.headers.get("x-envoy-external-address")?.trim();
  if (envoy !== undefined && envoy.length > 0) return envoy;
  const xff = req.headers.get("x-forwarded-for");
  if (xff === null) return "unknown";
  const hops = xff
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);
  const last = hops[hops.length - 1];
  return last !== undefined ? last : "unknown";
}
