import { describe, expect, test } from "bun:test";
import {
  createCaptureChannel,
  deliverAll,
  createEmailChannel,
  createWebhookChannel,
  createSlackChannel,
  createTelegramChannel,
  createDiscordChannel,
  WebhookConfigSchema,
  SlackConfigSchema,
  TelegramConfigSchema,
  DiscordConfigSchema,
} from "./index.ts";
import type { AlertChannel, AlertEvent } from "./index.ts";
import { createCaptureEmailer } from "@caisson-sh/email";

const event: AlertEvent = {
  id: "evt_1",
  type: "system.error_rate_high",
  severity: "critical",
  tenantId: "tenant_a",
  recipient: "ops@example.com",
  dedupeKey: "dk_1",
  title: "Error rate spike",
  body: "5xx rate above threshold",
  createdAt: 1_750_000_000_000,
};

describe("createCaptureChannel", () => {
  test("records a delivery", async () => {
    const channel = createCaptureChannel();
    const result = await channel.deliver(event);
    expect(result).toEqual({ channel: "capture", ok: true });
    expect(channel.delivered).toEqual([event]);
  });
});

describe("createEmailChannel", () => {
  test("delegates to the injected Emailer", async () => {
    const emailer = createCaptureEmailer();
    const channel = createEmailChannel(emailer);
    const result = await channel.deliver(event);
    expect(result).toEqual({ channel: "email", ok: true });
    expect(emailer.sent).toEqual([
      {
        to: "ops@example.com",
        template: "alert.system.error_rate_high",
        data: {
          title: "Error rate spike",
          body: "5xx rate above threshold",
          severity: "critical",
        },
      },
    ]);
  });
});

// SSRF: caller-supplied destination URLs must be https to a public host, guarded at BOTH the Zod
// schema boundary and the fetch seam (a config object can be built without parsing the schema).
const UNSAFE_URLS = [
  "http://hooks.slack.com/services/x", // non-https
  "http://169.254.169.254/", // cloud metadata
  "http://10.0.0.1/", // private
  "http://localhost/", // loopback name
  "file:///etc/passwd", // non-http scheme
  "https://user:pass@hooks.slack.com/x", // credentials in URL
  "https://169.254.169.254/", // metadata on https too
  "https://[::1]/", // IPv6 loopback
];
const SAFE_URL = "https://hooks.slack.com/services/T000/B000/xxx";

describe("SSRF guard — schema boundary", () => {
  for (const url of UNSAFE_URLS) {
    test(`WebhookConfigSchema rejects ${url}`, () => {
      expect(WebhookConfigSchema.safeParse({ url }).success).toBe(false);
    });
    test(`SlackConfigSchema rejects ${url}`, () => {
      expect(SlackConfigSchema.safeParse({ webhookUrl: url }).success).toBe(
        false,
      );
    });
    test(`TelegramConfigSchema rejects ${url}`, () => {
      expect(
        TelegramConfigSchema.safeParse({ botApiUrl: url, chatId: "1" }).success,
      ).toBe(false);
    });
    test(`DiscordConfigSchema rejects ${url}`, () => {
      expect(DiscordConfigSchema.safeParse({ webhookUrl: url }).success).toBe(
        false,
      );
    });
  }

  test("accepts a normal https destination", () => {
    expect(WebhookConfigSchema.safeParse({ url: SAFE_URL }).success).toBe(true);
    expect(SlackConfigSchema.safeParse({ webhookUrl: SAFE_URL }).success).toBe(
      true,
    );
    expect(
      TelegramConfigSchema.safeParse({ botApiUrl: SAFE_URL, chatId: "1" })
        .success,
    ).toBe(true);
    expect(
      DiscordConfigSchema.safeParse({ webhookUrl: SAFE_URL }).success,
    ).toBe(true);
  });
});

describe("SSRF guard — fetch seam", () => {
  // The guard throws before any fetch, so an unsafe destination yields a failed DeliveryResult and
  // never touches the network (no mock needed — a real egress here would be the bug).
  for (const url of UNSAFE_URLS) {
    test(`webhook rejects ${url}`, async () => {
      const result = await createWebhookChannel({ url }).deliver(event);
      expect(result.ok).toBe(false);
      expect(result.channel).toBe("webhook");
    });
    test(`slack rejects ${url}`, async () => {
      const result = await createSlackChannel({ webhookUrl: url }).deliver(
        event,
      );
      expect(result.ok).toBe(false);
      expect(result.channel).toBe("slack");
    });
    test(`telegram rejects ${url}`, async () => {
      const result = await createTelegramChannel({
        botApiUrl: url,
        chatId: "1",
      }).deliver(event);
      expect(result.ok).toBe(false);
      expect(result.channel).toBe("telegram");
    });
    test(`discord rejects ${url}`, async () => {
      const result = await createDiscordChannel({ webhookUrl: url }).deliver(
        event,
      );
      expect(result.ok).toBe(false);
      expect(result.channel).toBe("discord");
    });
  }
});

describe("deliverAll", () => {
  test("isolates one failing channel — the others still deliver", async () => {
    const good1 = createCaptureChannel("good1");
    const good2 = createCaptureChannel("good2");
    const failing: AlertChannel = {
      name: "flaky",
      deliver: () => {
        throw new Error("boom");
      },
    };

    const results = await deliverAll(event, [good1, failing, good2]);

    expect(results).toEqual([
      { channel: "good1", ok: true },
      { channel: "flaky", ok: false, error: "boom" },
      { channel: "good2", ok: true },
    ]);
    expect(good1.delivered).toEqual([event]);
    expect(good2.delivered).toEqual([event]);
  });
});
