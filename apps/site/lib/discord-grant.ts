// The link-time Discord role backfill push (ADR-0203). services/license pushes at GRANT time; this
// covers the other ordering — a buyer who purchases FIRST and links Discord later. The site
// (server-side only) sends the account's current active entitlement ids, verbatim, to the
// support-bot's authed POST /billing-grant; the BOT owns the entitlement→role expansion so the two
// callers can never disagree on role mapping. Config-gated on the SAME env pair services/license
// uses (SUPPORT_BOT_URL + SUPPORT_BOT_GRANT_TOKEN): unset ⇒ the push is a silent no-op, never an
// error surfaced to the buyer. Never throws — role sync is best-effort, never a dashboard failure.
import { fetchWithTimeout } from "@caisson/kernel";

export interface DiscordGrantConfig {
  /** The support-bot base URL (no trailing slash). */
  url: string;
  /** The shared `BILLING_GRANT_TOKEN` Bearer the bot's POST /billing-grant expects. */
  token: string;
}

/** Resolve the push config from env; `null` (push disabled) unless BOTH values are set. */
export function loadDiscordGrantConfig(
  env: Record<string, string | undefined> = process.env,
): DiscordGrantConfig | null {
  const url = env.SUPPORT_BOT_URL?.trim() ?? "";
  const token = env.SUPPORT_BOT_GRANT_TOKEN?.trim() ?? "";
  if (url === "" || token === "") return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * Push one grant to the bot. Returns whether the bot accepted it; never throws (a failed sync is
 * log-and-drop — the buyer can retry from the dashboard, and the next purchase pushes again).
 */
export async function pushDiscordGrant(
  config: DiscordGrantConfig,
  discordUserId: string,
  entitlements: string[],
  fetchImpl: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<boolean> {
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
          entitlements,
        }),
      },
      { timeoutMs: 10_000 },
    );
    if (!res.ok) {
      process.stderr.write(
        `[apps/site] discord backfill push failed (${String(res.status)})\n`,
      );
    }
    return res.ok;
  } catch {
    process.stderr.write("[apps/site] discord backfill push errored\n");
    return false;
  }
}
