// live/discord-grant.live.test.ts — the LIVE license→bot Bearer-push proof (seam 2, ADR-0224 F2=A).
// Half of seam 2: this leg proves the LICENSE service's own outbound push code
// (services/license/src/discord-notify.ts `notifyDiscordGrant`) authenticates to the DEPLOYED bot's
// /billing-grant with the shared `SUPPORT_BOT_GRANT_TOKEN` Bearer and is accepted by the real bot in
// the real guild. The other half — the FULL F3=B `add_roles` of the throwaway `caisson-proof` role +
// its teardown — lives on the Python side (services/support-bot/tests/live/test_billing_grant_live.py),
// because only discord.py against the real gateway can grant AND remove a role. Together they cover the
// whole seam: this leg the license→bot HTTP+auth wire, the Python leg the guild mutation + teardown.
//
// A rotated `SUPPORT_BOT_GRANT_TOKEN` on one side but not the other, a wrong SUPPORT_BOT_URL, or a
// deployed bot that lost its token passes every double-backed unit test
// (discord-notify.integration.test.ts) and fails HERE.
//
// The DB identity resolution inside notifyDiscordGrant (account → linked Discord ids) is NOT this
// seam's concern (findDiscordUserIds has its own unit coverage), so it is isolated behind a tiny fake
// Transactor that returns the reserved proof member id — the REAL `fetchWithTimeout` then carries the
// production-shaped request to the deployed bot. entitlements=["field-crypto"] maps to the Customer
// umbrella only (billing_grant.py editions_for_entitlements), so the deployed bot grants the operator
// (guild owner) their standing Customer role — idempotent + benign, no lingering proof state to tear
// down; the throwaway-role grant/teardown is the Python leg's job.
//
// ADR-0201 convention: lives OUTSIDE ./src AND self-skips without SUPPORT_BOT_URL +
// SUPPORT_BOT_GRANT_TOKEN + DISCORD_PROOF_USER_ID.
import { describe, expect, test } from "bun:test";
import { fetchWithTimeout } from "@caisson/kernel";
import type { TenantExecutor, Transactor } from "@caisson/tenancy-rls";

import {
  loadDiscordNotifyConfig,
  notifyDiscordGrant,
} from "../src/discord-notify.ts";

const BOT_URL = process.env.SUPPORT_BOT_URL ?? "";
const GRANT_TOKEN = process.env.SUPPORT_BOT_GRANT_TOKEN ?? "";
// The reserved test Discord member — the operator's own account (the guild owner, ADR-0224 F3=B
// fixtures). In snowflake string form so it round-trips the bot's `^[0-9]{1,32}$` validator.
const PROOF_DISCORD_ID = process.env.DISCORD_PROOF_USER_ID ?? "";

const HAVE_CREDS =
  BOT_URL.length > 0 && GRANT_TOKEN.length > 0 && PROOF_DISCORD_ID.length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 30_000;

/** The reserved live-proof tenant (shared with the seam-1 + WORM proofs, ADR-0201). */
const PROOF_ACCOUNT_ID = "00000000-0000-4000-8000-00000000c0de";

/**
 * A tiny fake Transactor that satisfies `findDiscordUserIds` without a real DB: the role-guard sees a
 * safe non-privileged role, `account_member` is empty (→ the personal-account fallback), and the
 * better-auth link query returns the reserved proof member id. The seam under proof is the outbound
 * Bearer POST, not this resolution — so isolating it keeps the leg to one real network dependency.
 */
function fakeTransactor(discordId: string): Transactor {
  const executor: TenantExecutor = {
    async query<T = Record<string, unknown>>(sql: string) {
      if (sql.includes("pg_roles")) {
        return { rows: [{ rolsuper: false, rolbypassrls: false }] as T[] };
      }
      if (sql.includes('"providerId"')) {
        return { rows: [{ accountId: discordId }] as T[] };
      }
      // account_member (→ fallback to [accountId]) and set_config both want no meaningful rows.
      return { rows: [] as T[] };
    },
    async exec() {
      return undefined;
    },
  };
  return {
    async transaction<T>(fn: (tx: TenantExecutor) => Promise<T>): Promise<T> {
      return fn(executor);
    },
  };
}

describe("license→bot Discord grant-push live proof (seam 2, ADR-0224 F2=A)", () => {
  liveTest(
    "notifyDiscordGrant authenticates to the DEPLOYED bot and the real bot accepts the push",
    async () => {
      const config = loadDiscordNotifyConfig();
      expect(config).not.toBeNull();
      if (config === null) return; // narrows for TS; unreachable under liveTest

      // Wrap the REAL fetch so we can assert the production push's request shape AND its live response,
      // while notifyDiscordGrant (the production code) is the one that builds + sends it.
      const seen: {
        url: string;
        auth: string | null;
        body: unknown;
        status: number;
      }[] = [];
      const recordingFetch: typeof fetchWithTimeout = async (
        url,
        init,
        opts,
      ) => {
        const res = await fetchWithTimeout(url, init, opts);
        const headers = new Headers(init?.headers);
        seen.push({
          url: String(url),
          auth: headers.get("authorization"),
          body: JSON.parse(String(init?.body ?? "null")),
          status: res.status,
        });
        return res;
      };

      await notifyDiscordGrant(
        fakeTransactor(PROOF_DISCORD_ID),
        config,
        { accountId: PROOF_ACCOUNT_ID, entitlements: ["field-crypto"] },
        recordingFetch,
      );

      // Exactly one push went out, to the real /billing-grant, Bearer-authed with the shared token.
      expect(seen.length).toBe(1);
      const req = seen[0];
      expect(req?.url).toBe(`${config.url}/billing-grant`);
      // Assert the Bearer SHAPE without the value: a `toBe` failure prints its expected literal, so
      // never put the live token there. `startsWith` + a length check prove the header carries the
      // full `Bearer <token>` without any failure output ever containing the token itself.
      expect(req?.auth?.startsWith("Bearer ")).toBe(true);
      expect(req?.auth?.length).toBe(("Bearer " + GRANT_TOKEN).length);
      expect(req?.body).toEqual({
        discord_user_id: PROOF_DISCORD_ID,
        entitlements: ["field-crypto"],
      });

      // The load-bearing assertion: the REAL deployed bot authenticated the Bearer and processed the
      // push (200). A rotated/mismatched token would 401 here; an unreachable/wrong URL throws (which
      // notifyDiscordGrant swallows) and leaves status unrecorded — either way the seam goes red.
      expect(req?.status).toBe(200);
    },
    TIMEOUT,
  );
});
