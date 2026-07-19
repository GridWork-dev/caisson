// ADR-0366 lock 3: the hard-cutover legacy-row invalidation, run against a real Postgres (PGlite)
// — proves the deploy-time cutover removes exactly the pre-wrap raw-token rows (better-auth's
// `generateId(32)`, 32 characters) and never touches a valid post-cutover HMAC lookup key (64
// lowercase hex characters), and that a second run is a no-op (safe to run on every deploy).
import { afterAll, beforeAll, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { cutoverLegacySessionTokens } from "./deploy-migrate.ts";

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(
    "CREATE TABLE session (id text PRIMARY KEY, token text UNIQUE NOT NULL)",
  );
  await tp.pg.query(
    "INSERT INTO session (id, token) VALUES ($1, $2), ($3, $4), ($5, $6)",
    [
      "legacy-1",
      "a".repeat(32), // pre-wrap raw token shape (better-auth generateId(32))
      "legacy-2",
      "B3nQ7xR2mZ9pL4wK6vD1sT8yA5", // 26 chars — also not a 64-hex lookup key
      "hashed-1",
      "b".repeat(64), // ADR-0366 HMAC-SHA-256 lookup key shape
    ],
  );
});

afterAll(async () => {
  await tp.close();
});

test("removes every legacy raw-token row, keeps the valid hashed row", async () => {
  const removed = await cutoverLegacySessionTokens((sql) =>
    tp.query(sql).then((rows) => ({ rows })),
  );
  expect(removed).toBe(2);

  const remaining = await tp.query<{ id: string; token: string }>(
    "SELECT id, token FROM session ORDER BY id",
  );
  expect(remaining).toEqual([{ id: "hashed-1", token: "b".repeat(64) }]);
});

test("a second run is a no-op — safe to run on every deploy forever", async () => {
  const removed = await cutoverLegacySessionTokens((sql) =>
    tp.query(sql).then((rows) => ({ rows })),
  );
  expect(removed).toBe(0);

  const remaining = await tp.query<{ id: string }>("SELECT id FROM session");
  expect(remaining).toEqual([{ id: "hashed-1" }]);
});
