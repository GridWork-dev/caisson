import { describe, expect, test } from "bun:test";
import { createAdminAuditWindowRateLimit } from "./admin-audit-window-rate-limit.ts";

describe("admin audit-window rate limiter", () => {
  test("bounds one actor/account window and the global read budget", () => {
    const perTarget = createAdminAuditWindowRateLimit(
      {
        CAISSON_ADMIN_AUDIT_WINDOW_CAPACITY: "1",
        CAISSON_ADMIN_AUDIT_WINDOW_GLOBAL_CAPACITY: "2",
        CAISSON_ADMIN_AUDIT_WINDOW_RATE_WINDOW_MS: "60000",
      },
      () => 0,
    );

    expect(perTarget("op@example.com", "acct_a").allowed).toBe(true);
    expect(perTarget("op@example.com", "acct_a").allowed).toBe(false);
    expect(perTarget("op@example.com", "acct_b").allowed).toBe(false);
  });
});
