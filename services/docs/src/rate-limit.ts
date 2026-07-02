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

/** Validated limiter config. `query` is the expensive ($/hit) surface and gets the stricter budget.
 * `globalQuery`/`globalStatic` are the header-INDEPENDENT service-wide ceilings (Strix vuln-0001
 * defense-in-depth): a per-IP key is only as trustworthy as the IP signal, so a second bucket bounds
 * total throughput regardless of the derived IP — set generously (a multiple of the per-IP burst) so
 * it trips only under a genuine flood, never legitimate multi-client traffic. */
export interface RateLimitConfig {
  readonly query: BucketConfig;
  readonly static: BucketConfig;
  readonly globalQuery: BucketConfig;
  readonly globalStatic: BucketConfig;
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
  /** Charge the per-client (derived-IP) bucket. */
  check(bucket: RateBucket, ip: string): RateDecision;
  /** Charge the header-independent service-wide bucket — the flood ceiling that holds even when the
   * per-IP identity is spoofed or collapses to the shared "unknown" key (Strix vuln-0001). */
  checkGlobal(bucket: RateBucket): RateDecision;
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
    // The service-wide ceiling = per-IP burst × this factor (default 50). Trips only under a flood
    // (distributed or IP-spoofed); a legitimate single client is bounded by the per-IP budget first.
    globalFactor: PosInt.default(50),
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
    globalFactor: "DOCS_RL_GLOBAL_FACTOR",
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
    globalQuery: {
      capacity: c.queryBurst * c.globalFactor,
      windowMs: c.queryWindowSec * 1000,
    },
    globalStatic: {
      capacity: c.staticBurst * c.globalFactor,
      windowMs: c.staticWindowSec * 1000,
    },
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
  readonly #globalQuery: BucketConfig;
  readonly #globalStatic: BucketConfig;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();

  constructor(config: RateLimitConfig, now: () => number = Date.now) {
    this.#query = config.query;
    this.#static = config.static;
    this.#globalQuery = config.globalQuery;
    this.#globalStatic = config.globalStatic;
    this.#maxEntries = config.maxEntries;
    this.#now = now;
  }

  check(bucket: RateBucket, ip: string): RateDecision {
    const cfg = bucket === "query" ? this.#query : this.#static;
    return this.#charge(`${bucket}|${ip}`, cfg);
  }

  checkGlobal(bucket: RateBucket): RateDecision {
    const cfg = bucket === "query" ? this.#globalQuery : this.#globalStatic;
    // A single fixed key per bucket — every request shares it, so it bounds aggregate throughput
    // regardless of the derived client IP (Strix vuln-0001 defense-in-depth).
    return this.#charge(`global|${bucket}`, cfg);
  }

  #charge(key: string, cfg: BucketConfig): RateDecision {
    const now = this.#now();
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
 * Derive the client IP for the rate-limit bucket key. TRUST MODEL (Strix vuln-0001): the ONLY
 * client-IP header Railway's edge OVERWRITES and the client cannot spoof is `X-Real-IP` — Railway's
 * proxy always sets it to the true connecting IP, and the container cannot be reached off-edge to
 * inject one (Railway proxy contract). `X-Envoy-External-Address` and `X-Forwarded-For` are
 * client-appendable — the previous code trusted `X-Envoy-External-Address` first, and the pentest
 * bypassed the limiter by rotating that header to mint a fresh bucket per request (25 rotated-header
 * requests, none 429). Neither is trusted here anymore. If `X-Real-IP` is absent, all such requests
 * collapse onto one shared "unknown" bucket — conservative (collectively throttled), never fail-open
 * per request; the header-independent `checkGlobal` ceiling backstops the collapse.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp !== undefined && realIp.length > 0) return realIp;
  return "unknown";
}
