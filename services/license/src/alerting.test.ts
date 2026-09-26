import { describe, expect, test } from "bun:test";
import { createCaptureChannel } from "@caisson/alerting";
import type { AlertChannel } from "@caisson/alerting";
import {
  createJobAlertingDeps,
  createRateLimiterAlert,
  loadOpsAlertChannels,
} from "./alerting.ts";

describe("loadOpsAlertChannels", () => {
  test("no channel when DISCORD_OPS_WEBHOOK_URL is unset", () => {
    expect(loadOpsAlertChannels({})).toEqual([]);
  });

  test("no channel when DISCORD_OPS_WEBHOOK_URL is blank", () => {
    expect(loadOpsAlertChannels({ DISCORD_OPS_WEBHOOK_URL: "   " })).toEqual(
      [],
    );
  });

  test("a discord channel is built when the webhook url is set", () => {
    const channels = loadOpsAlertChannels({
      DISCORD_OPS_WEBHOOK_URL: "https://discord.com/api/webhooks/1/abc",
    });
    expect(channels.map((c) => c.name)).toEqual(["discord"]);
  });
});

describe("createJobAlertingDeps", () => {
  test("reportTaskFailure delivers a critical jobs.task_failed event to every channel", async () => {
    const capture = createCaptureChannel("capture");
    const deps = createJobAlertingDeps([capture]);

    await deps.reportTaskFailure("credits.expiry_sweep", new Error("boom"));

    expect(capture.delivered).toHaveLength(1);
    expect(capture.delivered[0]).toMatchObject({
      type: "jobs.task_failed",
      severity: "critical",
      title: "Job task failed: credits.expiry_sweep",
      body: "boom",
    });
  });

  test("reportInfraError delivers a critical jobs.infra_error event to every channel", async () => {
    const capture = createCaptureChannel("capture");
    const deps = createJobAlertingDeps([capture]);

    await deps.reportInfraError(new Error("connection refused"));

    expect(capture.delivered).toHaveLength(1);
    expect(capture.delivered[0]).toMatchObject({
      type: "jobs.infra_error",
      severity: "critical",
      body: "connection refused",
    });
  });

  test("an empty channel list is a harmless no-op — neither method throws", async () => {
    const deps = createJobAlertingDeps([]);

    await expect(
      deps.reportTaskFailure("x", new Error("y")),
    ).resolves.toBeUndefined();
    await expect(
      deps.reportInfraError(new Error("z")),
    ).resolves.toBeUndefined();
  });

  test("a failing channel never throws back into the caller", async () => {
    const failing: AlertChannel = {
      name: "flaky",
      deliver: () => {
        throw new Error("channel down");
      },
    };
    const deps = createJobAlertingDeps([failing]);

    await expect(
      deps.reportTaskFailure("x", new Error("y")),
    ).resolves.toBeUndefined();
  });

  test("a burst of same-key failures collapses to exactly one delivery (cooldown)", async () => {
    const capture = createCaptureChannel("capture");
    const deps = createJobAlertingDeps([capture]);

    for (let i = 0; i < 10; i++) {
      await deps.reportTaskFailure(
        "credits.expiry_sweep",
        new Error(`boom ${String(i)}`),
      );
    }

    expect(capture.delivered).toHaveLength(1);
  });

  test("different keys (task names) each get their own cooldown, not suppressed by one another", async () => {
    const capture = createCaptureChannel("capture");
    const deps = createJobAlertingDeps([capture]);

    await deps.reportTaskFailure("credits.expiry_sweep", new Error("a"));
    await deps.reportTaskFailure(
      "entitlement.updates_window_expiry_tick",
      new Error("b"),
    );
    await deps.reportInfraError(new Error("c"));

    expect(capture.delivered).toHaveLength(3);
  });
});

describe("createRateLimiterAlert", () => {
  test("delivers a redacted critical event with the applied route policy", async () => {
    const capture = createCaptureChannel("capture");
    const report = createRateLimiterAlert([capture]);

    await report({ bucket: "issue", failureMode: "closed" });

    expect(capture.delivered).toHaveLength(1);
    expect(capture.delivered[0]).toMatchObject({
      type: "license.rate_limiter_infra_error",
      severity: "critical",
      title: "License rate limiter unavailable",
      body: "The issue limiter threw; request handling applied fail-closed policy.",
    });
  });

  test("deduplicates a same-policy burst and never throws on channel failure", async () => {
    const capture = createCaptureChannel("capture");
    const failing: AlertChannel = {
      name: "flaky",
      deliver: () => {
        throw new Error("channel down");
      },
    };
    const report = createRateLimiterAlert([capture, failing]);

    await expect(
      Promise.all(
        Array.from({ length: 5 }, () =>
          report({ bucket: "webhook", failureMode: "open" }),
        ),
      ),
    ).resolves.toBeDefined();
    expect(capture.delivered).toHaveLength(1);
  });
});
