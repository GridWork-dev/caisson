import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  ConfigError,
  NotFoundError,
  strictObject,
  ValidationError,
} from "@caisson/kernel";
import { defineTask } from "./queue.ts";
import type { QueueState } from "./queue.ts";
import {
  createPgBossJobQueue,
  deriveIdempotentJobId,
  type PgBossClient,
  type PgBossJob,
} from "./pgboss.ts";

const grantCreditsSchema = strictObject({
  accountId: z.string(),
  amount: z.number(),
});

/** A fake `PgBossClient` that records every call instead of touching Postgres. */
function createFakeClient(): PgBossClient & {
  readonly sendCalls: ReadonlyArray<{
    name: string;
    payload: unknown;
    id: string | undefined;
  }>;
  readonly createQueueCalls: readonly string[];
  readonly workCalls: readonly string[];
  readonly offWorkCalls: ReadonlyArray<{
    name: string;
    id: string | undefined;
  }>;
  queueState: QueueState | null;
  /** Set to make the next `work()` immediately deliver this batch to its handler. */
  nextWorkBatch: readonly PgBossJob[];
} {
  const sendCalls: Array<{
    name: string;
    payload: unknown;
    id: string | undefined;
  }> = [];
  const createQueueCalls: string[] = [];
  const workCalls: string[] = [];
  const offWorkCalls: Array<{ name: string; id: string | undefined }> = [];
  let queueState: QueueState | null = null;
  let nextWorkBatch: readonly PgBossJob[] = [];
  return {
    async start() {
      return undefined;
    },
    async createQueue(name) {
      createQueueCalls.push(name);
    },
    async send(name, payload, options) {
      sendCalls.push({ name, payload, id: options?.id });
      return "job_fake";
    },
    async work(name, handler) {
      workCalls.push(name);
      await handler(nextWorkBatch);
      return "worker_fake";
    },
    async offWork(name, options) {
      offWorkCalls.push({ name, id: options?.id });
    },
    async getQueue() {
      return queueState;
    },
    get sendCalls() {
      return sendCalls;
    },
    get createQueueCalls() {
      return createQueueCalls;
    },
    get workCalls() {
      return workCalls;
    },
    get offWorkCalls() {
      return offWorkCalls;
    },
    get queueState() {
      return queueState;
    },
    set queueState(value: QueueState | null) {
      queueState = value;
    },
    get nextWorkBatch() {
      return nextWorkBatch;
    },
    set nextWorkBatch(value: readonly PgBossJob[]) {
      nextWorkBatch = value;
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
      {
        name: "grant-credits",
        payload: { accountId: "acct_a", amount: 100 },
        id: undefined,
      },
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

describe("pg-boss idempotent enqueue (ADR-0211)", () => {
  test("passes a deterministic id derived from name + idempotencyKey", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { idempotencyKey: "retry-1" },
    );

    const expectedId = deriveIdempotentJobId("grant-credits", "retry-1");
    expect(client.sendCalls).toEqual([
      {
        name: "grant-credits",
        payload: { accountId: "acct_a", amount: 1 },
        id: expectedId,
      },
    ]);
    // UUID-shaped: 8-4-4-4-12 hex.
    expect(expectedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test("the same idempotencyKey always derives the same id; a different key derives a different id", () => {
    const idA1 = deriveIdempotentJobId("grant-credits", "retry-1");
    const idA2 = deriveIdempotentJobId("grant-credits", "retry-1");
    const idB = deriveIdempotentJobId("grant-credits", "retry-2");

    expect(idA1).toBe(idA2);
    expect(idA1).not.toBe(idB);
  });

  test("a repeated enqueue with the same key sends the same id twice (the driver relies on ON CONFLICT DO NOTHING, not client-side skipping)", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });
    const options = { idempotencyKey: "retry-1" };

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      options,
    );
    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      options,
    );

    expect(client.sendCalls).toHaveLength(2);
    expect(client.sendCalls[0]?.id).toBe(client.sendCalls[1]?.id);
  });

  test("without an idempotencyKey, no id is passed to send", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });

    expect(client.sendCalls[0]?.id).toBeUndefined();
  });
});

describe("pg-boss work() (ADR-0211)", () => {
  test("ensures the queue, then claims via client.work and runs the handler with the parsed payload", async () => {
    const received: Array<{ accountId: string; amount: number }> = [];
    const client = createFakeClient();
    client.nextWorkBatch = [
      { id: "job_1", data: { accountId: "acct_a", amount: 5 } },
    ];
    const queue = createPgBossJobQueue(
      [
        defineTask("grant-credits", grantCreditsSchema, async (payload) => {
          received.push(payload);
        }),
      ],
      { client },
    );

    const handle = await queue.work("grant-credits");

    expect(client.createQueueCalls).toEqual(["grant-credits"]);
    expect(client.workCalls).toEqual(["grant-credits"]);
    expect(received).toEqual([{ accountId: "acct_a", amount: 5 }]);

    await handle.stop();
    // The stop is scoped to THIS worker's id — a bare offWork(name) would stop every
    // worker on the queue in-process (sibling consumers included).
    expect(client.offWorkCalls).toEqual([
      { name: "grant-credits", id: "worker_fake" },
    ]);
  });

  test("rejects an unregistered task name before touching pg-boss", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await expect(queue.work("not-a-real-task")).rejects.toThrow(NotFoundError);
    expect(client.workCalls).toHaveLength(0);
    expect(client.createQueueCalls).toHaveLength(0);
  });

  test("a claimed job with a schema-invalid payload rejects via ValidationError (surfaced by pg-boss's own fail path)", async () => {
    const client = createFakeClient();
    client.nextWorkBatch = [{ id: "job_1", data: { accountId: "acct_a" } }];
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await expect(queue.work("grant-credits")).rejects.toThrow(ValidationError);
  });
});

describe("pg-boss getQueueState() (ADR-0211)", () => {
  test("maps client.getQueue's counts", async () => {
    const client = createFakeClient();
    client.queueState = { queuedCount: 3, activeCount: 1, failedCount: 2 };
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await expect(queue.getQueueState("grant-credits")).resolves.toEqual({
      queuedCount: 3,
      activeCount: 1,
      failedCount: 2,
    });
  });

  test("returns all-zero when the queue was never created (null, not an error)", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await expect(queue.getQueueState("never-created")).resolves.toEqual({
      queuedCount: 0,
      activeCount: 0,
      failedCount: 0,
    });
  });
});
