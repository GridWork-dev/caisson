import { describe, expect, test } from "bun:test";
import {
  createCaptureChannel,
  deliverAll,
  createEmailChannel,
} from "./index.ts";
import type { AlertChannel, AlertEvent } from "./index.ts";
import { createCaptureEmailer } from "@caisson/email";

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
