// Stage 4 of the alerting pipeline (ADR-0135 + ADR-0151): multi-channel delivery behind ONE
// `AlertChannel` port. Four network drivers (email/webhook/Slack/Telegram) plus a capture driver
// for tests. Every network driver reads its endpoint/token from injected config (never a module
// constant), routes through `fetchWithTimeout`, and on a non-ok response throws a `@caisson/kernel`
// typed error WITHOUT the response body (the `email.ts` no-body-leak rule) — then CATCHES that
// itself so one channel failing never aborts the others (per-channel isolation). `deliverAll` adds
// a second isolation layer on top, so isolation holds even for a channel that doesn't self-catch.
import { createHmac } from "node:crypto";
import { fetchWithTimeout, InternalError } from "@caisson/kernel";
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

export interface WebhookConfig {
  url: string;
  /** Optional HMAC-SHA256 signing secret; when set, signs the body into `x-alert-signature`. */
  signingSecret?: string;
}

export function createWebhookChannel(config: WebhookConfig): AlertChannel {
  return {
    name: "webhook",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
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

export interface SlackConfig {
  webhookUrl: string;
}

export function createSlackChannel(config: SlackConfig): AlertChannel {
  return {
    name: "slack",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
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

export interface TelegramConfig {
  botApiUrl: string;
  chatId: string;
}

export function createTelegramChannel(config: TelegramConfig): AlertChannel {
  return {
    name: "telegram",
    async deliver(event: AlertEvent): Promise<DeliveryResult> {
      try {
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
