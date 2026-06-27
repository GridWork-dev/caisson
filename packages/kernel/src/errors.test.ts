import { describe, expect, test } from "bun:test";
import { matchGolden } from "@caisson/testing";
import {
  AuthzError,
  ConflictError,
  InsufficientCreditsError,
  InternalError,
  TenancyError,
  isCaissonError,
  isUniqueViolation,
  toErrorResponse,
} from "./index.ts";

describe("CaissonError model", () => {
  test("each subclass carries a stable code + http status", () => {
    expect(new AuthzError().httpStatus).toBe(403);
    expect(new ConflictError().code).toBe("conflict");
    // Tenancy denial fails closed as 404, never 403 (no cross-tenant existence leak).
    expect(new TenancyError().httpStatus).toBe(404);
    expect(new TenancyError().code).toBe("not_found");
  });

  test("InsufficientCreditsError is 402 with integer required/balance", () => {
    const err = new InsufficientCreditsError(50, 10);
    expect(err.httpStatus).toBe(402);
    expect(err.details).toEqual({ required: 50, balance: 10 });
    expect(isCaissonError(err)).toBe(true);
  });

  test("toErrorResponse renders the 402 credit-gate envelope (golden)", () => {
    matchGolden(
      import.meta.url,
      "insufficient-credits-402",
      toErrorResponse(new InsufficientCreditsError(50, 10)),
    );
  });

  test("an unknown throw collapses to a generic 500 — no leak", () => {
    const out = toErrorResponse(new Error("boom: SELECT * FROM secrets"));
    expect(out.status).toBe(500);
    expect(out.body).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
  });

  test("a CaissonError 500 still does not echo details unless set", () => {
    expect(toErrorResponse(new InternalError())).toEqual({
      status: 500,
      body: {
        error: { code: "internal_error", message: "Internal server error" },
      },
    });
  });

  test("isUniqueViolation detects Postgres 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});
