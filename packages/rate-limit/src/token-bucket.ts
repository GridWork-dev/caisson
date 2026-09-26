// src/token-bucket.ts — the shared in-memory per-IP token-bucket limiter mechanics, extracted out
// of two near-identical service-local copies (each carried its own TokenBucketLimiter/clientIp
// with only the bucket names and env-var prefixes differing). Every
// consuming service still owns its OWN bucket-name union + env-driven config loader (that shape is
// genuinely per-service); only the shared charge/prune mechanics and the client-IP derivation move
// here, generic over the caller's bucket-name type `B`.
//
// WHY per-IP: an account-scoped throttle (see account-store.ts / account-hook.ts in this same
// package) only works once a caller is authenticated; an unauth surface (a public webhook receiver,
// an unauth scrape endpoint) has no account to key on, so the client IP is the only identity
// available pre-auth. This is an in-process, single-instance limiter (fine for one replica); a
// multi-replica deploy needs a shared store — tracked as a follow-up by each consuming service.
//
// The bucket is a fixed-window token bucket: each (bucket,ip) holds `tokens` that reset to
// `capacity` at the `resetAt` window boundary. Bounded map size + prune-on-insert keep memory flat
// under a spray of distinct source IPs. This implementation does not throw on its hot path; callers
// still declare an explicit infrastructure-failure policy because injected or future shared-store
// implementations can fail. Availability-sensitive routes may fail open, while protected routes
// can fail closed.
export interface BucketConfig {
  /** Burst capacity = max requests allowed within one window. */
  readonly capacity: number;
  /** Window length in ms; tokens reset to `capacity` when it elapses. */
  readonly windowMs: number;
}

/** Limiter verdict. `retryAfterSec` is meaningful only when `allowed` is false. */
export interface RateDecision {
  readonly allowed: boolean;
  readonly retryAfterSec: number;
}

export interface RateLimiter<B extends string = string> {
  /** Charge the per-client (derived-IP) bucket. */
  check(bucket: B, ip: string): RateDecision;
  /** Charge the header-independent service-wide bucket — the flood ceiling that holds even when the
   * per-IP identity is spoofed or collapses to the shared "unknown" key. */
  checkGlobal(bucket: B): RateDecision;
}

/** Constructor input for `TokenBucketLimiter`: a per-IP + a header-independent global budget for
 * every bucket name `B` the caller declares, plus a hard cap on tracked (bucket,ip) map entries. */
export interface TokenBucketLimiterConfig<B extends string> {
  readonly perIp: Record<B, BucketConfig>;
  readonly global: Record<B, BucketConfig>;
  /** Hard cap on distinct (bucket,ip) entries held in memory before prune evicts. */
  readonly maxEntries: number;
}

interface Entry {
  tokens: number;
  resetAt: number;
}

/**
 * In-memory fixed-window token bucket, generic over the caller's bucket-name union `B`. `now` is
 * injectable so tests can advance the clock deterministically (no `sleep`). Map keys are
 * `${bucket}|${ip}`; insertion order gives an approximate-FIFO eviction order for the overflow prune.
 */
export class TokenBucketLimiter<B extends string> implements RateLimiter<B> {
  readonly #perIp: Record<B, BucketConfig>;
  readonly #global: Record<B, BucketConfig>;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, Entry>();

  constructor(
    config: TokenBucketLimiterConfig<B>,
    now: () => number = Date.now,
  ) {
    this.#perIp = config.perIp;
    this.#global = config.global;
    this.#maxEntries = config.maxEntries;
    this.#now = now;
  }

  check(bucket: B, ip: string): RateDecision {
    return this.#charge(`${bucket}|${ip}`, this.#perIp[bucket]);
  }

  checkGlobal(bucket: B): RateDecision {
    // A single fixed key per bucket — every request shares it, so it bounds aggregate throughput
    // regardless of the derived client IP.
    return this.#charge(`global|${bucket}`, this.#global[bucket]);
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
 * Derive the client IP for the rate-limit bucket key. TRUST MODEL: the ONLY client-IP header
 * Railway's edge OVERWRITES and the client cannot spoof is `X-Real-IP` — Railway's proxy always sets
 * it to the true connecting IP, and the container cannot be reached off-edge to inject one. Any other
 * forwarded-for style header is client-appendable and MUST NOT be trusted for this purpose (a prior
 * pentest bypassed an earlier version of this limiter by rotating a spoofable header to mint a fresh
 * bucket per request). If `X-Real-IP` is absent, all such requests collapse onto one shared "unknown"
 * bucket — conservative (collectively throttled), never fail-open per request; a header-independent
 * `checkGlobal` ceiling backstops the collapse.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp !== undefined && realIp.length > 0) return realIp;
  return "unknown";
}
