// src/rate-limit.ts — docs-service rate-limit wiring: bucket names, env-driven config, and the
// service's own TokenBucketLimiter constructor shape. The shared fixed-window token-bucket mechanics
// (charge/prune + clientIp) live in @caisson/rate-limit — this file was previously a near-verbatim
// duplicate of services/license/src/rate-limit.ts (same class, same clientIp, differing only in
// bucket names and env-var prefixes); both now import the shared mechanics down.
//
// WHY a separate per-IP limiter (not the account-scoped store also in @caisson/rate-limit): the docs
// service has NO account — `/llms*.txt` is an unauth scrape surface and `/query` is unauth-floodable
// spend (live OpenRouter embedding $ per hit). services/docs is a GREY origin (no Cloudflare WAF)
// reachable at `*.up.railway.app`, so the only available identity is the client IP.
import { z } from "zod";
import {
  TokenBucketLimiter as SharedTokenBucketLimiter,
  clientIp,
  type BucketConfig,
  type RateDecision,
  type RateLimiter,
} from "@caisson/rate-limit";

export type { BucketConfig, RateDecision, RateLimiter };
export { clientIp };

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
  /** Authorized-caller (valid-Bearer) budget for POST /query — bigger than the anonymous
   * `query` bucket, because a single authorized caller's egress IP can front many distinct
   * real end-users (e.g. the support-bot's whole Discord community shares one Railway IP)
   * who would otherwise all squeeze into one small anonymous per-IP bucket (G22 follow-up:
   * "a bot-specific higher-budget lane", buyer-lifecycle-map.md). Optional — when omitted, the
   * caller gets an INDEPENDENT bucket of the same size as `query` (buckets are keyed
   * `${bucket}|${ip}`, so `trustedQuery` and `query` never share tokens even at equal size), so
   * a caller that doesn't care about the trusted lane (an existing test literal, e.g.) sees
   * unchanged per-request behavior. */
  readonly trustedQuery?: BucketConfig;
  /** Header-independent service-wide ceiling for the trusted lane (Strix vuln-0001 defense-in-
   * depth, mirroring `globalQuery`). Optional — when omitted, an independent ceiling of the same
   * size as `globalQuery`. */
  readonly globalTrustedQuery?: BucketConfig;
  /** Hard cap on distinct (bucket,ip) entries held in memory before prune evicts. */
  readonly maxEntries: number;
}

/** Which route-class budget to charge a request against. `trustedQuery` is the authorized-
 * caller lane for POST /query (see `RateLimitConfig.trustedQuery`). */
export type RateBucket = "query" | "static" | "trustedQuery";

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
    // The authorized-caller (valid-Bearer) query budget = queryBurst × this factor (default 10,
    // same window as queryWindowSec). G22 follow-up "bot-specific higher-budget lane" — the
    // support-bot is the sole holder of DOCS_SERVICE_TOKEN today, so this is its lane.
    trustedFactor: PosInt.default(10),
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
    trustedFactor: "DOCS_RL_TRUSTED_FACTOR",
    maxEntries: "DOCS_RL_MAX_ENTRIES",
  };
  for (const [key, envName] of Object.entries(map)) {
    const v = present(env[envName]);
    if (v !== undefined) raw[key] = v;
  }
  const c = EnvSchema.parse(raw);
  const trustedQueryCapacity = c.queryBurst * c.trustedFactor;
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
    trustedQuery: {
      capacity: trustedQueryCapacity,
      windowMs: c.queryWindowSec * 1000,
    },
    globalTrustedQuery: {
      capacity: trustedQueryCapacity * c.globalFactor,
      windowMs: c.queryWindowSec * 1000,
    },
    maxEntries: c.maxEntries,
  };
}

/**
 * Docs-service adapter over the shared generic `TokenBucketLimiter<RateBucket>`: takes this
 * service's own flat `RateLimitConfig` shape (the shape `loadRateLimitConfig` returns, and every
 * existing call site + test already constructs) and reshapes it into the shared class's
 * per-bucket-name config on construction. All charge/prune/global-ceiling behavior is the shared
 * mechanics — this class adds no logic of its own.
 */
export class TokenBucketLimiter extends SharedTokenBucketLimiter<RateBucket> {
  constructor(config: RateLimitConfig, now: () => number = Date.now) {
    super(
      {
        perIp: {
          query: config.query,
          static: config.static,
          trustedQuery: config.trustedQuery ?? config.query,
        },
        global: {
          query: config.globalQuery,
          static: config.globalStatic,
          trustedQuery: config.globalTrustedQuery ?? config.globalQuery,
        },
        maxEntries: config.maxEntries,
      },
      now,
    );
  }
}
