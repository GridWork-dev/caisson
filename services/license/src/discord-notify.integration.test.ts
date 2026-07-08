// The post-grant Discord push (ADR-0203): identity resolution over the REAL account_member DDL
// (dual-GUC RLS, ADR-0176) + a better-auth-shaped `account` provider-link table, and the
// never-throws push contract. The `account` DDL here is a TEST DOUBLE of better-auth's own
// migrator output (camelCase quoted columns — its documented core schema); the deploy migrator
// creates the real one (apps/site/lib/deploy-migrate.ts runs better-auth's getMigrations).
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { ACCOUNT_MEMBER_SCHEMA_SQL } from "@caisson/auth";
import type { fetchWithTimeout } from "@caisson/kernel";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  findDiscordUserIds,
  loadDiscordNotifyConfig,
  notifyDiscordGrant,
} from "./discord-notify.ts";

const BETTER_AUTH_ACCOUNT_DDL = `
CREATE TABLE "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL
);
`;

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ACCOUNT_MEMBER_SCHEMA_SQL);
  await tp.exec(BETTER_AUTH_ACCOUNT_DDL);

  // An ORG account with two members: one linked Discord, one linked GitHub only.
  await withTenant(tp.pg, "acct_org", async (tx) => {
    await tx.query(
      `INSERT INTO account_member (account_id, user_id, role) VALUES
         ('acct_org', 'user_owner', 'owner'),
         ('acct_org', 'user_seat', 'seat')`,
    );
  });
  await tp.pg.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO "account" ("id", "accountId", "providerId", "userId") VALUES
         ('ba_1', 'discord_111', 'discord', 'user_owner'),
         ('ba_2', 'gh_222',      'github',  'user_seat'),
         ('ba_3', 'discord_333', 'discord', 'user_personal')`,
    );
  });
});
afterAll(async () => {
  await tp.close();
});

describe("findDiscordUserIds (ADR-0203 identity resolution)", () => {
  test("resolves an org account's members to their linked discord ids only", async () => {
    expect(await findDiscordUserIds(tp.pg, "acct_org")).toEqual([
      "discord_111",
    ]);
  });

  test("personal-account fallback: no membership row ⇒ account_id IS the user id", async () => {
    // 'user_personal' has no account_member row — the personal-account invariant
    // (account_id == user_id, apps/site resolveActiveAccount) must still find its link.
    expect(await findDiscordUserIds(tp.pg, "user_personal")).toEqual([
      "discord_333",
    ]);
  });

  test("an account with no links resolves to [] (push becomes a no-op)", async () => {
    expect(await findDiscordUserIds(tp.pg, "acct_unlinked")).toEqual([]);
  });
});

type FetchImpl = typeof fetchWithTimeout;

function recordingFetch(
  status: number,
  calls: Array<{ url: string; auth: string; body: unknown }>,
): FetchImpl {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      auth: headers.get("authorization") ?? "",
      body: JSON.parse(String(init?.body)),
    });
    return new Response("{}", { status });
  };
}

describe("notifyDiscordGrant (never-throws push)", () => {
  const config = { url: "https://bot.test", token: "tok_grant" };

  test("POSTs one grant per linked discord user with the Bearer + verbatim entitlements", async () => {
    const calls: Array<{ url: string; auth: string; body: unknown }> = [];
    await notifyDiscordGrant(
      tp.pg,
      config,
      { accountId: "acct_org", entitlements: ["bundle"] },
      recordingFetch(200, calls),
    );
    expect(calls).toEqual([
      {
        url: "https://bot.test/billing-grant",
        auth: "Bearer tok_grant",
        body: { discord_user_id: "discord_111", entitlements: ["bundle"] },
      },
    ]);
  });

  test("an unlinked account pushes nothing", async () => {
    const calls: Array<{ url: string; auth: string; body: unknown }> = [];
    await notifyDiscordGrant(
      tp.pg,
      config,
      { accountId: "acct_unlinked", entitlements: ["compliance"] },
      recordingFetch(200, calls),
    );
    expect(calls).toEqual([]);
  });

  test("a non-2xx bot response never throws", async () => {
    const calls: Array<{ url: string; auth: string; body: unknown }> = [];
    await notifyDiscordGrant(
      tp.pg,
      config,
      { accountId: "acct_org", entitlements: ["compliance"] },
      recordingFetch(502, calls),
    );
    expect(calls).toHaveLength(1); // attempted, failed, swallowed
  });

  test("a throwing fetch never throws out", async () => {
    const boom: FetchImpl = async () => {
      throw new Error("network down");
    };
    await notifyDiscordGrant(
      tp.pg,
      config,
      { accountId: "acct_org", entitlements: ["compliance"] },
      boom,
    );
  });

  test("a failing identity lookup (missing better-auth tables) never throws out", async () => {
    const fresh = await newTestPg(); // no account/account_member tables at all
    try {
      const calls: Array<{ url: string; auth: string; body: unknown }> = [];
      await notifyDiscordGrant(
        fresh.pg,
        config,
        { accountId: "acct_org", entitlements: ["compliance"] },
        recordingFetch(200, calls),
      );
      expect(calls).toEqual([]);
    } finally {
      await fresh.close();
    }
  });
});

describe("loadDiscordNotifyConfig (config gating)", () => {
  test("null unless BOTH url + token are set; trailing slash normalized", () => {
    expect(loadDiscordNotifyConfig({})).toBeNull();
    expect(
      loadDiscordNotifyConfig({ SUPPORT_BOT_URL: "https://b" }),
    ).toBeNull();
    expect(
      loadDiscordNotifyConfig({ SUPPORT_BOT_GRANT_TOKEN: "t" }),
    ).toBeNull();
    expect(
      loadDiscordNotifyConfig({
        SUPPORT_BOT_URL: "https://bot.test/",
        SUPPORT_BOT_GRANT_TOKEN: "t",
      }),
    ).toEqual({ url: "https://bot.test", token: "t" });
  });
});
