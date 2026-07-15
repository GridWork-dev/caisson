import { describe, expect, test } from "bun:test";
import { createCaptureEmailer, createResendEmailer } from "./index.ts";

describe("capture emailer", () => {
  test("records to/template/data after send", async () => {
    const emailer = createCaptureEmailer();
    await emailer.send({
      to: "user@example.com",
      template: "magic-link",
      data: { url: "https://caisson.sh/verify?token=abc" },
    });
    expect(emailer.sent).toEqual([
      {
        to: "user@example.com",
        template: "magic-link",
        data: { url: "https://caisson.sh/verify?token=abc" },
      },
    ]);
  });

  test("sent reflects multiple sends in order", async () => {
    const emailer = createCaptureEmailer();
    await emailer.send({
      to: "a@example.com",
      template: "magic-link",
      data: { url: "https://caisson.sh/a" },
    });
    await emailer.send({
      to: "b@example.com",
      template: "password-reset",
      data: { url: "https://caisson.sh/b" },
    });
    expect(emailer.sent.map((m) => m.to)).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(emailer.sent.map((m) => m.template)).toEqual([
      "magic-link",
      "password-reset",
    ]);
  });

  test("records a free-form (non-branded) template unchanged, e.g. alerting's alert.* namespace", async () => {
    const emailer = createCaptureEmailer();
    await emailer.send({
      to: "ops@example.com",
      template: "alert.system.error_rate_high",
      data: { title: "Error rate spike", severity: "high" },
    });
    expect(emailer.sent).toEqual([
      {
        to: "ops@example.com",
        template: "alert.system.error_rate_high",
        data: { title: "Error rate spike", severity: "high" },
      },
    ]);
  });

  test("createResendEmailer returns an emailer with a send function", () => {
    const emailer = createResendEmailer({ apiKey: "x", from: "a@b.c" });
    expect(typeof emailer.send).toBe("function");
  });

  test("createResendEmailer onQuota sees the remaining-quota headers on a successful send; absent/garbage headers parse to null; observer errors never break the send", async () => {
    const realFetch = globalThis.fetch;
    const quotas: Array<{
      monthlyRemaining: number | null;
      dailyRemaining: number | null;
    }> = [];
    const headerSets: Array<Record<string, string>> = [
      { "x-resend-monthly-quota": "4821", "x-resend-daily-quota": "37" },
      { "x-resend-monthly-quota": "not-a-number" },
      {},
      // Empty/whitespace must parse to null, never 0 — Number("") is 0, which would read as
      // "quota exhausted" and fire a false critical alert downstream.
      { "x-resend-monthly-quota": "", "x-resend-daily-quota": "   " },
    ];
    let call = 0;
    globalThis.fetch = (async (): Promise<Response> =>
      new Response(null, {
        status: 200,
        headers: headerSets[call++] ?? {},
      })) as unknown as typeof fetch;

    try {
      const emailer = createResendEmailer({
        apiKey: "x",
        from: "a@b.c",
        onQuota: (q) => {
          quotas.push(q);
          throw new Error("observer bug — must not break the send");
        },
      });
      const msg = { to: "ops@example.com", template: "t", data: {} };
      await emailer.send(msg); // does not throw despite the throwing observer
      await emailer.send(msg);
      await emailer.send(msg);
      await emailer.send(msg);
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(quotas).toEqual([
      { monthlyRemaining: 4821, dailyRemaining: 37 },
      { monthlyRemaining: null, dailyRemaining: null },
      { monthlyRemaining: null, dailyRemaining: null },
      { monthlyRemaining: null, dailyRemaining: null },
    ]);
  });

  test("createResendEmailer falls back to a generic subject/text mapping for a free-form template (no html)", async () => {
    const realFetch = globalThis.fetch;
    let capturedBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (
      _url: string | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const emailer = createResendEmailer({ apiKey: "x", from: "a@b.c" });
      await emailer.send({
        to: "ops@example.com",
        template: "alert.system.error_rate_high",
        data: { title: "Error rate spike" },
      });
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(capturedBody?.subject).toBe("alert.system.error_rate_high");
    expect(capturedBody?.text).toBe(
      JSON.stringify({ title: "Error rate spike" }),
    );
    expect(capturedBody?.html).toBeUndefined();
  });

  test("createResendEmailer sends reply_to when replyTo is configured, omits it when not", async () => {
    const realFetch = globalThis.fetch;
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = (async (
      _url: string | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      bodies.push(JSON.parse(init?.body as string) as Record<string, unknown>);
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const withReplyTo = createResendEmailer({
        apiKey: "x",
        from: "no-reply@b.c",
        replyTo: "support@b.c",
      });
      await withReplyTo.send({
        to: "user@example.com",
        template: "magic-link",
        data: { url: "https://caisson.sh/verify?token=abc" },
      });
      const without = createResendEmailer({
        apiKey: "x",
        from: "no-reply@b.c",
      });
      await without.send({
        to: "user@example.com",
        template: "magic-link",
        data: { url: "https://caisson.sh/verify?token=abc" },
      });
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(bodies[0]?.reply_to).toBe("support@b.c");
    expect(bodies[1]).not.toContainKey("reply_to");
  });

  test("createResendEmailer POSTs the rendered subject/html/text for a real template", async () => {
    const realFetch = globalThis.fetch;
    let capturedBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (
      _url: string | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const emailer = createResendEmailer({ apiKey: "x", from: "a@b.c" });
      await emailer.send({
        to: "user@example.com",
        template: "magic-link",
        data: { url: "https://caisson.sh/verify?token=abc" },
      });
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(capturedBody?.subject).toBe("Sign in to Caisson");
    expect(String(capturedBody?.html)).toContain(
      "https://caisson.sh/verify?token=abc",
    );
    expect(String(capturedBody?.text)).toContain(
      "https://caisson.sh/verify?token=abc",
    );
  });
});
