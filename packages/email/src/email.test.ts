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
