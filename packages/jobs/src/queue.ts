// @caisson-sh/jobs — provider-agnostic background-job queue PORT (ADR-0018). Billing/credit
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
import { parseStrict } from "@caisson-sh/kernel";
import { createTaskRegistry, requireRegisteredTask } from "./task-registry.ts";

/** A typed task: a name, the `.strict()` payload schema, and the handler that runs the work. */
export interface TaskDefinition<T> {
  name: string;
  schema: ZodType<T>;
  handler: (payload: T) => Promise<void>;
}

/**
 * Options for `enqueue` (ADR-0211). `idempotencyKey` makes a retried call a no-op: the same key
 * on the same task name produces at most one job — see each driver for its dedupe mechanism
 * (pg-boss: a deterministic PK id; Trigger.dev: native `idempotencyKey`; in-memory: a keyed Set).
 */
export interface EnqueueOptions {
  idempotencyKey?: string;
  /**
   * Overlap-safety (ADR-0229 row 56, the APScheduler `max_instances=1`/`coalesce` pattern): at most
   * one job with this key may be queued/active at once — a second enqueue while one is in flight is a
   * no-op. The recurring-job default so a slow run never stacks a second instance. Distinct from
   * `idempotencyKey` (which dedups a RETRY of one logical job); this suppresses concurrent OVERLAP.
   */
  singletonKey?: string;
}

/**
 * The queue port. Every driver (in-memory, Trigger.dev, pg-boss) implements this one method; the
 * credit / billing path depends only on this contract, so the side-effect stays decoupled +
 * swappable. `options` is optional — every existing 2-arg caller keeps compiling.
 */
export interface JobQueue {
  enqueue(
    name: string,
    payload: unknown,
    options?: EnqueueOptions,
  ): Promise<void>;
}

/** A running consumer's handle. `stop()` releases whatever `work()` claimed/subscribed. */
export interface WorkHandle {
  stop(): Promise<void>;
}

/**
 * The claim/worker port (ADR-0211). `work(name)` resolves against the SAME `TaskDefinition`
 * registry `enqueue` uses — no second handler, no drift — and 404s (`NotFoundError`) on an
 * unregistered name. pg-boss consumes for real (native SKIP LOCKED); in-memory and Trigger.dev
 * are honest no-ops (see each driver for why).
 */
export interface JobConsumer {
  work(name: string): Promise<WorkHandle>;
}

/** The smallest honest visibility read: driver-reported job counts for one queue name. */
export interface QueueState {
  queuedCount: number;
  activeCount: number;
  failedCount: number;
}

/**
 * The visibility-ledger port (ADR-0211). Not every driver can answer it truthfully — Trigger.dev
 * has no local read, so it does not implement this port at all (see `trigger-driver.ts`).
 */
export interface JobLedger {
  getQueueState(name: string): Promise<QueueState>;
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
 *
 * `idempotencyKey` dedupe is a `Set<"name\0key">` on the closure: a repeat key is a no-op (the
 * handler is not re-invoked, no error). `singletonKey` overlap-safety is a second `Set` tracking
 * IN-FLIGHT keys: a same-key enqueue while its handler is still running is a no-op, then the key frees
 * on completion (so the next interval tick runs). A handler that throws increments a per-name failure
 * counter, read back via `getQueueState`.
 */
export function createInMemoryQueue(
  tasks: readonly TaskDefinition<unknown>[],
): JobQueue & JobConsumer & JobLedger {
  const registry = createTaskRegistry(tasks);
  const seenIdempotencyKeys = new Set<string>();
  const inFlightSingletonKeys = new Set<string>();
  const failureCounts = new Map<string, number>();

  return {
    async enqueue(
      name: string,
      payload: unknown,
      options?: EnqueueOptions,
    ): Promise<void> {
      const task = requireRegisteredTask(registry, name);
      const validated = parseStrict(task.schema, payload);

      // Overlap suppression FIRST — a run already in flight for this singletonKey drops this enqueue
      // without recording anything (so it can't consume the idempotencyKey slot on the way out).
      let singletonHeld: string | undefined;
      if (options?.singletonKey !== undefined) {
        const sk = `${name}\0${options.singletonKey}`;
        if (inFlightSingletonKeys.has(sk)) return;
        inFlightSingletonKeys.add(sk);
        singletonHeld = sk;
      }

      try {
        if (options?.idempotencyKey !== undefined) {
          const dedupeKey = `${name}\0${options.idempotencyKey}`;
          if (seenIdempotencyKeys.has(dedupeKey)) {
            return;
          }
          seenIdempotencyKeys.add(dedupeKey);
        }
        await task.handler(validated);
      } catch (error) {
        failureCounts.set(name, (failureCounts.get(name) ?? 0) + 1);
        throw error;
      } finally {
        // Release only once the handler settles — the window the overlap check guards.
        if (singletonHeld !== undefined)
          inFlightSingletonKeys.delete(singletonHeld);
      }
    },

    async work(name: string): Promise<WorkHandle> {
      requireRegisteredTask(registry, name);
      // No backlog to poll in-memory — work() exists for port symmetry with the durable drivers.
      return {
        async stop(): Promise<void> {},
      };
    },

    async getQueueState(name: string): Promise<QueueState> {
      // An honest zero, not a fake pending-count — the in-memory driver has no backlog to report.
      return {
        queuedCount: 0,
        activeCount: 0,
        failedCount: failureCounts.get(name) ?? 0,
      };
    },
  };
}
