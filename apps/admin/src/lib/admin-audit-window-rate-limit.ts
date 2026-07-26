import { TokenBucketLimiter, type RateDecision } from "@caisson/rate-limit";
import { z } from "zod";

const BUCKET = "admin-audit-window" as const;

function positiveInt(value: string | undefined, fallback: number): number {
  return z.coerce.number().int().positive().catch(fallback).parse(value);
}

/**
 * Bounds full-chain reads by verified actor + target account and globally. One allowed request may
 * fan out to 250 immutable-object reads, so this budget is intentionally tighter than per-row proof
 * reads.
 */
export function createAdminAuditWindowRateLimit(
  env: Record<string, string | undefined> = process.env,
  now: () => number = Date.now,
): (actor: string, accountId: string) => RateDecision {
  const windowMs = positiveInt(
    env.CAISSON_ADMIN_AUDIT_WINDOW_RATE_WINDOW_MS,
    60_000,
  );
  const limiter = new TokenBucketLimiter(
    {
      perIp: {
        [BUCKET]: {
          capacity: positiveInt(env.CAISSON_ADMIN_AUDIT_WINDOW_CAPACITY, 6),
          windowMs,
        },
      },
      global: {
        [BUCKET]: {
          capacity: positiveInt(
            env.CAISSON_ADMIN_AUDIT_WINDOW_GLOBAL_CAPACITY,
            60,
          ),
          windowMs,
        },
      },
      maxEntries: positiveInt(
        env.CAISSON_ADMIN_AUDIT_WINDOW_MAX_TARGETS,
        10_000,
      ),
    },
    now,
  );

  return (actor, accountId) => {
    const target = limiter.check(BUCKET, `${actor}|${accountId}`);
    const global = limiter.checkGlobal(BUCKET);
    return target.allowed && global.allowed
      ? { allowed: true, retryAfterSec: 0 }
      : {
          allowed: false,
          retryAfterSec: Math.max(
            target.allowed ? 0 : target.retryAfterSec,
            global.allowed ? 0 : global.retryAfterSec,
          ),
        };
  };
}

export const checkAdminAuditWindowRateLimit = createAdminAuditWindowRateLimit();
