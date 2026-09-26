// src/rate-limit.ts — license-service rate-limit wiring: bucket names, env-driven config, and the
// service's own TokenBucketLimiter constructor shape. The shared fixed-window token-bucket mechanics
// (charge/prune + clientIp) live in @caisson/rate-limit — this file was previously a near-verbatim
// duplicate of services/docs/src/rate-limit.ts (same class, same clientIp, differing only in bucket
// names and env-var prefixes); both now import the shared mechanics down.
//
// WHY per-IP (and not the account-scoped store also in @caisson/rate-limit): POST /webhook is hit by
// Paddle (and anyone else on the grey `*.up.railway.app` origin) BEFORE the signature is verified, and
// POST /issue is bearer-gated but the limiter is defense-in-depth that must apply BEFORE the bearer
// check absorbs an unauthenticated flood. The only identity available pre-auth is the client IP.
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

/** Validated limiter config: one budget per route class plus a hard cap on tracked (bucket,ip) entries.
 * `globalWebhook`/`globalIssue` are the header-INDEPENDENT service-wide ceilings (Strix vuln-0001
 * defense-in-depth): a per-IP key is only as trustworthy as the IP signal, so a second bucket bounds
 * total throughput regardless of the derived IP — generous (a multiple of the per-IP burst) so it
 * trips only under a genuine flood, never legitimate multi-client traffic. */
export interface RateLimitConfig {
  readonly webhook: BucketConfig;
  readonly issue: BucketConfig;
  readonly globalWebhook: BucketConfig;
  readonly globalIssue: BucketConfig;
  /** Hard cap on distinct (bucket,ip) entries held in memory before prune evicts. */
  readonly maxEntries: number;
}

/** Which route-class budget to charge a request against. */
export type RateBucket = "webhook" | "issue";

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
    webhookBurst: "LICENSE_RL_WEBHOOK_BURST",
    webhookWindowSec: "LICENSE_RL_WEBHOOK_WINDOW_SEC",
    issueBurst: "LICENSE_RL_ISSUE_BURST",
    issueWindowSec: "LICENSE_RL_ISSUE_WINDOW_SEC",
    globalFactor: "LICENSE_RL_GLOBAL_FACTOR",
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
    globalWebhook: {
      capacity: c.webhookBurst * c.globalFactor,
      windowMs: c.webhookWindowSec * 1000,
    },
    globalIssue: {
      capacity: c.issueBurst * c.globalFactor,
      windowMs: c.issueWindowSec * 1000,
    },
    maxEntries: c.maxEntries,
  };
}

/**
 * License-service adapter over the shared generic `TokenBucketLimiter<RateBucket>`: takes this
 * service's own flat `RateLimitConfig` shape (the shape `loadRateLimitConfig` returns, and every
 * existing call site + test already constructs) and reshapes it into the shared class's
 * per-bucket-name config on construction. All charge/prune/global-ceiling behavior is the shared
 * mechanics — this class adds no logic of its own.
 */
export class TokenBucketLimiter extends SharedTokenBucketLimiter<RateBucket> {
  constructor(config: RateLimitConfig, now: () => number = Date.now) {
    super(
      {
        perIp: { webhook: config.webhook, issue: config.issue },
        global: { webhook: config.globalWebhook, issue: config.globalIssue },
        maxEntries: config.maxEntries,
      },
      now,
    );
  }
}
