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
    // Charge the global flood ceiling first (release-audit v2026.07.27.1 F5): a globally-denied
    // request must not also consume the account's own token.
    const global = limiter.checkGlobal(BUCKET);
    if (!global.allowed) return global;
    return limiter.check(BUCKET, accountId);
  };
}

export const checkInternalProofRateLimit = createInternalProofRateLimit();
