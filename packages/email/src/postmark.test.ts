import { afterEach, describe, expect, test } from "bun:test";
import { createPostmarkEmailer } from "./postmark.ts";

describe("Postmark emailer — request shape", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("POSTs to the Postmark endpoint with the server-token header and mapped body", async () => {
    let capturedUrl: string | URL | undefined;
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (
      url: string | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedUrl = url;
      capturedInit = init;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const emailer = createPostmarkEmailer({
      serverToken: "tok_123",
      from: "a@b.c",
    });
    await emailer.send({
      to: "user@example.com",
      template: "magic-link",
      data: { url: "https://caisson.sh/verify?token=abc" },
    });

    expect(capturedUrl).toBe("https://api.postmark.com/email");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["X-Postmark-Server-Token"]).toBe("tok_123");
    const body = JSON.parse(capturedInit?.body as string);
    expect(body.From).toBe("a@b.c");
    expect(body.To).toBe("user@example.com");
    expect(body.Subject).toBe("Sign in to Caisson");
    expect(body.HtmlBody).toContain("https://caisson.sh/verify?token=abc");
    expect(body.TextBody).toContain("https://caisson.sh/verify?token=abc");
  });

  test("falls back to a generic Subject/TextBody mapping for a free-form template (no HtmlBody)", async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (
      _url: string | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedInit = init;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;

    const emailer = createPostmarkEmailer({
      serverToken: "tok",
      from: "a@b.c",
    });
    await emailer.send({
      to: "ops@example.com",
      template: "alert.system.error_rate_high",
      data: { title: "Error rate spike" },
    });

    const body = JSON.parse(capturedInit?.body as string);
    expect(body.Subject).toBe("alert.system.error_rate_high");
    expect(body.TextBody).toBe(JSON.stringify({ title: "Error rate spike" }));
    expect(body.HtmlBody).toBeUndefined();
  });

  test("throws InternalError without echoing the response body on a non-ok response", async () => {
    globalThis.fetch = (async (): Promise<Response> =>
      new Response("leaked secret data", {
        status: 500,
      })) as unknown as typeof fetch;

    const emailer = createPostmarkEmailer({
      serverToken: "tok",
      from: "a@b.c",
    });
    await expect(
      emailer.send({
        to: "u@e.com",
        template: "magic-link",
        data: { url: "https://caisson.sh/x" },
      }),
    ).rejects.toThrow("email send failed");
  });
});
