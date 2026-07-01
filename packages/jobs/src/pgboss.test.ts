import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  ConfigError,
  NotFoundError,
  strictObject,
  ValidationError,
} from "@caisson/kernel";
import { defineTask } from "./queue.ts";
import { createPgBossJobQueue, type PgBossClient } from "./pgboss.ts";

const grantCreditsSchema = strictObject({
  accountId: z.string(),
  amount: z.number(),
});

/** A fake `PgBossClient` that records every call instead of touching Postgres. */
function createFakeClient(): PgBossClient & {
  readonly sendCalls: ReadonlyArray<{ name: string; payload: unknown }>;
  readonly createQueueCalls: readonly string[];
} {
  const sendCalls: Array<{ name: string; payload: unknown }> = [];
  const createQueueCalls: string[] = [];
  return {
    async start() {
      return undefined;
    },
    async createQueue(name) {
      createQueueCalls.push(name);
    },
    async send(name, payload) {
      sendCalls.push({ name, payload });
      return "job_fake";
    },
    get sendCalls() {
      return sendCalls;
    },
    get createQueueCalls() {
      return createQueueCalls;
    },
  };
}

const grantCreditsTasks = [
  defineTask("grant-credits", grantCreditsSchema, async () => {}),
];

describe("pg-boss job queue", () => {
  test("enqueue calls boss.send with the given name and payload", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 100 });

    expect(client.sendCalls).toEqual([
      { name: "grant-credits", payload: { accountId: "acct_a", amount: 100 } },
    ]);
  });

  test("enqueue creates the queue once, then reuses it on repeat sends", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });
    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 2 });

    expect(client.createQueueCalls).toEqual(["grant-credits"]);
    expect(client.sendCalls).toHaveLength(2);
  });

  test("enqueue rejects an unregistered task name before touching pg-boss", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await expect(
      queue.enqueue("not-a-real-task", { accountId: "acct_a", amount: 1 }),
    ).rejects.toThrow(NotFoundError);
    expect(client.sendCalls).toHaveLength(0);
    expect(client.createQueueCalls).toHaveLength(0);
  });

  test("enqueue rejects a schema-invalid payload before touching pg-boss", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await expect(
      queue.enqueue("grant-credits", { accountId: "acct_a" }),
    ).rejects.toThrow(ValidationError);
    expect(client.sendCalls).toHaveLength(0);
    expect(client.createQueueCalls).toHaveLength(0);
  });

  test("constructing without a connectionString or client throws ConfigError", () => {
    expect(() => createPgBossJobQueue(grantCreditsTasks, {})).toThrow(
      ConfigError,
    );
  });

  test("constructing with an empty connectionString throws ConfigError", () => {
    expect(() =>
      createPgBossJobQueue(grantCreditsTasks, { connectionString: "" }),
    ).toThrow(ConfigError);
  });
});
