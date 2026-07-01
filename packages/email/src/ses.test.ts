import { describe, expect, test } from "bun:test";
import { createSesEmailer, sesSmtpConfig } from "./ses.ts";

describe("SES emailer", () => {
  test("maps region to SES's regional SMTP endpoint on the STARTTLS port", () => {
    expect(
      sesSmtpConfig({
        region: "us-east-1",
        smtpUser: "u",
        smtpPass: "p",
        from: "a@b.c",
      }),
    ).toEqual({
      host: "email-smtp.us-east-1.amazonaws.com",
      port: 587,
      secure: false,
      user: "u",
      pass: "p",
      from: "a@b.c",
    });
  });

  test("send delegates to the SMTP transport (injected transport, no network)", async () => {
    const sent: unknown[] = [];
    const emailer = createSesEmailer({
      region: "eu-west-1",
      smtpUser: "u",
      smtpPass: "p",
      from: "a@b.c",
      transport: {
        sendMail: async (msg): Promise<unknown> => {
          sent.push(msg);
          return {};
        },
      },
    });

    await emailer.send({
      to: "x@y.com",
      template: "welcome",
      data: { n: 1 },
    });

    expect(sent).toEqual([
      {
        from: "a@b.c",
        to: "x@y.com",
        subject: "welcome",
        text: JSON.stringify({ n: 1 }),
      },
    ]);
  });
});
