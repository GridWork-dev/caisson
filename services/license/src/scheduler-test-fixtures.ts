// Shared TEST fixtures for the three scheduler suites (abandoned-checkout, credit-expiry,
// anchoring): the recording fake JobQueue and the fake `createPgBossJobQueue`-shaped factory.
// Fixtures only — the production schedulers, task construction, cron rules, enumerators, and
// notification behavior deliberately stay separate per suite (C07's refuted bootstrap merge).
// Not exported from the service barrel; imported only by *.test.ts files.
import type {
  createPgBossJobQueue,
  EnqueueOptions,
  JobQueue,
} from "@caisson/jobs";

/** A JobQueue that records every enqueue; nothing else. */
export function createFakeQueue(): JobQueue & {
  readonly calls: ReadonlyArray<{
    name: string;
    payload: unknown;
    options: EnqueueOptions | undefined;
  }>;
} {
  const calls: Array<{
    name: string;
    payload: unknown;
    options: EnqueueOptions | undefined;
  }> = [];
  return {
    async enqueue(name, payload, options) {
      calls.push({ name, payload, options });
    },
    get calls() {
      return calls;
    },
  };
}

/** A fake `createPgBossJobQueue`-shaped factory: records registered task names + the tasks
 * THEMSELVES (so a test can invoke a real handler directly, proving actual wiring rather than a
 * hand-rolled duplicate), `work()` calls, `schedule()` calls, and the config each construction
 * received — without ever touching pg-boss. */
export function createFakeQueueFactory(): {
  factory: typeof createPgBossJobQueue;
  registeredTaskNames: string[];
  registeredTasks: Array<{
    name: string;
    handler: (payload: unknown) => Promise<void>;
  }>;
  workCalls: string[];
  scheduleCalls: Array<{ name: string; cron: string; data: unknown }>;
  configCalls: Parameters<typeof createPgBossJobQueue>[1][];
} {
  const registeredTaskNames: string[] = [];
  const registeredTasks: Array<{
    name: string;
    handler: (payload: unknown) => Promise<void>;
  }> = [];
  const workCalls: string[] = [];
  const scheduleCalls: Array<{ name: string; cron: string; data: unknown }> =
    [];
  const configCalls: Parameters<typeof createPgBossJobQueue>[1][] = [];
  const factory: typeof createPgBossJobQueue = (tasks, config) => {
    registeredTaskNames.push(...tasks.map((t) => t.name));
    registeredTasks.push(...tasks);
    configCalls.push(config);
    return {
      async enqueue() {},
      async work(name: string) {
        workCalls.push(name);
        return { async stop() {} };
      },
      async getQueueState() {
        return { queuedCount: 0, activeCount: 0, failedCount: 0 };
      },
      async schedule(name: string, cron: string, data?: object | null) {
        scheduleCalls.push({ name, cron, data: data ?? null });
      },
      async stop() {},
    };
  };
  return {
    factory,
    registeredTaskNames,
    registeredTasks,
    workCalls,
    scheduleCalls,
    configCalls,
  };
}
