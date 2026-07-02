// The post-grant Discord role push (ADR-0203, closes the ADR-0109 deferral). After a webhook grant
// COMMITS, this resolves the buyer account's linked Discord user(s) and fire-and-forgets
// `POST /billing-grant` on the support-bot. Two binding properties:
//   • NEVER throws — the money path (Paddle's 2xx) must not depend on Discord availability; every
//     failure collapses to one stderr line and the push is simply lost (the site's link-time
//     backfill re-converges the roles).
//   • Config-gated — `SUPPORT_BOT_URL` + `SUPPORT_BOT_GRANT_TOKEN` unset ⇒ server.ts injects no
//     notifier and nothing here runs.
// Identity resolution: account → member user ids via `account_member` (tenant-GUC RLS path,
// ADR-0176) with the personal-account fallback (account_id == user_id when no membership row);
// user ids → Discord ids via better-auth's own `account` provider-link table (its migrator owns the
// DDL — camelCase quoted columns; providerId 'discord'; accountId = the provider-side user id).
// That table carries no RLS and no `app`-role grant, so it is read on the PLAIN connection role
// (the same role the deploy migrator runs as), outside `withTenant` — deliberately: it holds
// cross-tenant identity links, not tenant data, and the account scoping happens in the
// `account_member` step above.
import { fetchWithTimeout } from "@caisson/kernel";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";

export interface DiscordNotifyConfig {
  /** The support-bot base URL (no trailing slash), e.g. https://bot.caisson.sh */
  url: string;
  /** The shared `BILLING_GRANT_TOKEN` Bearer the bot's POST /billing-grant expects. */
  token: string;
}

/** Resolve the push config from env; `null` (push disabled) unless BOTH values are set. */
export function loadDiscordNotifyConfig(
  env: Record<string, string | undefined> = process.env,
): DiscordNotifyConfig | null {
  const url = env.SUPPORT_BOT_URL?.trim() ?? "";
  const token = env.SUPPORT_BOT_GRANT_TOKEN?.trim() ?? "";
  if (url === "" || token === "") return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * The buyer account's linked Discord user ids (possibly none, possibly several — every org member
 * who linked Discord gets the purchased roles, the ADR-0203 org perk). Throws on DB errors — the
 * caller (`notifyDiscordGrant`) owns the never-throw boundary.
 */
export async function findDiscordUserIds(
  db: Transactor,
  accountId: string,
): Promise<string[]> {
  // Member user ids, tenant-scoped (account_member's account-GUC RLS path, ADR-0176). A personal
  // account may carry no membership row — its invariant is account_id == user_id (apps/site
  // resolveActiveAccount), so fall back to the account id itself.
  const members = await withTenant(db, accountId, async (tx) => {
    const r = await tx.query<{ user_id: string }>(
      "SELECT user_id FROM account_member WHERE account_id = $1",
      [accountId],
    );
    return r.rows.map((row) => row.user_id);
  });
  const userIds = members.length > 0 ? members : [accountId];
  const links = await db.transaction(async (tx) => {
    const r = await tx.query<{ accountId: string }>(
      `SELECT "accountId" FROM "account" WHERE "providerId" = 'discord' AND "userId" = ANY($1::text[])`,
      [userIds],
    );
    return r.rows.map((row) => row.accountId);
  });
  return [...new Set(links)];
}

export interface DiscordGrantPush {
  accountId: string;
  /** Purchased entitlement ids, verbatim — the BOT owns the entitlement→role expansion. */
  entitlements: string[];
}

/**
 * Fire the post-grant push. NEVER throws and never blocks the webhook response path — the caller
 * detaches it (`void`) after the grant transaction commits. One POST per linked Discord user; the
 * bot's grant is idempotent (`add_roles` re-adding is a no-op), so a duplicate push is harmless.
 */
export async function notifyDiscordGrant(
  db: Transactor,
  config: DiscordNotifyConfig,
  push: DiscordGrantPush,
  fetchImpl: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<void> {
  try {
    const discordIds = await findDiscordUserIds(db, push.accountId);
    for (const discordUserId of discordIds) {
      try {
        const res = await fetchImpl(
          `${config.url}/billing-grant`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${config.token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              discord_user_id: discordUserId,
              entitlements: push.entitlements,
            }),
          },
          { timeoutMs: 10_000 },
        );
        if (!res.ok) {
          process.stderr.write(
            `[service-license] discord grant push failed (${String(res.status)}) for account ${push.accountId}\n`,
          );
        }
      } catch {
        process.stderr.write(
          `[service-license] discord grant push errored for account ${push.accountId}\n`,
        );
      }
    }
  } catch {
    // The identity lookup itself failed (e.g. better-auth tables absent in this environment) —
    // log-and-drop; the link-time backfill re-converges roles later.
    process.stderr.write(
      `[service-license] discord link lookup failed for account ${push.accountId}\n`,
    );
  }
}
