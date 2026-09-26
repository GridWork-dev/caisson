// Stage 4 of the alerting pipeline (ADR-0135 + ADR-0151): the five NETWORK delivery drivers
// (email/webhook/Slack/Telegram/Discord). The `AlertChannel` port itself, the isolation wrapper
// `deliverAll`, and the in-memory capture driver live in `./delivery.ts` — node-clean, so the
// orchestrator can reach them without dragging this file's `node:crypto` + DNS-resolving SSRF
// guard into a browser graph (ADR-0396). Every name is still on `.` exactly as before.
// Every network driver reads its endpoint/token from injected config (never a module
// constant), routes through `fetchWithTimeout`, and on a non-ok response throws a `@caisson-sh/kernel`
// typed error WITHOUT the response body (the same no-body-leak rule `@caisson-sh/email`'s drivers follow) — then CATCHES that
// itself so one channel failing never aborts the others (per-channel isolation). `deliverAll` adds
// a second isolation layer on top, so isolation holds even for a channel that doesn't self-catch.
// Buyer-supplied destination URLs (webhook/Slack/Telegram) pass an SSRF guard (`assertSafeUrl`) at
// BOTH seams — the Zod config schema and the fetch call — mirroring the ai-kit provider baseUrl guard.
import { createHmac } from "node:crypto";
import {
  assertSafePublicUrl,
  assertSafePublicUrlResolved,
  fetchWithTimeout,
  InternalError,
  strictObject,
} from "@caisson-sh/kernel/node";
import { z } from "zod";
import type { Emailer } from "@caisson-sh/email";
import { toErrorMessage } from "./delivery.ts";
import type { AlertChannel, DeliveryResult } from "./delivery.ts";
import type { AlertEvent, AlertSeverity } from "./types.ts";

/** Maps an `AlertEvent` onto an `EmailMessage` and delegates to the injected `Emailer` port —
 * reuses `@caisson-sh/email` rather than a second email path. */
export function createEmailChannel(emailer: Emailer): AlertChannel {
  return {
    name: "email",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
        await emailer.send({
          to: event.recipient,
          template: `alert.${event.type}`,
          data: {
            title: event.title,
            body: event.body,
            severity: event.severity,
          },
        });
        return { channel: "email", ok: true };
      } catch (err) {
        return { channel: "email", ok: false, error: toErrorMessage(err) };
      }
    },
  };
}

/** An https URL to a public host — the SSRF-guarded string type used for every buyer-supplied
 * destination. Runs the kernel {@link assertSafePublicUrl} LITERAL guard at the schema boundary (sync,
 * no DNS); the resolve-time re-check (DNS-rebinding defense) runs at each fetch seam
 * via {@link assertSafePublicUrlResolved} — one shared policy source (@caisson-sh/kernel/ssrf). */
const safeHttpsUrl = z.string().superRefine((value, ctx) => {
  try {
    assertSafePublicUrl(value);
  } catch (err) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: err instanceof Error ? err.message : "invalid URL",
    });
  }
});

export const WebhookConfigSchema = strictObject({
  url: safeHttpsUrl,
  /** Optional HMAC-SHA256 signing secret; when set, signs the body into `x-alert-signature`. */
  signingSecret: z.string().optional(),
});
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

export function createWebhookChannel(config: WebhookConfig): AlertChannel {
  return {
    name: "webhook",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
        // Guard at the fetch seam too — a config object can be built without parsing the schema —
        // and RESOLVE the host here (DNS-rebinding defense): a public name pointing
        // at a private/loopback/metadata address is caught before the POST leaves.
        await assertSafePublicUrlResolved(config.url);
        const body = JSON.stringify(event);
        const headers: Record<string, string> = {
          "content-type": "application/json",
        };
        if (config.signingSecret !== undefined) {
          headers["x-alert-signature"] = createHmac(
            "sha256",
            config.signingSecret,
          )
            .update(body)
            .digest("hex");
        }
        const res = await fetchWithTimeout(config.url, {
          method: "POST",
          headers,
          body,
          // Refuse redirects: only `config.url`'s host was SSRF-rechecked, so a 3xx to a private host
          // would bypass the guard. A real webhook returns 2xx, never redirects.
          redirect: "error",
        });
        if (!res.ok) {
          // Do NOT include the response body — it can echo recipient/secret fragments.
          throw new InternalError("webhook alert delivery failed");
        }
        return { channel: "webhook", ok: true };
      } catch (err) {
        return { channel: "webhook", ok: false, error: toErrorMessage(err) };
      }
    },
  };
}

export const SlackConfigSchema = strictObject({
  webhookUrl: safeHttpsUrl,
});
export type SlackConfig = z.infer<typeof SlackConfigSchema>;

export function createSlackChannel(config: SlackConfig): AlertChannel {
  return {
    name: "slack",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
        await assertSafePublicUrlResolved(config.webhookUrl);
        const res = await fetchWithTimeout(config.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: `[${event.severity}] ${event.title}\n${event.body}`,
          }),
          redirect: "error", // see the webhook seam — no redirect past the SSRF-checked host (vuln-0004)
        });
        if (!res.ok) {
          throw new InternalError("slack alert delivery failed");
        }
        return { channel: "slack", ok: true };
      } catch (err) {
        return { channel: "slack", ok: false, error: toErrorMessage(err) };
      }
    },
  };
}

export const DiscordConfigSchema = strictObject({
  webhookUrl: safeHttpsUrl,
});
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

/** Discord embed color per severity — sidebar accent, decimal (Discord's API wants an int, not
 *  hex-string). info=blue, warning=amber, critical=red. */
const DISCORD_SEVERITY_COLOR: Record<AlertSeverity, number> = {
  info: 0x3498db,
  warning: 0xf39c12,
  critical: 0xe74c3c,
};

/** Discord embed `description` is capped at 4096 chars server-side; a longer body 400s the whole
 *  webhook post rather than truncating for you. */
const DISCORD_DESCRIPTION_LIMIT = 4096;

export function createDiscordChannel(config: DiscordConfig): AlertChannel {
  return {
    name: "discord",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
        await assertSafePublicUrlResolved(config.webhookUrl);
        const res = await fetchWithTimeout(config.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                title: event.title,
                description: event.body.slice(0, DISCORD_DESCRIPTION_LIMIT),
                color: DISCORD_SEVERITY_COLOR[event.severity],
              },
            ],
          }),
          redirect: "error", // see the webhook seam — no redirect past the SSRF-checked host (vuln-0004)
        });
        if (!res.ok) {
          throw new InternalError("discord alert delivery failed");
        }
        return { channel: "discord", ok: true };
      } catch (err) {
        return { channel: "discord", ok: false, error: toErrorMessage(err) };
      }
    },
  };
}

export const TelegramConfigSchema = strictObject({
  botApiUrl: safeHttpsUrl,
  chatId: z.string(),
});
export type TelegramConfig = z.infer<typeof TelegramConfigSchema>;

export function createTelegramChannel(config: TelegramConfig): AlertChannel {
  return {
    name: "telegram",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
        // `botApiUrl` is buyer-supplied config (not a constant api.telegram.org base), so it needs
        // the same SSRF guard; resolve-check the base before composing the sendMessage path.
        await assertSafePublicUrlResolved(config.botApiUrl);
        const url = `${config.botApiUrl.replace(/\/+$/, "")}/sendMessage`;
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: `[${event.severity}] ${event.title}\n${event.body}`,
          }),
          redirect: "error", // see the webhook seam — no redirect past the SSRF-checked host (vuln-0004)
        });
        if (!res.ok) {
          throw new InternalError("telegram alert delivery failed");
        }
        return { channel: "telegram", ok: true };
      } catch (err) {
        return { channel: "telegram", ok: false, error: toErrorMessage(err) };
      }
    },
  };
}
