// Shared port-conformance harness (ADR-0173): every `JobQueue` driver — in-memory, Trigger.dev,
// pg-boss — is looped here and asserted against the same one-method `JobQueue` port contract
// (`enqueue(name, payload): Promise<void>`). New drivers extend the `drivers` array below; no
// driver-specific assertions belong here (those live in each driver's own test file).
import { describe, expect, test } from "bun:test";
import { Inngest } from "inngest";
import { z } from "zod";
import { strictObject } from "@caisson-sh/kernel";
import {
  createInMemoryQueue,
  createInngestJobQueue,
  defineTask,
  type JobConsumer,
  type JobQueue,
} from "./index.ts";
import { createTriggerJobQueue, type TriggerClient } from "./trigger-driver.ts";
import { createPgBossJobQueue, type PgBossClient } from "./pgboss.ts";
import {
  createBullMqJobQueue,
  type BullMqQueueClient,
  type BullMqWorkerClient,
} from "./bullmq.ts";

const payloadSchema = strictObject({ ok: z.boolean() });

const taskName = "conformance-task";
const payload = { ok: true };

function fakeTriggerClient(): TriggerClient {
  return {
    async trigger() {
      return { id: "run_fake" };
    },
  };
}

function fakeInngestClient(): Inngest {
  const testFetch = (async () =>
    Response.json({
      ids: ["evt_fake"],
      status: 200,
    })) as unknown as typeof fetch;
  return new Inngest({
    id: "caisson-jobs-conformance",
    eventKey: "test-event-key",
    fetch: testFetch,
    isDev: false,
  });
}

function fakePgBossClient(): PgBossClient {
  return {
    async start() {
      return undefined;
    },
    async createQueue() {
      return undefined;
    },
    async send() {
      return "job_fake";
    },
    async work(_name, handler) {
      await handler([]);
      return "worker_fake";
    },
    async offWork() {
      return undefined;
    },
    async getQueue() {
      return null;
    },
    async schedule() {
      return undefined;
    },
    async stop() {
      return undefined;
    },
  };
}

function fakeBullMqQueue(): BullMqQueueClient {
  return {
    async add() {
      return { id: "job_fake" };
    },
    async getJobCounts() {
      return { waiting: 0, active: 0, failed: 0 };
    },
    async upsertJobScheduler() {
      return undefined;
    },
    async close() {
      return undefined;
    },
  };
}

function fakeBullMqWorker(): BullMqWorkerClient {
  return {
    async close() {
      return undefined;
    },
  };
}

const drivers: ReadonlyArray<{ name: string; queue: JobQueue & JobConsumer }> =
  [
    {
      name: "in-memory",
      queue: createInMemoryQueue([
        defineTask(taskName, payloadSchema, async () => {}),
      ]),
    },
    {
      name: "trigger.dev",
      queue: createTriggerJobQueue(
        [defineTask(taskName, payloadSchema, async () => {})],
        { client: fakeTriggerClient() },
      ),
    },
    {
      name: "inngest",
      queue: createInngestJobQueue(
        [defineTask(taskName, payloadSchema, async () => {})],
        { client: fakeInngestClient() },
      ),
    },
    {
      name: "pg-boss",
      queue: createPgBossJobQueue(
        [defineTask(taskName, payloadSchema, async () => {})],
        { client: fakePgBossClient() },
      ),
    },
    {
      name: "bullmq",
      queue: createBullMqJobQueue(
        [defineTask(taskName, payloadSchema, async () => {})],
        {
          queueFactory: () => fakeBullMqQueue(),
          workerFactory: () => fakeBullMqWorker(),
        },
      ),
    },
  ];

describe("JobQueue port conformance", () => {
  for (const { name, queue } of drivers) {
    test(`${name} driver satisfies the JobQueue port`, async () => {
      expect(typeof queue.enqueue).toBe("function");
      await expect(queue.enqueue(taskName, payload)).resolves.toBeUndefined();
    });
  }
});

// ADR-0211: weak smoke only — an `idempotencyKey` is accepted without throwing on every driver.
// The strong "a repeat key produces exactly one job" assertion is per-driver (each driver's own
// dedupe mechanism differs), per this file's "no driver-specific assertions here" rule.
describe("JobQueue port conformance — idempotent enqueue (ADR-0211)", () => {
  for (const { name, queue } of drivers) {
    test(`${name} driver accepts an idempotencyKey option`, async () => {
      await expect(
        queue.enqueue(taskName, payload, { idempotencyKey: "conformance-1" }),
      ).resolves.toBeUndefined();
    });
  }
});

// ADR-0211: `work(name)` resolves to a stoppable `WorkHandle` on every driver — pg-boss consumes
// for real, in-memory/Trigger.dev are honest no-ops (see each driver's own test file).
describe("JobQueue port conformance — work() (ADR-0211)", () => {
  for (const { name, queue } of drivers) {
    test(`${name} driver's work() resolves a WorkHandle whose stop() is callable`, async () => {
      const handle = await queue.work(taskName);
      expect(typeof handle.stop).toBe("function");
      await expect(handle.stop()).resolves.toBeUndefined();
    });
  }
});
