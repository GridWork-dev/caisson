import { describe, expect, test } from "bun:test";
import { createInternalProofRateLimit } from "./internal-proof-rate-limit.ts";

describe("internal proof backstop rate limiter", () => {
  test("enforces independent per-account and service-global ceilings", () => {
    const perAccount = createInternalProofRateLimit({
      CAISSON_PROOF_INTERNAL_ACCOUNT_CAPACITY: "1",
      CAISSON_PROOF_INTERNAL_GLOBAL_CAPACITY: "10",
      CAISSON_PROOF_INTERNAL_RATE_WINDOW_MS: "60000",
    });
    expect(perAccount("account-a").allowed).toBe(true);
    expect(perAccount("account-a")).toEqual({
      allowed: false,
      retryAfterSec: 60,
    });
    expect(perAccount("account-b").allowed).toBe(true);

    const global = createInternalProofRateLimit({
      CAISSON_PROOF_INTERNAL_ACCOUNT_CAPACITY: "10",
      CAISSON_PROOF_INTERNAL_GLOBAL_CAPACITY: "2",
      CAISSON_PROOF_INTERNAL_RATE_WINDOW_MS: "60000",
    });
    expect(global("account-a").allowed).toBe(true);
    expect(global("account-b").allowed).toBe(true);
    expect(global("account-c")).toEqual({
      allowed: false,
      retryAfterSec: 60,
    });
  });
});
