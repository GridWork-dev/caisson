import { describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson-sh/kernel";
import { createPgPool, type PgPoolPurpose } from "./pool.ts";

function optionsFor(purpose: PgPoolPurpose): Record<string, unknown> {
  const pool = createPgPool("postgres://user:pass@example.test:5432/db", {
    purpose,
  });
  expect(pool.totalCount).toBe(0);
  expect(pool.listenerCount("error")).toBe(1);
  const options = pool.options as unknown as Record<string, unknown>;
  void pool.end();
  return options;
}

describe("createPgPool", () => {
  test("applies the bounded Cloud Run runtime envelope", () => {
    expect(optionsFor("runtime")).toMatchObject({
      max: 2,
      min: 0,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 4_000,
      statement_timeout: 25_000,
      query_timeout: 28_000,
      idle_in_transaction_session_timeout: 25_000,
    });
  });

  test("caps direct migration jobs at one connection", () => {
    expect(optionsFor("migration")).toMatchObject({
      max: 1,
      min: 0,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 300_000,
      query_timeout: 310_000,
      idle_in_transaction_session_timeout: 60_000,
    });
  });

  test("rejects an empty connection string before constructing a pool", () => {
    expect(() => createPgPool("   ")).toThrow(ConfigError);
  });
});
