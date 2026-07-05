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
      template: "magic-link",
      data: { url: "https://caisson.sh/verify?token=abc" },
    });

    expect(sent).toHaveLength(1);
    const messages = sent as Array<{
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    }>;
    const msg = messages[0];
    if (!msg) throw new Error("expected a sent message");
    expect(msg.from).toBe("a@b.c");
    expect(msg.to).toBe("x@y.com");
    expect(msg.subject).toBe("Sign in to Caisson");
    expect(msg.html).toContain("https://caisson.sh/verify?token=abc");
    expect(msg.text).toContain("https://caisson.sh/verify?token=abc");
  });
});
