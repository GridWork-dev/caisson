// Shared port-conformance harness (ADR-0170): loops every `Emailer` driver and asserts each
// satisfies the one-method port without touching the network — REST drivers get a mocked
// `fetch`, the SMTP-family drivers get an injected fake transport.
import { afterEach, describe, expect, test } from "bun:test";
import { createCaptureEmailer, createResendEmailer } from "./email.ts";
import type { Emailer, EmailMessage } from "./email.ts";
import { createPostmarkEmailer } from "./postmark.ts";
import { createSesEmailer } from "./ses.ts";
import { createSmtpEmailer, type SmtpTransport } from "./smtp.ts";

const MSG: EmailMessage = {
  to: "user@example.com",
  template: "magic-link",
  data: { url: "https://caisson.sh/verify?token=abc" },
};

// The port is shared with non-buyer-facing callers (e.g. `@caisson-sh/alerting`'s free-form
// `alert.*` templates) — every driver must also handle a template outside the branded registry.
const FREEFORM_MSG: EmailMessage = {
  to: "ops@example.com",
  template: "alert.system.error_rate_high",
  data: { title: "Error rate spike" },
};

function okFetch(): typeof fetch {
  return (async (): Promise<Response> =>
    new Response(null, { status: 200 })) as unknown as typeof fetch;
}

function fakeTransport(): SmtpTransport {
  return { sendMail: async (): Promise<unknown> => ({}) };
}

describe("Emailer port conformance", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const drivers: ReadonlyArray<[string, () => Emailer]> = [
    ["capture", () => createCaptureEmailer()],
    [
      "resend",
      () => {
        globalThis.fetch = okFetch();
        return createResendEmailer({ apiKey: "test-key", from: "a@b.c" });
      },
    ],
    [
      "postmark",
      () => {
        globalThis.fetch = okFetch();
        return createPostmarkEmailer({
          serverToken: "test-token",
          from: "a@b.c",
        });
      },
    ],
    [
      "smtp",
      () =>
        createSmtpEmailer({
          host: "smtp.test",
          port: 587,
          user: "u",
          pass: "p",
          from: "a@b.c",
          transport: fakeTransport(),
        }),
    ],
    [
      "ses",
      () =>
        createSesEmailer({
          region: "us-east-1",
          smtpUser: "u",
          smtpPass: "p",
          from: "a@b.c",
          transport: fakeTransport(),
        }),
    ],
  ];

  for (const [name, build] of drivers) {
    test(`${name} satisfies the Emailer port (send resolves, no network)`, async () => {
      const emailer = build();
      expect(typeof emailer.send).toBe("function");
      await expect(emailer.send(MSG)).resolves.toBeUndefined();
    });

    test(`${name} also accepts a free-form (non-branded) template, e.g. alerting's alert.* namespace`, async () => {
      const emailer = build();
      await expect(emailer.send(FREEFORM_MSG)).resolves.toBeUndefined();
    });
  }
});
