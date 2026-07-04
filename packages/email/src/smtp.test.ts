import { describe, expect, test } from "bun:test";
import { createSmtpEmailer } from "./smtp.ts";

describe("SMTP emailer", () => {
  test("send maps EmailMessage onto a minimal deterministic mail (injected transport, no network)", async () => {
    const sent: unknown[] = [];
    const emailer = createSmtpEmailer({
      host: "smtp.test",
      port: 587,
      user: "u",
      pass: "p",
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

  test("falls back to a generic subject/text mapping for a free-form template (no html)", async () => {
    const sent: unknown[] = [];
    const emailer = createSmtpEmailer({
      host: "smtp.test",
      port: 587,
      user: "u",
      pass: "p",
      from: "a@b.c",
      transport: {
        sendMail: async (msg): Promise<unknown> => {
          sent.push(msg);
          return {};
        },
      },
    });

    await emailer.send({
      to: "ops@example.com",
      template: "alert.system.error_rate_high",
      data: { title: "Error rate spike" },
    });

    expect(sent).toEqual([
      {
        from: "a@b.c",
        to: "ops@example.com",
        subject: "alert.system.error_rate_high",
        text: JSON.stringify({ title: "Error rate spike" }),
      },
    ]);
  });
});
