import { describe, expect, test } from "bun:test";
import { z } from "zod";
import {
  ConfigError,
  NotFoundError,
  strictObject,
  ValidationError,
} from "@caisson-sh/kernel";
import { defineTask } from "./queue.ts";
import type { QueueState } from "./queue.ts";
import {
  createPgBossJobQueue,
  deriveIdempotentJobId,
  wireBossErrorHandler,
  type JobAlertingDeps,
  type PgBossClient,
  type PgBossErrorEmitter,
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
    singletonKey: string | undefined;
  }>;
  readonly createQueueCalls: readonly string[];
  readonly workCalls: readonly string[];
  readonly offWorkCalls: ReadonlyArray<{
    name: string;
    id: string | undefined;
  }>;
  readonly scheduleCalls: ReadonlyArray<{
    name: string;
    cron: string;
    data: object | null;
    tz: string | undefined;
  }>;
  readonly stopCalls: number;
  queueState: QueueState | null;
  /** Set to make the next `work()` immediately deliver this batch to its handler. */
  nextWorkBatch: readonly PgBossJob[];
} {
  const sendCalls: Array<{
    name: string;
    payload: unknown;
    id: string | undefined;
    singletonKey: string | undefined;
  }> = [];
  const createQueueCalls: string[] = [];
  const workCalls: string[] = [];
  const offWorkCalls: Array<{ name: string; id: string | undefined }> = [];
  const scheduleCalls: Array<{
    name: string;
    cron: string;
    data: object | null;
    tz: string | undefined;
  }> = [];
  let queueState: QueueState | null = null;
  let nextWorkBatch: readonly PgBossJob[] = [];
  let stopCalls = 0;
  return {
    async start() {
      return undefined;
    },
    async stop() {
      stopCalls += 1;
    },
    async createQueue(name) {
      createQueueCalls.push(name);
    },
    async send(name, payload, options) {
      sendCalls.push({
        name,
        payload,
        id: options?.id,
        singletonKey: options?.singletonKey,
      });
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
    async schedule(name, cron, data, options) {
      scheduleCalls.push({ name, cron, data: data ?? null, tz: options?.tz });
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
    get scheduleCalls() {
      return scheduleCalls;
    },
    get stopCalls() {
      return stopCalls;
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
        singletonKey: undefined,
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
        singletonKey: undefined,
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

describe("pg-boss overlap-safe enqueue (singletonKey, ADR-0229 row 56)", () => {
  test("passes singletonKey straight through to boss.send (native overlap suppression)", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { singletonKey: "tenant_a:subject_1" },
    );

    expect(client.sendCalls[0]?.singletonKey).toBe("tenant_a:subject_1");
    // No id — singletonKey is overlap-safety, not the idempotency-retry id.
    expect(client.sendCalls[0]?.id).toBeUndefined();
  });

  test("idempotencyKey and singletonKey can ride one send together", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { idempotencyKey: "retry-1", singletonKey: "k" },
    );

    expect(client.sendCalls[0]?.id).toBe(
      deriveIdempotentJobId("grant-credits", "retry-1"),
    );
    expect(client.sendCalls[0]?.singletonKey).toBe("k");
  });

  test("without a singletonKey, none is passed to send", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });

    expect(client.sendCalls[0]?.singletonKey).toBeUndefined();
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

describe("pg-boss work() task-failure alerting (CAISSON-53)", () => {
  test("reports the failure through JobAlertingDeps, then re-throws (retry semantics preserved)", async () => {
    const client = createFakeClient();
    client.nextWorkBatch = [
      { id: "job_1", data: { accountId: "acct_a", amount: 5 } },
    ];
    const reported: Array<{ taskName: string; error: unknown }> = [];
    const alerting: JobAlertingDeps = {
      async reportTaskFailure(taskName, error) {
        reported.push({ taskName, error });
      },
      async reportInfraError() {},
    };
    const boom = new Error("handler boom");
    const queue = createPgBossJobQueue(
      [
        defineTask("grant-credits", grantCreditsSchema, async () => {
          throw boom;
        }),
      ],
      { client, alerting },
    );

    await expect(queue.work("grant-credits")).rejects.toBe(boom);
    expect(reported).toEqual([{ taskName: "grant-credits", error: boom }]);
  });

  test("a schema-invalid payload also alerts (not just a handler throw), then re-throws ValidationError", async () => {
    const client = createFakeClient();
    // Missing `amount` — fails grantCreditsSchema before the handler ever runs.
    client.nextWorkBatch = [{ id: "job_1", data: { accountId: "acct_a" } }];
    const reported: Array<{ taskName: string; error: unknown }> = [];
    const alerting: JobAlertingDeps = {
      async reportTaskFailure(taskName, error) {
        reported.push({ taskName, error });
      },
      async reportInfraError() {},
    };
    const queue = createPgBossJobQueue(grantCreditsTasks, { client, alerting });

    await expect(queue.work("grant-credits")).rejects.toThrow(ValidationError);
    expect(reported).toHaveLength(1);
    expect(reported[0]?.taskName).toBe("grant-credits");
    expect(reported[0]?.error).toBeInstanceOf(ValidationError);
  });

  test("an alerting failure never masks the original error or blocks the re-throw", async () => {
    const client = createFakeClient();
    client.nextWorkBatch = [
      { id: "job_1", data: { accountId: "acct_a", amount: 5 } },
    ];
    const alerting: JobAlertingDeps = {
      async reportTaskFailure() {
        throw new Error("alerting itself is down");
      },
      async reportInfraError() {},
    };
    const boom = new Error("handler boom");
    const queue = createPgBossJobQueue(
      [
        defineTask("grant-credits", grantCreditsSchema, async () => {
          throw boom;
        }),
      ],
      { client, alerting },
    );

    await expect(queue.work("grant-credits")).rejects.toBe(boom);
  });

  test("without alerting configured, a task failure still re-throws (today's behavior unchanged)", async () => {
    const client = createFakeClient();
    client.nextWorkBatch = [
      { id: "job_1", data: { accountId: "acct_a", amount: 5 } },
    ];
    const boom = new Error("handler boom");
    const queue = createPgBossJobQueue(
      [
        defineTask("grant-credits", grantCreditsSchema, async () => {
          throw boom;
        }),
      ],
      { client },
    );

    await expect(queue.work("grant-credits")).rejects.toBe(boom);
  });
});

describe("wireBossErrorHandler (CAISSON-53 — an unhandled pg-boss 'error' event crashes the process)", () => {
  function fakeEmitter(): PgBossErrorEmitter & { emit(error: Error): void } {
    let listener: ((error: Error) => void) | undefined;
    return {
      on(event: "error", cb: (error: Error) => void) {
        if (event === "error") listener = cb;
        return undefined;
      },
      emit(error: Error) {
        listener?.(error);
      },
    };
  }

  test("routes to alerting.reportInfraError when alerting is configured", () => {
    const emitter = fakeEmitter();
    const reported: unknown[] = [];
    const alerting: JobAlertingDeps = {
      async reportTaskFailure() {},
      async reportInfraError(error) {
        reported.push(error);
      },
    };
    wireBossErrorHandler(emitter, alerting, () => {
      throw new Error("log must not be called when alerting is configured");
    });

    const err = new Error("connection lost");
    emitter.emit(err);

    expect(reported).toEqual([err]);
  });

  test("falls back to the log seam when alerting is not configured", () => {
    const emitter = fakeEmitter();
    const logs: string[] = [];
    wireBossErrorHandler(emitter, undefined, (message) => logs.push(message));

    emitter.emit(new Error("connection lost"));

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("connection lost");
  });
});

describe("pg-boss schedule() (ADR-0256)", () => {
  test("ensures the queue, then calls client.schedule with the given cron + data", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.schedule("grant-credits", "0 3 * * *", { foo: "bar" });

    expect(client.createQueueCalls).toEqual(["grant-credits"]);
    expect(client.scheduleCalls).toEqual([
      {
        name: "grant-credits",
        cron: "0 3 * * *",
        data: { foo: "bar" },
        tz: undefined,
      },
    ]);
  });

  test("passes tz through when given", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.schedule("grant-credits", "0 3 * * *", null, {
      tz: "America/Chicago",
    });

    expect(client.scheduleCalls[0]?.tz).toBe("America/Chicago");
  });

  test("rejects an unregistered task name before touching pg-boss", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await expect(
      queue.schedule("not-a-real-task", "0 3 * * *"),
    ).rejects.toThrow(NotFoundError);
    expect(client.scheduleCalls).toHaveLength(0);
    expect(client.createQueueCalls).toHaveLength(0);
  });
});

describe("pg-boss stop() (WR-01: a short-lived caller must be able to release the client)", () => {
  test("delegates to client.stop() once the client was lazily started", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 100 });
    expect(client.stopCalls).toBe(0); // not stopped just by using it

    await queue.stop();

    expect(client.stopCalls).toBe(1);
  });

  test("is a safe no-op when the client was never lazily started", async () => {
    const client = createFakeClient();
    const queue = createPgBossJobQueue(grantCreditsTasks, { client });

    await queue.stop(); // enqueue/work/schedule never called — no client to stop

    expect(client.stopCalls).toBe(0);
  });
});
