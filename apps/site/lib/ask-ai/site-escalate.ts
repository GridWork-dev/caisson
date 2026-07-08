// The Ask-AI escalation ticket push (G21 parity fix). When the widget can't answer a question, the
// site (server-side only) forwards the captured question text to the support-bot's authed
// POST /escalate, which files it through the SAME Escalator + Linear Triage sink (ADR-0206) the
// Discord bot's own unresolved questions use — no second Linear client in TypeScript. Config-gated
// on SUPPORT_BOT_URL + SUPPORT_BOT_ESCALATE_TOKEN (mirrors discord-grant.ts's pair): unset ⇒ the
// push is a silent no-op, never an error surfaced to the buyer. Never throws — filing a ticket is
// best-effort, never a reason to fail the widget's own response.
import { fetchWithTimeout } from "@caisson/kernel";

export interface SiteEscalateConfig {
  /** The support-bot base URL (no trailing slash). */
  url: string;
  /** The shared `SITE_ESCALATE_TOKEN` Bearer the bot's POST /escalate expects. */
  token: string;
}

/** Resolve the push config from env; `null` (push disabled) unless BOTH values are set. */
export function loadSiteEscalateConfig(
  env: Record<string, string | undefined> = process.env,
): SiteEscalateConfig | null {
  const url = env.SUPPORT_BOT_URL?.trim() ?? "";
  const token = env.SUPPORT_BOT_ESCALATE_TOKEN?.trim() ?? "";
  if (url === "" || token === "") return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * File one escalation ticket. Returns whether the bot accepted it; never throws (a failed push is
 * log-and-drop — the question is already captured in `ask_ai_question`, ADR-0236, so nothing is lost,
 * only the human-follow-up ticket doesn't get filed this time).
 */
export async function pushSiteEscalation(
  config: SiteEscalateConfig,
  question: string,
  reason: string,
  fetchImpl: typeof fetchWithTimeout = fetchWithTimeout,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${config.url}/escalate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ question, reason }),
      },
      { timeoutMs: 10_000 },
    );
    if (!res.ok) {
      process.stderr.write(
        `[apps/site] ask-ai escalation push failed (${String(res.status)})\n`,
      );
    }
    return res.ok;
  } catch {
    process.stderr.write("[apps/site] ask-ai escalation push errored\n");
    return false;
  }
}
