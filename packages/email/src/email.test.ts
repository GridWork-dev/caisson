import { describe, expect, test } from "bun:test";
import { createCaptureEmailer, createResendEmailer } from "./index.ts";

describe("capture emailer", () => {
  test("records to/template/data after send", async () => {
    const emailer = createCaptureEmailer();
    await emailer.send({
      to: "user@example.com",
      template: "welcome",
      data: { name: "Ada" },
    });
    expect(emailer.sent).toEqual([
      { to: "user@example.com", template: "welcome", data: { name: "Ada" } },
    ]);
  });

  test("sent reflects multiple sends in order", async () => {
    const emailer = createCaptureEmailer();
    await emailer.send({ to: "a@example.com", template: "t1", data: {} });
    await emailer.send({ to: "b@example.com", template: "t2", data: { n: 2 } });
    expect(emailer.sent.map((m) => m.to)).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
    expect(emailer.sent.map((m) => m.template)).toEqual(["t1", "t2"]);
  });

  test("createResendEmailer returns an emailer with a send function", () => {
    const emailer = createResendEmailer({ apiKey: "x", from: "a@b.c" });
    expect(typeof emailer.send).toBe("function");
  });
});
