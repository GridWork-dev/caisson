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

describe("in-memory job queue — idempotent enqueue (ADR-0205)", () => {
  test("a repeated enqueue with the same idempotencyKey runs the handler once", async () => {
    const received: Array<{ accountId: string; amount: number }> = [];
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async (payload) => {
        received.push(payload);
      }),
    ]);
    const options = { idempotencyKey: "retry-1" };

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 100 },
      options,
    );
    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 100 },
      options,
    );

    expect(received).toEqual([{ accountId: "acct_a", amount: 100 }]);
  });

  test("a different idempotencyKey on the same task name runs the handler again", async () => {
    const received: Array<{ accountId: string; amount: number }> = [];
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async (payload) => {
        received.push(payload);
      }),
    ]);

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { idempotencyKey: "retry-1" },
    );
    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 2 },
      { idempotencyKey: "retry-2" },
    );

    expect(received).toHaveLength(2);
  });

  test("omitting idempotencyKey never dedupes", async () => {
    const received: Array<{ accountId: string; amount: number }> = [];
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async (payload) => {
        received.push(payload);
      }),
    ]);

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });
    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });

    expect(received).toHaveLength(2);
  });
});

describe("in-memory job queue — work() (ADR-0205)", () => {
  test("returns a stoppable no-op WorkHandle for a registered task", async () => {
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async () => {}),
    ]);

    const handle = await queue.work("grant-credits");
    expect(typeof handle.stop).toBe("function");
    await expect(handle.stop()).resolves.toBeUndefined();
  });

  test("work() on an unregistered task name throws NotFoundError", async () => {
    const queue = createInMemoryQueue([]);
    await expect(queue.work("missing")).rejects.toThrow(NotFoundError);
  });
});

describe("in-memory job queue — getQueueState() (ADR-0205)", () => {
  test("an unenqueued task reports all-zero counts", async () => {
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async () => {}),
    ]);

    await expect(queue.getQueueState("grant-credits")).resolves.toEqual({
      queuedCount: 0,
      activeCount: 0,
      failedCount: 0,
    });
  });

  test("queuedCount/activeCount stay honestly zero even after a successful enqueue — the job already ran synchronously", async () => {
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async () => {}),
    ]);

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });

    await expect(queue.getQueueState("grant-credits")).resolves.toEqual({
      queuedCount: 0,
      activeCount: 0,
      failedCount: 0,
    });
  });

  test("a handler that throws increments failedCount and still rejects enqueue", async () => {
    const queue = createInMemoryQueue([
      defineTask("grant-credits", grantSchema, async () => {
        throw new Error("boom");
      }),
    ]);

    await expect(
      queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 }),
    ).rejects.toThrow("boom");

    await expect(queue.getQueueState("grant-credits")).resolves.toEqual({
      queuedCount: 0,
      activeCount: 0,
      failedCount: 1,
    });
  });
});
