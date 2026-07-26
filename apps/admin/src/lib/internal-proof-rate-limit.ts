import { TokenBucketLimiter, type RateDecision } from "@caisson/rate-limit";
import { z } from "zod";

const BUCKET = "internal-proof" as const;

function positiveInt(value: string | undefined, fallback: number): number {
  return z.coerce.number().int().positive().catch(fallback).parse(value);
}

export function createInternalProofRateLimit(
  env: Record<string, string | undefined> = process.env,
  now: () => number = Date.now,
): (accountId: string) => RateDecision {
  const windowMs = positiveInt(
    env.CAISSON_PROOF_INTERNAL_RATE_WINDOW_MS,
    60_000,
  );
  const limiter = new TokenBucketLimiter(
    {
      perIp: {
        [BUCKET]: {
          capacity: positiveInt(
            env.CAISSON_PROOF_INTERNAL_ACCOUNT_CAPACITY,
            120,
          ),
          windowMs,
        },
      },
      global: {
        [BUCKET]: {
          capacity: positiveInt(
            env.CAISSON_PROOF_INTERNAL_GLOBAL_CAPACITY,
            1_200,
          ),
          windowMs,
        },
      },
      maxEntries: positiveInt(env.CAISSON_PROOF_INTERNAL_MAX_ACCOUNTS, 10_000),
    },
    now,
  );
  return (accountId) => {
    const account = limiter.check(BUCKET, accountId);
    const global = limiter.checkGlobal(BUCKET);
    return account.allowed && global.allowed
      ? { allowed: true, retryAfterSec: 0 }
      : {
          allowed: false,
          retryAfterSec: Math.max(
            account.allowed ? 0 : account.retryAfterSec,
            global.allowed ? 0 : global.retryAfterSec,
          ),
        };
  };
}

export const checkInternalProofRateLimit = createInternalProofRateLimit();
