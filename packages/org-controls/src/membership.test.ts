// The owner-gated membership CARVE (ADR-0257 §1.3), moved here from @caisson/auth's
// membership.integration.test.ts. Proves the manage half (list/add + owner authz) over PGlite RLS.
// Session resolution (resolveUserAccounts/ensurePersonalAccount/selectActiveAccount) stays proven in
// @caisson/auth — this suite composes onto it (ACCOUNT_MEMBER_SCHEMA_SQL + ensurePersonalAccount) to
// seed accounts, then exercises ONLY the carved surface.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson/testing";
import { AuthzError } from "@caisson/kernel";
import {
  ACCOUNT_MEMBER_SCHEMA_SQL,
  ensurePersonalAccount,
} from "@caisson/auth";

import {
  addAccountMember,
  assertCanManageMembers,
  listAccountMembers,
} from "./index.ts";

let tp: TestPg;

async function freshSchema(): Promise<void> {
  await tp.exec(`DROP TABLE IF EXISTS account_member;`);
  await tp.exec(ACCOUNT_MEMBER_SCHEMA_SQL);
}

beforeEach(async () => {
  if (!tp) tp = await newTestPg();
  await freshSchema();
});

afterAll(async () => {
  await tp.close();
});

describe("owner adds a seat", () => {
  test("an owner adds a seat; the seat then belongs to the org account", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await addAccountMember(tp.pg, "owner", "user_a", "user_b", "seat");
    expect(
      (await listAccountMembers(tp.pg, "user_a")).map((m) => m.userId).sort(),
    ).toEqual(["user_a", "user_b"]);
  });

  test("member-list is tenant-isolated (account A cannot see account B's members)", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await ensurePersonalAccount(tp.pg, "user_b");
    await addAccountMember(tp.pg, "owner", "user_a", "seat_1", "seat");
    expect(
      (await listAccountMembers(tp.pg, "user_a")).map((m) => m.userId).sort(),
    ).toEqual(["seat_1", "user_a"]);
    // A's seat_1 is invisible to B — the account clause is scoped to the bound account GUC.
    expect(
      (await listAccountMembers(tp.pg, "user_b")).map((m) => m.userId),
    ).toEqual(["user_b"]);
  });
});

describe("owner authz", () => {
  test("only an owner can manage members", () => {
    expect(() => assertCanManageMembers("seat")).toThrow(AuthzError);
    expect(() => assertCanManageMembers("owner")).not.toThrow();
  });

  test("addAccountMember refuses a non-owner actor", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await expect(
      addAccountMember(tp.pg, "seat", "user_a", "user_x"),
    ).rejects.toBeInstanceOf(AuthzError);
  });
});
