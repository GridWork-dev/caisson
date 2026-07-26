import { describe, expect, test } from "bun:test";
import { createTenantEvidenceRateLimit } from "./tenant-evidence-rate-limit.ts";

describe("tenant evidence proof rate limiter", () => {
  test("enforces independent per-account and service-global ceilings", () => {
    const perAccount = createTenantEvidenceRateLimit({
      CAISSON_PROOF_ACCOUNT_CAPACITY: "1",
      CAISSON_PROOF_GLOBAL_CAPACITY: "10",
      CAISSON_PROOF_RATE_WINDOW_MS: "60000",
    });
    expect(perAccount("account-a").allowed).toBe(true);
    expect(perAccount("account-a")).toEqual({
      allowed: false,
      retryAfterSec: 60,
    });
    expect(perAccount("account-b").allowed).toBe(true);

    const global = createTenantEvidenceRateLimit({
      CAISSON_PROOF_ACCOUNT_CAPACITY: "10",
      CAISSON_PROOF_GLOBAL_CAPACITY: "2",
      CAISSON_PROOF_RATE_WINDOW_MS: "60000",
    });
    expect(global("account-a").allowed).toBe(true);
    expect(global("account-b").allowed).toBe(true);
    expect(global("account-c")).toEqual({
      allowed: false,
      retryAfterSec: 60,
    });
  });
});
