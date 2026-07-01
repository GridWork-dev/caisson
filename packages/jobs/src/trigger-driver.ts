// Trigger.dev production driver for the `JobQueue` port (ADR-0018). Two mappings, one factory:
//
//   defineTask(name, schema, handler) -> a real Trigger.dev `task()` (the deploy-side worker —
//     when this module is bundled into a Trigger.dev deploy, `name` becomes the task `id` and
//     `handler` becomes its `run`, payload-validated against the SAME `.strict()` schema the
//     in-memory driver uses).
//
//   enqueue(name, payload) -> `tasks.trigger()` (the app-side call — validates locally first so a
//     bad payload throws `ValidationError` before it ever leaves the process, then triggers the
//     run on Trigger.dev's platform).
//
// Env-gated: `TRIGGER_SECRET_KEY` / `TRIGGER_API_URL` are read by the CALLER and injected via
// `config` — never a module-level constant. Calling `createTriggerJobQueue` without a `secretKey`
// and without an injected `client` throws `ConfigError` immediately (fail closed at construction,
// not at the first `enqueue`). Tests inject a fake `client` via `config.client`, so this driver
// never touches the network in `bun test`.
import {
  configure,
  task as defineTriggerTask,
  tasks as triggerTasks,
} from "@trigger.dev/sdk";
import { ConfigError, NotFoundError, parseStrict } from "@caisson/kernel";
import type { JobQueue, TaskDefinition } from "./queue.ts";

/**
 * The minimal surface of the Trigger.dev SDK this driver depends on for the enqueue leg. Real
 * usage is backed by `tasks.trigger()`; tests inject a fake/mock implementation here so `enqueue`
 * never hits the network.
 */
export interface TriggerClient {
  trigger(taskId: string, payload: unknown): Promise<unknown>;
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
 * deploy-side mapping) and returns a `JobQueue` whose `enqueue` validates against the same
 * registry before triggering a run (the app-side mapping). Matches `createInMemoryQueue`'s
 * factory shape so the two drivers are interchangeable behind the port.
 */
export function createTriggerJobQueue(
  tasks: readonly TaskDefinition<unknown>[],
  config: TriggerJobQueueConfig,
): JobQueue {
  const registry = new Map<string, TaskDefinition<unknown>>(
    tasks.map((task) => [task.name, task]),
  );

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
    async enqueue(name: string, payload: unknown): Promise<void> {
      const task = registry.get(name);
      if (task === undefined) {
        throw new NotFoundError(`No task registered for "${name}"`, {
          task: name,
        });
      }
      const validated = parseStrict(task.schema, payload);
      await client.trigger(name, validated);
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
