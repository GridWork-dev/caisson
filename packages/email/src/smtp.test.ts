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
