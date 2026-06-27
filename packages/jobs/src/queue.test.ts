import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { NotFoundError, strictObject, ValidationError } from "@caisson/kernel";
import { createInMemoryQueue, defineTask } from "./index.ts";

const grantSchema = strictObject({
  accountId: z.string(),
  amount: z.number(),
});

describe("in-memory job queue", () => {
  test("enqueue runs the task handler with the parsed payload", async () => {
    const received: Array<{ accountId: string; amount: number }> = [];
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async (payload) => {
        received.push(payload);
      }),
    ]);

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 100 });

    expect(received).toEqual([{ accountId: "acct_a", amount: 100 }]);
  });

  test("enqueue to an unknown task name throws NotFoundError", async () => {
    const queue = createInMemoryQueue([]);
    await expect(queue.enqueue("missing", {})).rejects.toThrow(NotFoundError);
  });

  test("enqueue with an invalid payload throws ValidationError", async () => {
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async () => {}),
    ]);
    await expect(
      queue.enqueue("grant-credits", { accountId: "acct_a", amount: "lots" }),
    ).rejects.toThrow(ValidationError);
  });
});
