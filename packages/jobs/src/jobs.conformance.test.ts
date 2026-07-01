// Shared port-conformance harness (ADR-0173): every `JobQueue` driver — in-memory, Trigger.dev,
// pg-boss — is looped here and asserted against the same one-method `JobQueue` port contract
// (`enqueue(name, payload): Promise<void>`). New drivers extend the `drivers` array below; no
// driver-specific assertions belong here (those live in each driver's own test file).
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { strictObject } from "@caisson/kernel";
import { createInMemoryQueue, defineTask, type JobQueue } from "./index.ts";
import { createTriggerJobQueue, type TriggerClient } from "./trigger-driver.ts";
import { createPgBossJobQueue, type PgBossClient } from "./pgboss.ts";

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
  };
}

const drivers: ReadonlyArray<{ name: string; queue: JobQueue }> = [
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
    name: "pg-boss",
    queue: createPgBossJobQueue({ client: fakePgBossClient() }),
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
