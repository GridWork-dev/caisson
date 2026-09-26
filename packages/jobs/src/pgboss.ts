// pg-boss production driver for the `JobQueue` port (ADR-0173, ADR-0211). A thin wrapper over
// pg-boss's Postgres-backed queue — `enqueue(name, payload)` validates against the same task
// registry the in-memory + Trigger.dev drivers use, then maps to `boss.send(name, payload)`.
//
// Env-gated: `connectionString` (e.g. `DATABASE_URL`) is read by the CALLER and injected via
// `config` — never a module-level constant. Calling `createPgBossJobQueue` without a
// `connectionString` and without an injected `client` throws `ConfigError` immediately (fail
// closed at construction, matching `createTriggerJobQueue`). Tests inject a fake `client` via
// `config.client`, so this driver never touches the network in `bun test`.
//
// Lazy-start: pg-boss requires an async `start()` before it accepts jobs, but this factory is
// synchronous (matching the other two drivers' shape). The real boss instance is started lazily on
// the first `enqueue`/`work`/`getQueueState` call and cached for the lifetime of the returned
// `JobQueue`.
//
// Idempotent enqueue (ADR-0211): NOT `singletonKey`. pg-boss's uniqueness indexes are gated
// `AND policy = '<policy>'` (`plans.js` insertJobs' partial unique indexes), and our default
// `standard`-policy queue enforces none of them — forcing `policy: 'exclusive'` would also block
// concurrent *unkeyed* jobs on the same queue name, which is not a trade this port makes for every
// caller. Instead, `enqueueIdempotent` derives a deterministic `id` from
// `sha256(name + "\0" + idempotencyKey)` reshaped into a UUID string (`node:crypto`, no new dep)
// and passes it as `SendOptions.id`. `insertJobs`' SQL is `INSERT ... ON CONFLICT DO NOTHING
// RETURNING id` — unconditional on the primary key regardless of policy — so a repeat id is
// atomically a no-op: `send()` returns `null` and this driver swallows it.
//
// Overlap-safety (ADR-0229 row 56) is a SEPARATE concern from that idempotency note: `singletonKey`
// maps straight to pg-boss's native `SendOptions.singletonKey`, which suppresses OVERLAP (at most one
// job with that key active/queued at once) rather than dedup'ing a retry. Both can ride one send.
//
// Job-failure alerting: `work()`'s per-job handler call is wrapped in a try/catch that
// reports through the optional `JobAlertingDeps` port, THEN re-throws — pg-boss's own retry/
// dead-letter machinery is untouched, alerting only observes. The underlying `PgBoss` instance's
// `error` event (undocumented-crash risk if left unhandled — see `wireBossErrorHandler`) is wired
// the same way. See `JobAlertingDeps`'s doc for why this stays dependency-free of `@caisson/alerting`.
import { PgBoss } from "pg-boss";
import { createHash } from "node:crypto";
import { ConfigError, parseStrict } from "@caisson/kernel";
import { createTaskRegistry, requireRegisteredTask } from "./task-registry.ts";
import type {
  EnqueueOptions,
  JobConsumer,
  JobLedger,
  JobQueue,
  QueueState,
  TaskDefinition,
  WorkHandle,
} from "./queue.ts";

/** The shape of a claimed job as pg-boss's `work()` callback delivers it. */
export interface PgBossJob {
  readonly id: string;
  readonly data: unknown;
}

/**
 * The minimal surface of the pg-boss SDK this driver depends on. Real usage is backed by an actual
 * `PgBoss` instance; tests inject a fake/mock implementation here so this driver never hits
 * Postgres.
 */
export interface PgBossClient {
  start(): Promise<unknown>;
  createQueue(name: string): Promise<void>;
  send(
    name: string,
    payload: object | null,
    options?: { id?: string; singletonKey?: string },
  ): Promise<string | null>;
  /** Native SKIP LOCKED claim — never hand-written SQL. Delivers a batch (default size 1). */
  work(
    name: string,
    handler: (jobs: readonly PgBossJob[]) => Promise<void>,
  ): Promise<string>;
  /** `id` scopes the stop to ONE worker — bare `offWork(name)` stops every worker on the queue. */
  offWork(name: string, options?: { id?: string }): Promise<void>;
  /** `null` when the queue has never been created — mapped to all-zero, not an error. */
  getQueue(name: string): Promise<QueueState | null>;
  /** Native pg-boss cron (ADR-0256) — requires the named queue to already exist. */
  schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: { tz?: string },
  ): Promise<void>;
  /** Stops maintenance timers and closes pg-boss's own internal pool (WR-01, security review):
   *  `start()` leaves both running indefinitely — a short-lived caller (a CLI command, a script)
   *  that never calls this hangs the process on exit. */
  stop(): Promise<void>;
}

/** A driver that lazily started a REAL pg-boss client can also stop it — the caller's own
 *  cleanup (a CLI's `close()`, a script's shutdown) awaits this instead of leaking pg-boss's
 *  maintenance timers + pool past the caller's own connection teardown (WR-01). */
export interface PgBossStoppable {
  /** Safe no-op if the client was never lazily started (e.g. only `enqueue` for a task whose
   *  handler never ran, or the queue was never touched at all). */
  stop(): Promise<void>;
}

/**
 * Job-failure alerting seam. Kept dependency-free of `@caisson/alerting` on purpose: this base
 * package never depends "up" on a higher-level one. A host implements this tiny structural port
 * using the real `@caisson/alerting` pipeline; absent = today's behavior, no alert, every existing
 * `createPgBossJobQueue` call keeps compiling.
 */
export interface JobAlertingDeps {
  /** Called AFTER a `work()` task handler throws, BEFORE the re-throw. Must never itself throw —
   *  `pgboss.ts` never lets an alerting failure block or alter the re-throw that preserves
   *  pg-boss's native retry/dead-letter machinery. */
  reportTaskFailure(taskName: string, error: unknown): Promise<void>;
  /** Called from the underlying `PgBoss` instance's own `error` event (an unhandled one crashes
   *  the process per pg-boss's docs) — an infra-level failure, not tied to one task/job. */
  reportInfraError(error: unknown): Promise<void>;
}

export interface PgBossJobQueueConfig {
  /** e.g. `DATABASE_URL` — read by the caller's env and injected here, never a module constant. */
  connectionString?: string;
  /**
   * Override the underlying pg-boss client. Tests inject a fake/mock here instead of
   * `connectionString` so this driver runs fully offline.
   */
  client?: PgBossClient;
  /** Optional job-failure alerting (see {@link JobAlertingDeps}). */
  alerting?: JobAlertingDeps;
}

/** The minimal event-emitter surface {@link wireBossErrorHandler} needs — a real `PgBoss`
 *  instance satisfies it (it extends node:events `EventEmitter`); tests inject a bare object so
 *  the wiring is provable without a live Postgres connection. */
export interface PgBossErrorEmitter {
  on(event: "error", listener: (error: Error) => void): unknown;
}

/**
 * pg-boss's own docs warn an unhandled `error` event CRASHES the process (Node's `EventEmitter`
 * default behavior for a listener-less `'error'` emit) — this repo previously shipped zero such
 * listeners, a live crash risk on any connection-level pg-boss failure. Wired BEFORE
 * `.start()` so even a startup-time error is caught. Routes to the injected alerting deps when
 * present; falls back to the injected `log` seam otherwise — never silently dropped.
 */
export function wireBossErrorHandler(
  emitter: PgBossErrorEmitter,
  alerting: JobAlertingDeps | undefined,
  log: (message: string) => void,
): void {
  emitter.on("error", (error: Error) => {
    if (alerting !== undefined) {
      // Alerting itself failing must never throw back into pg-boss's EventEmitter dispatch.
      void alerting.reportInfraError(error).catch(() => {});
    } else {
      log(`[jobs] pg-boss error event: ${error.message}`);
    }
  });
}

/**
 * Native pg-boss cron scheduling (ADR-0256) — the one driver capability with no generic-port
 * equivalent: only pg-boss can tick a cron durably inside Postgres itself, so this stays a
 * pg-boss-specific addition rather than a hollow port every other driver (in-memory, Trigger.dev)
 * would have to stub. `schedule(name, cron)` sends a payload into `name`'s queue on the cron tick —
 * `name` must already be a registered task (the same registry `enqueue`/`work` validate against),
 * so a typo'd or unregistered name fails the same way a bad `enqueue` call does, before it ever
 * reaches Postgres.
 */
export interface PgBossSchedule {
  schedule(
    name: string,
    cron: string,
    data?: object | null,
    options?: { tz?: string },
  ): Promise<void>;
}

/**
 * Deterministic pg-boss job id for idempotent enqueue (ADR-0211) — `sha256(name + "\0" +
 * idempotencyKey)` reshaped into UUID-string form (8-4-4-4-12 hex). The NUL separator prevents
 * `(name="ab", key="c")` from colliding with `(name="a", key="bc")`. Version/variant bits are left
 * as raw hash bytes: Postgres's `uuid` column accepts any 32 hex digits in that shape, and this id
 * is never parsed as an RFC 4122 UUID by anything else.
 */
export function deriveIdempotentJobId(
  name: string,
  idempotencyKey: string,
): string {
  const digest = createHash("sha256")
    .update(`${name}\0${idempotencyKey}`)
    .digest("hex");
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20, 32),
  ].join("-");
}

/**
 * The pg-boss `JobQueue` driver. `enqueue` validates against the same task registry as the
 * in-memory + Trigger.dev drivers (404 on an unregistered name, `ValidationError` on a
 * schema-invalid payload) BEFORE anything reaches pg-boss, then lazily starts (or reuses the
 * injected) client, ensures the named queue exists (`createQueue` is idempotent in pg-boss v10+),
 * and sends the validated job.
 */
export function createPgBossJobQueue(
  tasks: readonly TaskDefinition<unknown>[],
  config: PgBossJobQueueConfig,
): JobQueue & JobConsumer & JobLedger & PgBossSchedule & PgBossStoppable {
  const registry = createTaskRegistry(tasks);

  if (
    (config.connectionString === undefined ||
      config.connectionString.length === 0) &&
    config.client === undefined
  ) {
    throw new ConfigError(
      "createPgBossJobQueue requires `connectionString` (DATABASE_URL) or an injected `client` for tests",
    );
  }

  const knownQueues = new Set<string>();
  let clientPromise: Promise<PgBossClient> | undefined;

  function getClient(): Promise<PgBossClient> {
    if (clientPromise === undefined) {
      clientPromise =
        config.client !== undefined
          ? Promise.resolve(config.client)
          : startSdkClient(config.connectionString as string, config.alerting);
    }
    return clientPromise;
  }

  async function ensureQueue(
    client: PgBossClient,
    name: string,
  ): Promise<void> {
    if (!knownQueues.has(name)) {
      await client.createQueue(name);
      knownQueues.add(name);
    }
  }

  return {
    async enqueue(
      name: string,
      payload: unknown,
      options?: EnqueueOptions,
    ): Promise<void> {
      const task = requireRegisteredTask(registry, name);
      const validated = parseStrict(task.schema, payload);

      const client = await getClient();
      await ensureQueue(client, name);
      // `id` (from idempotencyKey) dedups a RETRY via ON CONFLICT DO NOTHING; `singletonKey`
      // (ADR-0229 row 56) is pg-boss's NATIVE overlap suppression — at most one job with that key
      // active/queued at a time. Distinct concerns, so both can ride one send.
      const sendOptions: { id?: string; singletonKey?: string } = {};
      if (options?.idempotencyKey !== undefined) {
        sendOptions.id = deriveIdempotentJobId(name, options.idempotencyKey);
      }
      if (options?.singletonKey !== undefined) {
        sendOptions.singletonKey = options.singletonKey;
      }
      // A conflicting deterministic id (or a singletonKey overlap) makes `send` resolve `null` — the
      // repeat is atomically a no-op at the database level, so there's nothing to do with the return.
      await client.send(
        name,
        (validated as object | null) ?? null,
        Object.keys(sendOptions).length > 0 ? sendOptions : undefined,
      );
    },

    async work(name: string): Promise<WorkHandle> {
      const task = requireRegisteredTask(registry, name);
      const client = await getClient();
      await ensureQueue(client, name);
      const workerId = await client.work(name, async (jobs) => {
        for (const job of jobs) {
          try {
            // parseStrict INSIDE the try: a poison payload that fails schema validation must
            // alert the same as a handler throw, before pg-boss's retry/dead-letter path sees it.
            const validated = parseStrict(task.schema, job.data);
            await task.handler(validated);
          } catch (err) {
            if (config.alerting !== undefined) {
              // Alerting must never mask the original failure or block the re-throw below —
              // pg-boss's native retry/dead-letter machinery depends on that re-throw happening.
              await config.alerting
                .reportTaskFailure(name, err)
                .catch(() => {});
            }
            throw err;
          }
        }
      });
      return {
        async stop(): Promise<void> {
          // Scoped to THIS worker's id — a bare offWork(name) stops every worker on the
          // queue in this process, silently killing sibling consumers.
          await client.offWork(name, { id: workerId });
        },
      };
    },

    async getQueueState(name: string): Promise<QueueState> {
      const client = await getClient();
      const queue = await client.getQueue(name);
      if (queue === null) {
        return { queuedCount: 0, activeCount: 0, failedCount: 0 };
      }
      return {
        queuedCount: queue.queuedCount,
        activeCount: queue.activeCount,
        failedCount: queue.failedCount,
      };
    },

    async schedule(
      name: string,
      cron: string,
      data?: object | null,
      options?: { tz?: string },
    ): Promise<void> {
      requireRegisteredTask(registry, name);
      const client = await getClient();
      await ensureQueue(client, name);
      await client.schedule(name, cron, data ?? null, options);
    },

    async stop(): Promise<void> {
      // Nothing to stop if the client was never lazily started — never force a start just to
      // immediately tear it down.
      if (clientPromise === undefined) return;
      const client = await clientPromise;
      await client.stop();
    },
  };
}

/** Builds the real pg-boss-backed client, wires the crash-risk `error` event handler (see
 *  {@link wireBossErrorHandler}), and starts it. */
async function startSdkClient(
  connectionString: string,
  alerting?: JobAlertingDeps,
  log: (message: string) => void = (message: string) => {
    process.stderr.write(`${message}\n`);
  },
): Promise<PgBossClient> {
  const boss = new PgBoss(connectionString);
  wireBossErrorHandler(boss, alerting, log);
  await boss.start();
  return boss;
}
