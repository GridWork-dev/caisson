// Unit coverage for `wrapSessionAdapter` against a minimal stub `DBAdapter` (no real Kysely/DB) —
// the end-to-end sign-in flow in `auth-server.test.ts` never exercises `updateMany` (better-auth's
// session refresh path uses singular `update`), so this is the direct test for the SHIP-audit P3
// fix: `updateMany`'s `update.token` must be hashed exactly like `update`'s, never passed through.
import { expect, test } from "bun:test";
import type { DBAdapter } from "better-auth/types";
import { deriveTokenLookupKey } from "@caisson/auth";
import { wrapSessionAdapter } from "./session-adapter.ts";

const HMAC_KEY = "test-hmac-key-value-at-least-32-characters-long";

function stubAdapter(overrides: Partial<DBAdapter> = {}): {
  calls: unknown[];
  adapter: DBAdapter;
} {
  const calls: unknown[] = [];
  const notImplemented = (name: string) => () => {
    throw new Error(`stub adapter: ${name} not implemented for this test`);
  };
  const base: DBAdapter = {
    id: "stub",
    create: notImplemented("create") as DBAdapter["create"],
    findOne: notImplemented("findOne") as DBAdapter["findOne"],
    findMany: notImplemented("findMany") as DBAdapter["findMany"],
    count: notImplemented("count") as DBAdapter["count"],
    update: notImplemented("update") as DBAdapter["update"],
    updateMany: (async (data: unknown) => {
      calls.push(data);
      return 1;
    }) as DBAdapter["updateMany"],
    delete: notImplemented("delete") as DBAdapter["delete"],
    deleteMany: notImplemented("deleteMany") as DBAdapter["deleteMany"],
    consumeOne: notImplemented("consumeOne") as DBAdapter["consumeOne"],
    incrementOne: notImplemented("incrementOne") as DBAdapter["incrementOne"],
    transaction: notImplemented("transaction") as DBAdapter["transaction"],
    ...overrides,
  };
  return { calls, adapter: base };
}

test("updateMany hashes a raw `token` in the update payload — never passes it through unhashed", async () => {
  const { calls, adapter } = stubAdapter();
  const wrapped = wrapSessionAdapter(adapter, HMAC_KEY);

  const rawToken = "raw-session-token-value";
  await wrapped.updateMany({
    model: "session",
    where: [{ field: "userId", value: "user-1" }],
    update: { token: rawToken, updatedAt: new Date(0) },
  });

  expect(calls).toHaveLength(1);
  const forwarded = calls[0] as { update: { token: unknown } };
  expect(forwarded.update.token).toBe(deriveTokenLookupKey(rawToken, HMAC_KEY));
  expect(forwarded.update.token).not.toBe(rawToken);
});

test("updateMany passes a token-free update straight through unchanged", async () => {
  const { calls, adapter } = stubAdapter();
  const wrapped = wrapSessionAdapter(adapter, HMAC_KEY);

  await wrapped.updateMany({
    model: "session",
    where: [{ field: "userId", value: "user-1" }],
    update: { updatedAt: new Date(0) },
  });

  expect(calls).toHaveLength(1);
  expect((calls[0] as { update: unknown }).update).toEqual({
    updatedAt: new Date(0),
  });
});

test("updateMany on a non-session model passes straight through untouched", async () => {
  const { calls, adapter } = stubAdapter();
  const wrapped = wrapSessionAdapter(adapter, HMAC_KEY);

  await wrapped.updateMany({
    model: "user",
    where: [{ field: "id", value: "user-1" }],
    update: { token: "not-actually-a-session-token" },
  });

  expect(calls).toHaveLength(1);
  expect((calls[0] as { update: { token: unknown } }).update.token).toBe(
    "not-actually-a-session-token",
  );
});
