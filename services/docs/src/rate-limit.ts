// src/rate-limit.ts — a per-IP token-bucket limiter for the docs service (hardening #1, ADR-0096).
//
// WHY a separate per-IP limiter: ADR-0112's rate-limit store is keyed per-ACCOUNT (the MCP/license
// surface authenticates a tenant). The docs service has NO account — `/llms*.txt` is an unauth scrape
// surface and `/query` is unauth-floodable spend (live OpenRouter embedding $ per hit). services/docs is
// a GREY origin (no Cloudflare WAF) reachable at `*.up.railway.app`, so the only available identity is the
// client IP. This is an in-process, single-instance limiter (good enough for one Railway replica); a
// multi-replica deploy would need a shared store, tracked as a follow-up.
//
// The bucket is a fixed-window token bucket: each (bucket,ip) holds `tokens` that reset to `capacity` at
// the `resetAt` window boundary. Bounded map size + prune-on-insert keep memory flat under a spray of
// distinct source IPs. The limiter NEVER throws on a hot path; the handler still fails OPEN on any internal
// error (it logs, never silently disables) so a limiter bug can't take the service down.
import { z } from "zod";

/** One route-class budget: `capacity` requests per `windowMs`, refilled whole at the window boundary. */
export interface BucketConfig {
  /** Burst capacity = max requests allowed within one window. */
  readonly capacity: number;
  /** Window length in ms; tokens reset to `capacity` when it elapses. */
  readonly windowMs: number;
}

/** Validated limiter config. `query` is the expensive ($/hit) surface and gets the stricter budget. */
export interface RateLimitConfig {
  readonly query: BucketConfig;
  readonly static: BucketConfig;
  /** Hard cap on distinct (bucket,ip) entries held in memory before prune evicts. */
  readonly maxEntries: number;
}

/** Which route-class budget to charge a request against. */
export type RateBucket = "query" | "static";

/** Limiter verdict. `retryAfterSec` is meaningful only when `allowed` is false. */
export interface RateDecision {
  readonly allowed: boolean;
  readonly retryAfterSec: number;
}

export interface RateLimiter {
  check(bucket: RateBucket, ip: string): RateDecision;
}

/**
 * Parse the limiter config from env with safe defaults, Zod-validated. An empty/unset var falls back to the
 * default; a PRESENT-but-invalid var (non-numeric, zero, negative) throws — fail-closed on bad config rather
 * than serving with a silently-wrong budget. `/query` defaults to a much tighter budget than the static
 * `/llms*.txt` routes because each `/query` hit costs real OpenRouter spend.
 */
const PosInt = z.coerce.number().int().positive();

const EnvSchema = z
  .object({
    queryBurst: PosInt.default(20),
    queryWindowSec: PosInt.default(60),
    staticBurst: PosInt.default(120),
    staticWindowSec: PosInt.default(60),
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
    queryBurst: "DOCS_RL_QUERY_BURST",
    queryWindowSec: "DOCS_RL_QUERY_WINDOW_SEC",
    staticBurst: "DOCS_RL_STATIC_BURST",
    staticWindowSec: "DOCS_RL_STATIC_WINDOW_SEC",
    maxEntries: "DOCS_RL_MAX_ENTRIES",
  };
  for (const [key, envName] of Object.entries(map)) {
    const v = present(env[envName]);
    if (v !== undefined) raw[key] = v;
  }
  const c = EnvSchema.parse(raw);
  return {
    query: { capacity: c.queryBurst, windowMs: c.queryWindowSec * 1000 },
    static: { capacity: c.staticBurst, windowMs: c.staticWindowSec * 1000 },
    maxEntries: c.maxEntries,
  };
}

interface Entry {
  tokens: number;
  resetAt: number;
}

/**
 * In-memory fixed-window token bucket. `now` is injectable so tests can advance the clock deterministically
 * (no `sleep`). Map keys are `${bucket}|${ip}`; insertion order gives an approximate-FIFO eviction order for
 * the overflow prune.
 */
export class TokenBucketLimiter implements RateLimiter {
  readonly #query: BucketConfig;
  readonly #static: BucketConfig;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();

  constructor(config: RateLimitConfig, now: () => number = Date.now) {
    this.#query = config.query;
    this.#static = config.static;
    this.#maxEntries = config.maxEntries;
    this.#now = now;
  }

  check(bucket: RateBucket, ip: string): RateDecision {
    const cfg = bucket === "query" ? this.#query : this.#static;
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
