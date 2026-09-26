import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  ConfigError,
  NotFoundError,
  strictObject,
  ValidationError,
} from "@caisson-sh/kernel";
import { defineTask } from "./queue.ts";
import {
  createBullMqJobQueue,
  deriveIdempotentJobId,
  type BullMqAddOptions,
  type BullMqJobData,
  type BullMqQueueClient,
  type BullMqWorkerClient,
} from "./index.ts";

const grantCreditsSchema = strictObject({
  accountId: z.string(),
  amount: z.number(),
});

/** A fake `Queue` client recording every call instead of touching Redis. */
function createFakeQueue(): BullMqQueueClient & {
  readonly addCalls: ReadonlyArray<{
    name: string;
    data: unknown;
    opts?: BullMqAddOptions;
  }>;
  readonly schedulerCalls: ReadonlyArray<{
    id: string;
    repeat: { pattern: string; tz?: string };
    template?: { name: string; data?: unknown };
  }>;
  readonly closed: () => number;
  counts: Record<string, number>;
} {
  const addCalls: Array<{
    name: string;
    data: unknown;
    opts?: BullMqAddOptions;
  }> = [];
  const schedulerCalls: Array<{
    id: string;
    repeat: { pattern: string; tz?: string };
    template?: { name: string; data?: unknown };
  }> = [];
  let closeCount = 0;
  let counts: Record<string, number> = {};
  return {
    async add(name, data, opts) {
      addCalls.push({ name, data, ...(opts ? { opts } : {}) });
      return { id: "job_fake" };
    },
    async getJobCounts() {
      return counts;
    },
    async upsertJobScheduler(id, repeat, template) {
      schedulerCalls.push({ id, repeat, ...(template ? { template } : {}) });
      return undefined;
    },
    async close() {
      closeCount += 1;
    },
    get addCalls() {
      return addCalls;
    },
    get schedulerCalls() {
      return schedulerCalls;
    },
    closed() {
      return closeCount;
    },
    get counts() {
      return counts;
    },
    set counts(value: Record<string, number>) {
      counts = value;
    },
  };
}

const grantCreditsTasks = [
  defineTask("grant-credits", grantCreditsSchema, async () => {}),
];

test("BullMQ v6's optional peer remains a direct runtime dependency", () => {
  const packageJson = JSON.parse(
    readFileSync(join(import.meta.dir, "../package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  // ^6.0.0 reviewed 2026-08-10: bullmq@6.0.0 declares ioredis ">=5.0.0" (optional peer), the
  // driver passes the caller's connection through unchanged, and nothing in-repo imports ioredis.
  expect(packageJson.dependencies?.ioredis).toBe("^6.0.0");
});

describe("BullMQ job queue", () => {
  test("enqueue maps to queue.add with the given name and payload", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 100 });

    expect(q.addCalls).toEqual([
      { name: "grant-credits", data: { accountId: "acct_a", amount: 100 } },
    ]);
  });

  test("one queue is created per task name and reused on repeat sends", async () => {
    let created = 0;
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => {
        created += 1;
        return q;
      },
    });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });
    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 2 });

    expect(created).toBe(1);
    expect(q.addCalls).toHaveLength(2);
  });

  test("enqueue rejects an unregistered task name before touching BullMQ", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await expect(
      queue.enqueue("not-a-real-task", { accountId: "acct_a", amount: 1 }),
    ).rejects.toThrow(NotFoundError);
    expect(q.addCalls).toHaveLength(0);
  });

  test("enqueue rejects a schema-invalid payload before touching BullMQ", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await expect(
      queue.enqueue("grant-credits", { accountId: "acct_a" }),
    ).rejects.toThrow(ValidationError);
    expect(q.addCalls).toHaveLength(0);
  });

  test("constructing without a connection or factory throws ConfigError", () => {
    expect(() => createBullMqJobQueue(grantCreditsTasks, {})).toThrow(
      ConfigError,
    );
  });
});

describe("BullMQ idempotent + overlap-safe enqueue (ADR-0211 / ADR-0229 row 56)", () => {
  test("idempotencyKey maps to a deterministic native jobId", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { idempotencyKey: "retry-1" },
    );

    expect(q.addCalls[0]?.opts).toEqual({
      jobId: deriveIdempotentJobId("grant-credits", "retry-1"),
    });
  });

  test("singletonKey maps to BullMQ Simple-Mode deduplication", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { singletonKey: "tenant_a:subject_1" },
    );

    expect(q.addCalls[0]?.opts).toEqual({
      deduplication: { id: "tenant_a:subject_1" },
    });
  });

  test("idempotencyKey and singletonKey can ride one add", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await queue.enqueue(
      "grant-credits",
      { accountId: "acct_a", amount: 1 },
      { idempotencyKey: "retry-1", singletonKey: "k" },
    );

    expect(q.addCalls[0]?.opts).toEqual({
      jobId: deriveIdempotentJobId("grant-credits", "retry-1"),
      deduplication: { id: "k" },
    });
  });

  test("without options, no add-options are passed", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });

    expect(q.addCalls[0]?.opts).toBeUndefined();
  });
});

describe("BullMQ work() (ADR-0211)", () => {
  test("claims via workerFactory, runs the handler with the parsed payload, and stop() closes the worker", async () => {
    const received: Array<{ accountId: string; amount: number }> = [];
    let closed = 0;
    let capturedProcessor: ((job: BullMqJobData) => Promise<void>) | undefined;
    const worker: BullMqWorkerClient = {
      async close() {
        closed += 1;
      },
    };
    const queue = createBullMqJobQueue(
      [
        defineTask("grant-credits", grantCreditsSchema, async (payload) => {
          received.push(payload);
        }),
      ],
      {
        queueFactory: () => createFakeQueue(),
        workerFactory: (_name, processor) => {
          capturedProcessor = processor;
          return worker;
        },
      },
    );

    const handle = await queue.work("grant-credits");
    // Deliver a job through the captured processor (what BullMQ's Worker would call).
    await capturedProcessor?.({
      name: "grant-credits",
      data: { accountId: "acct_a", amount: 5 },
    });

    expect(received).toEqual([{ accountId: "acct_a", amount: 5 }]);

    await handle.stop();
    expect(closed).toBe(1);
  });

  test("a claimed job with a schema-invalid payload rejects via ValidationError", async () => {
    let capturedProcessor: ((job: BullMqJobData) => Promise<void>) | undefined;
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => createFakeQueue(),
      workerFactory: (_name, processor) => {
        capturedProcessor = processor;
        return { async close() {} };
      },
    });

    await queue.work("grant-credits");
    await expect(
      capturedProcessor?.({
        name: "grant-credits",
        data: { accountId: "acct_a" },
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("rejects an unregistered task name before building a worker", async () => {
    let built = 0;
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => createFakeQueue(),
      workerFactory: () => {
        built += 1;
        return { async close() {} };
      },
    });

    await expect(queue.work("not-a-real-task")).rejects.toThrow(NotFoundError);
    expect(built).toBe(0);
  });
});

describe("BullMQ getQueueState() (ADR-0211)", () => {
  test("maps waiting/active/failed job counts", async () => {
    const q = createFakeQueue();
    q.counts = { waiting: 3, active: 1, failed: 2 };
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await expect(queue.getQueueState("grant-credits")).resolves.toEqual({
      queuedCount: 3,
      activeCount: 1,
      failedCount: 2,
    });
  });

  test("missing count keys default to zero", async () => {
    const q = createFakeQueue();
    q.counts = {};
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await expect(queue.getQueueState("grant-credits")).resolves.toEqual({
      queuedCount: 0,
      activeCount: 0,
      failedCount: 0,
    });
  });
});

describe("BullMQ schedule() (ADR-0256 parity)", () => {
  test("upserts a job scheduler with the cron pattern + template data", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await queue.schedule("grant-credits", "0 3 * * *", { foo: "bar" });

    expect(q.schedulerCalls).toEqual([
      {
        id: "grant-credits",
        repeat: { pattern: "0 3 * * *" },
        template: { name: "grant-credits", data: { foo: "bar" } },
      },
    ]);
  });

  test("passes tz through when given", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await queue.schedule("grant-credits", "0 3 * * *", null, {
      tz: "America/Chicago",
    });

    expect(q.schedulerCalls[0]?.repeat).toEqual({
      pattern: "0 3 * * *",
      tz: "America/Chicago",
    });
    // null data → no `data` key in the template.
    expect(q.schedulerCalls[0]?.template).toEqual({ name: "grant-credits" });
  });

  test("rejects an unregistered task name before touching BullMQ", async () => {
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
    });

    await expect(
      queue.schedule("not-a-real-task", "0 3 * * *"),
    ).rejects.toThrow(NotFoundError);
    expect(q.schedulerCalls).toHaveLength(0);
  });
});

describe("BullMQ graceful shutdown", () => {
  test("close() closes every created worker and queue", async () => {
    let workerClosed = 0;
    const q = createFakeQueue();
    const queue = createBullMqJobQueue(grantCreditsTasks, {
      queueFactory: () => q,
      workerFactory: () => ({
        async close() {
          workerClosed += 1;
        },
      }),
    });

    await queue.enqueue("grant-credits", { accountId: "acct_a", amount: 1 });
    await queue.work("grant-credits");
    await queue.close();

    expect(workerClosed).toBe(1);
    expect(q.closed()).toBe(1);
  });
});
