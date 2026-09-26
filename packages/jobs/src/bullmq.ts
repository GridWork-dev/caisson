// BullMQ (Redis) production driver for the `JobQueue` port (ADR-0173, ADR-0211, ADR-0287). A thin
// wrapper over BullMQ's Redis-backed queue — `enqueue(name, payload)` validates against the same task
// registry the in-memory + Trigger.dev + pg-boss drivers use, then maps to `queue.add(name, payload)`.
//
// Env-gated: the Redis `connection` (built by the CALLER from `REDIS_URL`) is injected via `config` —
// never a module-level constant. Calling `createBullMqJobQueue` without a `connection` and without an
// injected `queueFactory` throws `ConfigError` immediately (fail closed at construction, matching the
// other drivers). Tests inject fake `queueFactory`/`workerFactory` via `config`, so this driver never
// touches Redis in `bun test`.
//
// One BullMQ `Queue` (and, on `work`, one `Worker`) is created per task name, lazily and cached. The
// caller's injected `connection` MUST set ioredis `maxRetriesPerRequest: null` for the Worker's
// blocking connection — that is BullMQ's requirement and is left to the caller who owns the URL.
//
// Idempotent enqueue (ADR-0211): `idempotencyKey` maps to BullMQ's native custom `jobId` (reusing
// `deriveIdempotentJobId` from the pg-boss driver — a duplicate jobId is not re-added). Overlap-safety
// (ADR-0229 row 56): `singletonKey` maps to BullMQ's Simple-Mode `deduplication: { id }` — while a job
// with that id is unfinished, any subsequent add with the same id is ignored, i.e. at most one
// queued/active at a time. Distinct concerns, so both can ride one `add`.
//
// Retention ceiling on idempotency: BullMQ's jobId de-dup only holds while the job's Redis hash
// still exists. Once a completed job is removed (the caller's own `removeOnComplete` policy on
// `Worker`/`Queue`, or a TTL/cleanup sweep) its jobId is free again — a LATE retry reusing the same
// `idempotencyKey` after that point re-enqueues rather than no-op'ing. This mirrors pg-boss's own
// archive-retention ceiling (its `ON CONFLICT DO NOTHING` uniqueness only holds until the job row is
// archived/purged) — "idempotent" here means "within the driver's retention window," not forever.
//
// Graceful shutdown: `close()` closes every Worker first (stop claiming), then every Queue (release
// the Redis connections). Each `work()` handle's `stop()` closes only its own Worker.
import { Queue, Worker } from "bullmq";
import type { ConnectionOptions, Job, JobType } from "bullmq";
import { ConfigError, parseStrict } from "@caisson-sh/kernel";
import { createTaskRegistry, requireRegisteredTask } from "./task-registry.ts";
import { deriveIdempotentJobId } from "./pgboss.ts";
import type {
  EnqueueOptions,
  JobConsumer,
  JobLedger,
  JobQueue,
  QueueState,
  TaskDefinition,
  WorkHandle,
} from "./queue.ts";

/** The add-options subset this driver sets — BullMQ's `JobsOptions` is a superset. */
export interface BullMqAddOptions {
  jobId?: string;
  deduplication?: { id: string };
}

/** A claimed job as BullMQ's `Worker` processor delivers it (the fields this driver reads). */
export interface BullMqJobData {
  readonly name: string;
  readonly data: unknown;
}

/** The minimal `Queue` surface this driver depends on. Real usage is a BullMQ `Queue`; tests inject a
 *  fake so this driver never hits Redis. */
export interface BullMqQueueClient {
  add(name: string, data: unknown, opts?: BullMqAddOptions): Promise<unknown>;
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
  upsertJobScheduler(
    schedulerId: string,
    repeat: { pattern: string; tz?: string },
    template?: { name: string; data?: unknown },
  ): Promise<unknown>;
  close(): Promise<void>;
}

/** The minimal `Worker` surface this driver depends on. */
export interface BullMqWorkerClient {
  close(): Promise<void>;
}

export interface BullMqJobQueueConfig {
  /** ioredis connection (or options) built by the caller from `REDIS_URL` — never a module constant. */
  connection?: ConnectionOptions;
  /** Worker concurrency; omitted uses BullMQ's default of 1. */
  concurrency?: number;
  /** Test seam: build a fake `Queue` instead of a real Redis-backed one. */
  queueFactory?: (name: string) => BullMqQueueClient;
  /** Test seam: build a fake `Worker` instead of a real Redis-backed one. */
  workerFactory?: (
    name: string,
    processor: (job: BullMqJobData) => Promise<void>,
  ) => BullMqWorkerClient;
}

/** Native BullMQ cron scheduling (ADR-0256 parity with pg-boss) — the driver-specific addition the
 *  generic port has no equivalent for. `schedule(name, cron)` upserts a repeatable job scheduler that
 *  ticks `name`'s queue; `name` must already be a registered task. */
export interface BullMqSchedule {
  schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: { tz?: string },
  ): Promise<void>;
}

/** Graceful shutdown: stop all workers, then release all queue connections. */
export interface BullMqShutdown {
  close(): Promise<void>;
}

/** Build the real BullMQ `Queue`-backed factory over an already-verified `connection`. */
function defaultQueueFactory(
  connection: ConnectionOptions,
): (name: string) => BullMqQueueClient {
  return (name: string): BullMqQueueClient => {
    const q = new Queue(name, { connection });
    return {
      add: (n, data, opts) => q.add(n, data, opts),
      // The port surface is driver-agnostic `string[]`; the values passed ("waiting"/"active"/
      // "failed") are valid BullMQ `JobType`s, narrowed at this one real-SDK boundary.
      getJobCounts: (...types) => q.getJobCounts(...(types as JobType[])),
      upsertJobScheduler: (id, repeat, template) =>
        q.upsertJobScheduler(id, repeat, template),
      close: () => q.close(),
    };
  };
}

/** Build the real BullMQ `Worker`-backed factory over an already-verified `connection`. */
function defaultWorkerFactory(
  connection: ConnectionOptions,
  concurrency: number | undefined,
): (
  name: string,
  processor: (job: BullMqJobData) => Promise<void>,
) => BullMqWorkerClient {
  return (name, processor): BullMqWorkerClient => {
    const w = new Worker(
      name,
      async (job: Job): Promise<void> => {
        await processor({ name: job.name, data: job.data });
      },
      { connection, ...(concurrency !== undefined ? { concurrency } : {}) },
    );
    return { close: () => w.close() };
  };
}

/**
 * The BullMQ `JobQueue` driver. `enqueue` validates against the same task registry as the other
 * drivers (404 on an unregistered name, `ValidationError` on a schema-invalid payload) BEFORE
 * anything reaches Redis, then lazily creates (and caches) the named queue and adds the validated job.
 *
 * Construction fails CLOSED (`ConfigError`) only on the capability every code path needs — a way to
 * build a `Queue` (`connection` or an injected `queueFactory`), matching the pg-boss/Trigger.dev
 * drivers' single fail-closed guard. The WORKER factory is resolved lazily, the first time `work()`
 * is actually called — an enqueue-only caller (or an enqueue-only test injecting just `queueFactory`)
 * never needs a `connection`/`workerFactory` to construct successfully.
 */
export function createBullMqJobQueue(
  tasks: readonly TaskDefinition<unknown>[],
  config: BullMqJobQueueConfig,
): JobQueue & JobConsumer & JobLedger & BullMqSchedule & BullMqShutdown {
  const registry = createTaskRegistry(tasks);

  if (config.connection === undefined && config.queueFactory === undefined) {
    throw new ConfigError(
      "createBullMqJobQueue requires `connection` (built from REDIS_URL) or an injected `queueFactory` for tests",
    );
  }
  const queueFactory =
    config.queueFactory ??
    defaultQueueFactory(config.connection as ConnectionOptions);

  let cachedWorkerFactory:
    | ((
        name: string,
        processor: (job: BullMqJobData) => Promise<void>,
      ) => BullMqWorkerClient)
    | undefined;
  function getWorkerFactory(): (
    name: string,
    processor: (job: BullMqJobData) => Promise<void>,
  ) => BullMqWorkerClient {
    if (cachedWorkerFactory === undefined) {
      if (config.workerFactory !== undefined) {
        cachedWorkerFactory = config.workerFactory;
      } else if (config.connection !== undefined) {
        cachedWorkerFactory = defaultWorkerFactory(
          config.connection,
          config.concurrency,
        );
      } else {
        throw new ConfigError(
          "createBullMqJobQueue.work() requires `connection` (built from REDIS_URL) or an injected `workerFactory` for tests",
        );
      }
    }
    return cachedWorkerFactory;
  }

  const queues = new Map<string, BullMqQueueClient>();
  const workers = new Set<BullMqWorkerClient>();

  function getQueue(name: string): BullMqQueueClient {
    let q = queues.get(name);
    if (q === undefined) {
      q = queueFactory(name);
      queues.set(name, q);
    }
    return q;
  }

  return {
    async enqueue(
      name: string,
      payload: unknown,
      options?: EnqueueOptions,
    ): Promise<void> {
      const task = requireRegisteredTask(registry, name);
      const validated = parseStrict(task.schema, payload);

      const addOptions: BullMqAddOptions = {};
      if (options?.idempotencyKey !== undefined) {
        addOptions.jobId = deriveIdempotentJobId(name, options.idempotencyKey);
      }
      if (options?.singletonKey !== undefined) {
        addOptions.deduplication = { id: options.singletonKey };
      }

      await getQueue(name).add(
        name,
        validated,
        Object.keys(addOptions).length > 0 ? addOptions : undefined,
      );
    },

    async work(name: string): Promise<WorkHandle> {
      const task = requireRegisteredTask(registry, name);
      const worker = getWorkerFactory()(name, async (job) => {
        await task.handler(parseStrict(task.schema, job.data));
      });
      workers.add(worker);
      return {
        async stop(): Promise<void> {
          await worker.close();
          workers.delete(worker);
        },
      };
    },

    async getQueueState(name: string): Promise<QueueState> {
      const counts = await getQueue(name).getJobCounts(
        "waiting",
        "active",
        "failed",
      );
      return {
        queuedCount: counts.waiting ?? 0,
        activeCount: counts.active ?? 0,
        failedCount: counts.failed ?? 0,
      };
    },

    async schedule(
      name: string,
      cron: string,
      data?: object | null,
      options?: { tz?: string },
    ): Promise<void> {
      requireRegisteredTask(registry, name);
      const repeat =
        options?.tz !== undefined
          ? { pattern: cron, tz: options.tz }
          : { pattern: cron };
      await getQueue(name).upsertJobScheduler(name, repeat, {
        name,
        ...(data != null ? { data } : {}),
      });
    },

    async close(): Promise<void> {
      // Stop claiming first (workers), then release the queue connections.
      await Promise.all([...workers].map((w) => w.close()));
      workers.clear();
      await Promise.all([...queues.values()].map((q) => q.close()));
      queues.clear();
    },
  };
}
