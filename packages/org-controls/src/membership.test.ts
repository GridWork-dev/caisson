// The owner-gated membership CARVE (ADR-0257 §1.3), moved here from @caisson-sh/auth's
// membership.integration.test.ts. Proves the manage half (list/add + owner authz) over PGlite RLS.
// Session resolution (resolveUserAccounts/ensurePersonalAccount/selectActiveAccount) stays proven in
// @caisson-sh/auth — this suite composes onto it (ACCOUNT_MEMBER_SCHEMA_SQL + ensurePersonalAccount) to
// seed accounts, then exercises ONLY the carved surface.
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson-sh/testing";
import { AuthzError, ValidationError } from "@caisson-sh/kernel";
import {
  ACCOUNT_MEMBER_SCHEMA_SQL,
  ensurePersonalAccount,
} from "@caisson-sh/auth";

import {
  addAccountMember,
  assertCanManageMembers,
  listAccountMembers,
  removeAccountMember,
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

describe("owner removes a seat (G15)", () => {
  test("an owner removes a seat; the seat no longer belongs to the org account", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await addAccountMember(tp.pg, "owner", "user_a", "user_b", "seat");
    await removeAccountMember(tp.pg, "owner", "user_a", "user_a", "user_b");
    expect(
      (await listAccountMembers(tp.pg, "user_a")).map((m) => m.userId),
    ).toEqual(["user_a"]);
  });

  test("removing a non-member is a no-op, not an error", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await expect(
      removeAccountMember(tp.pg, "owner", "user_a", "user_a", "ghost"),
    ).resolves.toBeUndefined();
  });

  test("removeAccountMember refuses a non-owner actor", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await addAccountMember(tp.pg, "owner", "user_a", "user_b", "seat");
    await expect(
      removeAccountMember(tp.pg, "seat", "user_b", "user_a", "user_a"),
    ).rejects.toBeInstanceOf(AuthzError);
  });

  test("an owner cannot remove themselves", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await expect(
      removeAccountMember(tp.pg, "owner", "user_a", "user_a", "user_a"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      (await listAccountMembers(tp.pg, "user_a")).map((m) => m.userId),
    ).toEqual(["user_a"]);
  });

  test("one owner cannot remove a SECOND owner (WR-02)", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    // A second owner on the same account — addAccountMember accepts role: "owner".
    await addAccountMember(tp.pg, "owner", "user_a", "user_b", "owner");
    await expect(
      removeAccountMember(tp.pg, "owner", "user_a", "user_a", "user_b"),
    ).rejects.toBeInstanceOf(ValidationError);
    // Untouched — the co-owner is still a member.
    expect(
      (await listAccountMembers(tp.pg, "user_a")).map((m) => m.userId).sort(),
    ).toEqual(["user_a", "user_b"]);
  });
});
