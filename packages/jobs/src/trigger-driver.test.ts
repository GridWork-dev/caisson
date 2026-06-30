import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  ConfigError,
  NotFoundError,
  strictObject,
  ValidationError,
} from "@caisson/kernel";
import { defineTask } from "./index.ts";
import { createTriggerJobQueue, type TriggerClient } from "./trigger-driver.ts";

const grantSchema = strictObject({
  accountId: z.string(),
  amount: z.number(),
});

/** A fake `TriggerClient` that records every call instead of touching the network. */
function createFakeClient(): TriggerClient & {
  readonly calls: ReadonlyArray<{ taskId: string; payload: unknown }>;
} {
  const calls: Array<{ taskId: string; payload: unknown }> = [];
  return {
    async trigger(taskId, payload) {
      calls.push({ taskId, payload });
      return { id: "run_fake" };
    },
    get calls() {
      return calls;
    },
  };
}

describe("trigger.dev job queue", () => {
  test("enqueue triggers the injected client with the validated payload", async () => {
    const client = createFakeClient();
    const queue = createTriggerJobQueue(
      [defineTask("grant-credits", grantSchema, async () => {})],
      { client },
    );

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 100 });

    expect(client.calls).toEqual([
      {
        taskId: "grant-credits",
        payload: { accountId: "acct_a", amount: 100 },
      },
    ]);
  });

  test("enqueue to an unknown task name throws NotFoundError without calling the client", async () => {
    const client = createFakeClient();
    const queue = createTriggerJobQueue([], { client });

    await expect(queue.enqueue("missing", {})).rejects.toThrow(NotFoundError);
    expect(client.calls).toEqual([]);
  });

  test("enqueue with an invalid payload throws ValidationError without calling the client", async () => {
    const client = createFakeClient();
    const queue = createTriggerJobQueue(
      [defineTask("grant-credits", grantSchema, async () => {})],
      { client },
    );

    await expect(
      queue.enqueue("grant-credits", { accountId: "acct_a", amount: "lots" }),
    ).rejects.toThrow(ValidationError);
    expect(client.calls).toEqual([]);
  });

  test("constructing without a secretKey or client throws ConfigError", () => {
    expect(() =>
      createTriggerJobQueue(
        [defineTask("grant-credits", grantSchema, async () => {})],
        {},
      ),
    ).toThrow(ConfigError);
  });

  test("constructing with an empty secretKey throws ConfigError", () => {
    expect(() => createTriggerJobQueue([], { secretKey: "" })).toThrow(
      ConfigError,
    );
  });

  test("constructing with a secretKey configures the SDK client without network access", () => {
    const queue = createTriggerJobQueue(
      [defineTask("grant-credits", grantSchema, async () => {})],
      { secretKey: "tr_test_fake", apiUrl: "https://trigger.example.com" },
    );

    expect(typeof queue.enqueue).toBe("function");
  });
});
