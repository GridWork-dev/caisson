// ADR-0176 org account model — SESSION-RESOLUTION half only (ADR-0257 §1.3 carve). This suite is the
// regression proof that a buyer login resolves accounts with ZERO @caisson-sh/org-controls involvement:
// it imports only the open session-resolution surface (`resolveUserAccounts` / `ensurePersonalAccount`
// / `selectActiveAccount`) — never the carved MANAGE surface — and every assertion is the exact
// getSession() path (apps/site lib/auth.ts). If org-controls ever became load-bearing on login, this
// file would fail to compile (it does not depend on that package at all). The MANAGE-surface tests
// (list/add/owner-authz) moved to packages/org-controls/src/membership.test.ts.
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { newTestPg, type TestPg } from "@caisson-sh/testing";

import {
  ACCOUNT_MEMBER_SCHEMA_SQL,
  ensurePersonalAccount,
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

describe("session resolution needs zero org-controls (login path)", () => {
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

  test("full getSession() resolution: personal account, selected, no manage surface touched", async () => {
    // Mirrors apps/site lib/auth.ts resolveActiveAccount end-to-end using ONLY the open surface.
    await ensurePersonalAccount(tp.pg, "user_a");
    const memberships = await resolveUserAccounts(tp.pg, "user_a");
    const active = selectActiveAccount(memberships);
    expect(active).toEqual({
      accountId: "user_a",
      userId: "user_a",
      role: "owner",
    });
  });
});

describe("active-account selection (pure)", () => {
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
