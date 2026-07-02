// Stage 4 of the alerting pipeline (ADR-0135 + ADR-0151): multi-channel delivery behind ONE
// `AlertChannel` port. Four network drivers (email/webhook/Slack/Telegram) plus a capture driver
// for tests. Every network driver reads its endpoint/token from injected config (never a module
// constant), routes through `fetchWithTimeout`, and on a non-ok response throws a `@caisson/kernel`
// typed error WITHOUT the response body (the `email.ts` no-body-leak rule) — then CATCHES that
// itself so one channel failing never aborts the others (per-channel isolation). `deliverAll` adds
// a second isolation layer on top, so isolation holds even for a channel that doesn't self-catch.
// Buyer-supplied destination URLs (webhook/Slack/Telegram) pass an SSRF guard (`assertSafeUrl`) at
// BOTH seams — the Zod config schema and the fetch call — mirroring the ai-kit provider baseUrl guard.
import { createHmac } from "node:crypto";
import {
  fetchWithTimeout,
  InternalError,
  ValidationError,
  strictObject,
} from "@caisson/kernel";
import { z } from "zod";
import type { Emailer } from "@caisson/email";
import type { AlertEvent } from "./types.ts";

export interface DeliveryResult {
  channel: string;
  ok: boolean;
  error?: string;
}

/** The port: one method, transport-agnostic, the only seam `deliverAll` depends on. */
export interface AlertChannel {
  name: string;
  deliver(event: AlertEvent): Promise<DeliveryResult>;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Runs `channel.deliver`, catching any throw/rejection into a failed `DeliveryResult` — the
 * isolation boundary `deliverAll` relies on regardless of whether a driver self-catches. */
async function attemptDeliver(
  channel: AlertChannel,
  event: AlertEvent,
): Promise<DeliveryResult> {
  try {
    return await channel.deliver(event);
  } catch (err) {
    return { channel: channel.name, ok: false, error: toErrorMessage(err) };
  }
}

/** Delivers `event` to every channel; one failing channel never prevents the rest from running. */
export async function deliverAll(
  event: AlertEvent,
  channels: readonly AlertChannel[],
): Promise<DeliveryResult[]> {
  return Promise.all(channels.map((channel) => attemptDeliver(channel, event)));
}

/** A test driver that records every delivered event in memory; never touches the network. */
export interface CaptureChannel extends AlertChannel {
  readonly delivered: readonly AlertEvent[];
}

export function createCaptureChannel(name = "capture"): CaptureChannel {
  const delivered: AlertEvent[] = [];
  return {
    name,
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      delivered.push(event);
      return { channel: name, ok: true };
    },
    get delivered(): readonly AlertEvent[] {
      return delivered;
    },
  };
}

/** Maps an `AlertEvent` onto an `EmailMessage` and delegates to the injected `Emailer` port —
 * reuses `@caisson/email` rather than a second email path. */
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

/**
 * SSRF guard for a buyer-supplied destination URL (webhook/Slack/Telegram config). The value flows
 * straight into an outbound `fetchWithTimeout`, so an unguarded `http://169.254.169.254` (cloud
 * metadata), a loopback/private host, or a `file:`/`data:` scheme would let a misconfigured or
 * hostile config reach internal services. Mirrors the ai-kit provider `baseUrl` guard's floor —
 * https-only, no credentials-in-URL, a private/loopback/link-local/metadata DENYLIST (not a host
 * allowlist: buyers may point a webhook at any PUBLIC https host).
 *
 * @throws ValidationError on a malformed URL, a non-https scheme, credentials in the URL, or a
 *   private-range / localhost / `.local` host.
 */
function assertSafeUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError("alert destination URL rejected: malformed URL");
  }
  if (url.protocol !== "https:") {
    // https only — blocks http:, and data:/file:/javascript: smuggling. Never auto-prepend a scheme.
    throw new ValidationError(
      "alert destination URL rejected: non-https scheme",
      { scheme: url.protocol },
    );
  }
  if (url.username !== "" || url.password !== "") {
    throw new ValidationError(
      "alert destination URL rejected: credentials in URL",
    );
  }
  if (isPrivateHost(url.hostname)) {
    // The WHATWG parser canonicalizes decimal/octal/hex/short-form IPv4 to dotted-quad before this
    // check, so those encodings are covered for free.
    // ponytail: literal-host denylist — a PUBLIC hostname that RESOLVES to a private IP (DNS
    // rebinding) is not caught here; add resolve-time pinning only if a deployment needs it.
    throw new ValidationError(
      "alert destination URL rejected: private/loopback host",
      { host: url.hostname },
    );
  }
}

/** True if `hostname` (as returned by `URL.hostname`) is a loopback/private/link-local/metadata literal. */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host.startsWith("[") && host.endsWith("]")) {
    const v6 = host.slice(1, -1);
    return (
      v6 === "::1" || // loopback
      v6 === "::" || // unspecified
      /^f[cd]/.test(v6) || // fc00::/7 unique-local
      /^fe[89ab]/.test(v6) || // fe80::/10 link-local
      v6.startsWith("::ffff:") // IPv4-mapped — never a real destination host, reject wholesale
    );
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m === null) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    a === 0 || // 0.0.0.0/8 (incl. 0.0.0.0)
    a === 127 || // 127/8 loopback
    a === 10 || // 10/8 private
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
    (a === 192 && b === 168) || // 192.168/16 private
    (a === 169 && b === 254) // 169.254/16 link-local (incl. cloud metadata 169.254.169.254)
  );
}

/** An https URL to a public host — the SSRF-guarded string type used for every buyer-supplied
 * destination. Runs {@link assertSafeUrl} so the schema boundary and the fetch-time guard share one
 * policy source. */
const safeHttpsUrl = z.string().superRefine((value, ctx) => {
  try {
    assertSafeUrl(value);
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
        // Guard at the fetch seam too — a config object can be built without parsing the schema.
        assertSafeUrl(config.url);
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
        assertSafeUrl(config.webhookUrl);
        const res = await fetchWithTimeout(config.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: `[${event.severity}] ${event.title}\n${event.body}`,
          }),
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
        // the same SSRF guard; guard the base before composing the sendMessage path.
        assertSafeUrl(config.botApiUrl);
        const url = `${config.botApiUrl.replace(/\/+$/, "")}/sendMessage`;
        const res = await fetchWithTimeout(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: config.chatId,
            text: `[${event.severity}] ${event.title}\n${event.body}`,
          }),
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
