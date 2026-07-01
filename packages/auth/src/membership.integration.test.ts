// ADR-0176 org account model: account_member resolution, dual-GUC RLS isolation (login path via
// withUser, member-list path via withTenant), and owner-only authz. Composes @caisson/tenancy-rls on
// PGlite (the credits.integration.test.ts harness).
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { newTestPg, type TestPg } from "@caisson/testing";
import { AuthzError } from "@caisson/kernel";

import {
  ACCOUNT_MEMBER_SCHEMA_SQL,
  addAccountMember,
  assertCanManageMembers,
  ensurePersonalAccount,
  listAccountMembers,
  resolveUserAccounts,
  selectActiveAccount,
} from "./index.ts";
import type { AccountMembership } from "./membership.ts";

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

describe("account_member resolution + RLS isolation", () => {
  test("first sign-in creates a personal account (idempotent)", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await ensurePersonalAccount(tp.pg, "user_a"); // second call is a no-op
    expect(await resolveUserAccounts(tp.pg, "user_a")).toEqual([
      { accountId: "user_a", userId: "user_a", role: "owner" },
    ]);
  });

  test("a user resolves ONLY their own memberships (login-path isolation via withUser)", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await ensurePersonalAccount(tp.pg, "user_b");
    expect(
      (await resolveUserAccounts(tp.pg, "user_a")).map((m) => m.accountId),
    ).toEqual(["user_a"]);
    expect(
      (await resolveUserAccounts(tp.pg, "user_b")).map((m) => m.accountId),
    ).toEqual(["user_b"]);
  });

  test("an owner adds a seat; the seat then belongs to the org account", async () => {
    await ensurePersonalAccount(tp.pg, "user_a");
    await addAccountMember(tp.pg, "owner", "user_a", "user_b", "seat");
    expect(await resolveUserAccounts(tp.pg, "user_b")).toContainEqual({
      accountId: "user_a",
      userId: "user_b",
      role: "seat",
    });
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

describe("owner authz + active-account selection", () => {
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

  const M = (
    accountId: string,
    userId: string,
    role: "owner" | "seat" = "owner",
  ): AccountMembership => ({ accountId, userId, role });

  test("selectActiveAccount: a valid requested account wins", () => {
    const ms = [M("user_a", "user_a"), M("org_1", "user_a", "seat")];
    expect(selectActiveAccount(ms, "org_1")?.accountId).toBe("org_1");
  });

  test("selectActiveAccount: defaults to the personal account", () => {
    const ms = [M("org_1", "user_a", "seat"), M("user_a", "user_a")];
    expect(selectActiveAccount(ms)?.accountId).toBe("user_a");
  });

  test("selectActiveAccount: falls back to the first membership", () => {
    const ms = [M("org_1", "user_a", "seat"), M("org_2", "user_a", "seat")];
    expect(selectActiveAccount(ms, "nope")?.accountId).toBe("org_1");
  });

  test("selectActiveAccount: null when the user has no memberships", () => {
    expect(selectActiveAccount([])).toBeNull();
  });
});
