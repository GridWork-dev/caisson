// @caisson/jobs — provider-agnostic background-job queue PORT (ADR-0018). Billing/credit
// side-effects are ENQUEUED through this port, never called inline: the credit/ledger write stays
// synchronous + transactional while email/downstream side-effects run as durable retried jobs
// (e.g. `credit.granted` → `send-receipt` task → Emailer.send). Payloads are Zod-`.strict()` typed.
//
// Drivers: this file ships the in-memory/synchronous driver (tests + the framework-agnostic
// reference) — `enqueue` validates the payload then awaits the handler, so a unit test asserts
// "this event enqueued that task with that payload" with no daemon or network. The production
// driver is **Trigger.dev** (self-hostable; first-class retries, scheduling, observability) —
// documented here, wired in a later phase. It implements the same `JobQueue` port, so enqueuing
// callers never change when the driver is swapped.
import type { ZodType } from "zod";
import { NotFoundError, parseStrict } from "@caisson/kernel";

/** A typed task: a name, the `.strict()` payload schema, and the handler that runs the work. */
export interface TaskDefinition<T> {
  name: string;
  schema: ZodType<T>;
  handler: (payload: T) => Promise<void>;
}

/**
 * The queue port. Every driver (in-memory, Trigger.dev) implements this one method; the credit /
 * billing path depends only on this contract, so the side-effect stays decoupled + swappable.
 */
export interface JobQueue {
  enqueue(name: string, payload: unknown): Promise<void>;
}

/**
 * Define a typed task. `T` is inferred from `schema`, which pins the handler's payload type — a
 * schema/handler mismatch is a compile error. The returned task erases its generic to
 * `TaskDefinition<unknown>` so a registry array stays homogeneous; the schema remains the runtime
 * validator boundary (the queue parses against it before the handler runs).
 */
export function defineTask<T>(
  name: string,
  schema: ZodType<T>,
  handler: (payload: T) => Promise<void>,
): TaskDefinition<unknown> {
  return {
    name,
    schema,
    handler: (payload: unknown): Promise<void> => handler(payload as T),
  };
}

/**
 * The in-memory/synchronous driver. `enqueue` finds the task by name (404 if unregistered),
 * validates the payload against its `.strict()` schema (`ValidationError` on a bad payload), then
 * awaits the handler — synchronous execution is what makes side-effects assertable in a unit test.
 */
export function createInMemoryQueue(
  tasks: readonly TaskDefinition<unknown>[],
): JobQueue {
  const registry = new Map<string, TaskDefinition<unknown>>(
    tasks.map((task) => [task.name, task]),
  );
  return {
    async enqueue(name: string, payload: unknown): Promise<void> {
      const task = registry.get(name);
      if (task === undefined) {
        throw new NotFoundError(`No task registered for "${name}"`, {
          task: name,
        });
      }
      const validated = parseStrict(task.schema, payload);
      await task.handler(validated);
    },
  };
}
