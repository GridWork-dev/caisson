// Trigger.dev production driver for the `JobQueue` port (ADR-0018, ADR-0211). Two mappings, one
// factory:
//
//   defineTask(name, schema, handler) -> a real Trigger.dev `task()` (the deploy-side worker —
//     when this module is bundled into a Trigger.dev deploy, `name` becomes the task `id` and
//     `handler` becomes its `run`, payload-validated against the SAME `.strict()` schema the
//     in-memory driver uses). This IS the real consumer — Trigger.dev's hosted platform runs it;
//     there is no separate local "start consuming" call in the SDK.
//
//   enqueue(name, payload, options) -> `tasks.trigger()` (the app-side call — validates locally
//     first so a bad payload throws `ValidationError` before it ever leaves the process, then
//     triggers the run on Trigger.dev's platform). `options.idempotencyKey` passes straight
//     through as `trigger()`'s native 3rd-arg option — no derived-id trick needed here, unlike
//     pg-boss (see `pgboss.ts`).
//
// Env-gated: `TRIGGER_SECRET_KEY` / `TRIGGER_API_URL` are read by the CALLER and injected via
// `config` — never a module-level constant. Calling `createTriggerJobQueue` without a `secretKey`
// and without an injected `client` throws `ConfigError` immediately (fail closed at construction,
// not at the first `enqueue`). Tests inject a fake `client` via `config.client`, so this driver
// never touches the network in `bun test`.
//
// Visibility-ledger gap (ADR-0211): this driver does NOT implement `JobLedger` — its return type
// carries no `getQueueState`. Trigger.dev exposes no local job-state read; the answer is the
// hosted Runs dashboard, or `runs.retrieve()` against a specific run id from the SDK's `runs`
// module (a new SDK surface beyond this slice's scope).
import {
  configure,
  task as defineTriggerTask,
  tasks as triggerTasks,
} from "@trigger.dev/sdk";
import { ConfigError, parseStrict } from "@caisson-sh/kernel";
import { createTaskRegistry, requireRegisteredTask } from "./task-registry.ts";
import type {
  EnqueueOptions,
  JobConsumer,
  JobQueue,
  TaskDefinition,
  WorkHandle,
} from "./queue.ts";

/**
 * The minimal surface of the Trigger.dev SDK this driver depends on for the enqueue leg. Real
 * usage is backed by `tasks.trigger()`; tests inject a fake/mock implementation here so `enqueue`
 * never hits the network.
 */
export interface TriggerClient {
  trigger(
    taskId: string,
    payload: unknown,
    options?: { idempotencyKey?: string },
  ): Promise<unknown>;
}

export interface TriggerJobQueueConfig {
  /** `TRIGGER_SECRET_KEY` — read by the caller's env and injected here, never a module constant. */
  secretKey?: string;
  /** `TRIGGER_API_URL` — optional; omitted defaults to Trigger.dev's hosted API. */
  apiUrl?: string;
  /**
   * Override the underlying Trigger client. Tests inject a fake/mock here instead of `secretKey`
   * so `enqueue` runs fully offline.
   */
  client?: TriggerClient;
}

/**
 * The Trigger.dev `JobQueue` driver. Registers every `task` as a real Trigger.dev task (the
 * deploy-side mapping) and returns a `JobQueue & JobConsumer` whose `enqueue` validates against
 * the same registry before triggering a run (the app-side mapping). Matches
 * `createInMemoryQueue`'s factory shape so the two drivers are interchangeable behind the port.
 */
export function createTriggerJobQueue(
  tasks: readonly TaskDefinition<unknown>[],
  config: TriggerJobQueueConfig,
): JobQueue & JobConsumer {
  const registry = createTaskRegistry(tasks);

  for (const task of tasks) {
    defineTriggerTask({
      id: task.name,
      run: async (payload: unknown): Promise<void> => {
        await task.handler(parseStrict(task.schema, payload));
      },
    });
  }

  const client = config.client ?? createSdkClient(config);

  return {
    async enqueue(
      name: string,
      payload: unknown,
      options?: EnqueueOptions,
    ): Promise<void> {
      const task = requireRegisteredTask(registry, name);
      const validated = parseStrict(task.schema, payload);
      // `options.singletonKey` (overlap-suppression, ADR-0229) is intentionally NOT mapped here —
      // Trigger.dev's HOSTED scheduler owns overlap for scheduled tasks (`trigger()` exposes no
      // singletonKey), so faking one client-side would be a lie. Honest no-op; revisit if this driver
      // ever drives an interval job that isn't Trigger-scheduled. `idempotencyKey` passes through native.
      const triggerOptions =
        options?.idempotencyKey !== undefined
          ? { idempotencyKey: options.idempotencyKey }
          : undefined;
      await client.trigger(name, validated, triggerOptions);
    },

    async work(name: string): Promise<WorkHandle> {
      requireRegisteredTask(registry, name);
      // Trigger.dev's real consumer is `defineTriggerTask` above, registered at construction —
      // there's no local "start consuming" call in the SDK, so work() is a no-op here for port
      // symmetry only.
      return {
        async stop(): Promise<void> {},
      };
    },
  };
}

/**
 * Builds the real Trigger.dev-backed client. Throws `ConfigError` when neither a `secretKey` nor
 * an injected `client` is provided — fail closed rather than silently no-op enqueueing.
 */
function createSdkClient(config: TriggerJobQueueConfig): TriggerClient {
  if (config.secretKey === undefined || config.secretKey.length === 0) {
    throw new ConfigError(
      "createTriggerJobQueue requires `secretKey` (TRIGGER_SECRET_KEY) or an injected `client` for tests",
    );
  }
  configure({
    accessToken: config.secretKey,
    ...(config.apiUrl !== undefined ? { baseURL: config.apiUrl } : {}),
  });
  return {
    trigger: (taskId: string, payload: unknown): Promise<unknown> =>
      triggerTasks.trigger(taskId, payload),
  };
}
