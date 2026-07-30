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

  test("a globally-denied request does not consume the account's token", () => {
    let t = 0;
    const check = createInternalProofRateLimit(
      {
        CAISSON_PROOF_INTERNAL_ACCOUNT_CAPACITY: "2",
        CAISSON_PROOF_INTERNAL_GLOBAL_CAPACITY: "2",
        CAISSON_PROOF_INTERNAL_RATE_WINDOW_MS: "60000",
      },
      () => t,
    );
    expect(check("filler").allowed).toBe(true); // t=0: global window opens
    t = 30_000;
    expect(check("account-a").allowed).toBe(true); // account-a window opens mid-global-window
    t = 30_001;
    expect(check("account-a").allowed).toBe(false); // global ceiling hit — must not charge account-a
    t = 60_000; // global window resets; account-a's window (til 90s) does not
    expect(check("account-a").allowed).toBe(true); // its second token is still there
  });
});
