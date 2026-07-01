import { describe, expect, test } from "bun:test";
import { ConfigError } from "@caisson/kernel";
import { createPgBossJobQueue, type PgBossClient } from "./pgboss.ts";

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

describe("pg-boss job queue", () => {
  test("enqueue calls boss.send with the given name and payload", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue({ client });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 100 });

    expect(client.sendCalls).toEqual([
      { name: "grant-credits", payload: { accountId: "acct_a", amount: 100 } },
    ]);
  });

  test("enqueue creates the queue once, then reuses it on repeat sends", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue({ client });

    await queue.enqueue("grant-credits", { amount: 1 });
    await queue.enqueue("grant-credits", { amount: 2 });

    expect(client.createQueueCalls).toEqual(["grant-credits"]);
    expect(client.sendCalls).toHaveLength(2);
  });

  test("constructing without a connectionString or client throws ConfigError", () => {
    expect(() => createPgBossJobQueue({})).toThrow(ConfigError);
  });

  test("constructing with an empty connectionString throws ConfigError", () => {
    expect(() => createPgBossJobQueue({ connectionString: "" })).toThrow(
      ConfigError,
    );
  });
});
