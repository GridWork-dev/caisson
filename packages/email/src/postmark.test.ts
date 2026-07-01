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
      template: "welcome",
      data: { name: "Ada" },
    });

    expect(capturedUrl).toBe("https://api.postmark.com/email");
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["X-Postmark-Server-Token"]).toBe("tok_123");
    expect(JSON.parse(capturedInit?.body as string)).toEqual({
      From: "a@b.c",
      To: "user@example.com",
      Subject: "welcome",
      TextBody: JSON.stringify({ name: "Ada" }),
    });
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
      emailer.send({ to: "u@e.com", template: "t", data: {} }),
    ).rejects.toThrow("email send failed");
  });
});
