// pg-boss production driver for the `JobQueue` port (ADR-0173). A thin wrapper over pg-boss's
// Postgres-backed queue — `enqueue(name, payload)` maps straight to `boss.send(name, payload)`.
// No task registry / schema validation here (that stays with the in-memory + Trigger.dev drivers);
// this driver only wraps the send leg.
//
// Env-gated: `connectionString` (e.g. `DATABASE_URL`) is read by the CALLER and injected via
// `config` — never a module-level constant. Calling `createPgBossJobQueue` without a
// `connectionString` and without an injected `client` throws `ConfigError` immediately (fail
// closed at construction, matching `createTriggerJobQueue`). Tests inject a fake `client` via
// `config.client`, so this driver never touches the network in `bun test`.
//
// Lazy-start: pg-boss requires an async `start()` before it accepts jobs, but this factory is
// synchronous (matching the other two drivers' shape). The real boss instance is started lazily on
// the first `enqueue` call and cached for the lifetime of the returned `JobQueue`.
import { PgBoss } from "pg-boss";
import { ConfigError } from "@caisson/kernel";
import type { JobQueue } from "./queue.ts";

/**
 * The minimal surface of the pg-boss SDK this driver depends on. Real usage is backed by an actual
 * `PgBoss` instance; tests inject a fake/mock implementation here so `enqueue` never hits Postgres.
 */
export interface PgBossClient {
  start(): Promise<unknown>;
  createQueue(name: string): Promise<void>;
  send(name: string, payload: object | null): Promise<string | null>;
}

export interface PgBossJobQueueConfig {
  /** e.g. `DATABASE_URL` — read by the caller's env and injected here, never a module constant. */
  connectionString?: string;
  /**
   * Override the underlying pg-boss client. Tests inject a fake/mock here instead of
   * `connectionString` so `enqueue` runs fully offline.
   */
  client?: PgBossClient;
}

/**
 * The pg-boss `JobQueue` driver. `enqueue` lazily starts (or reuses the injected) client, ensures
 * the named queue exists (`createQueue` is idempotent in pg-boss v10+), then sends the job.
 */
export function createPgBossJobQueue(config: PgBossJobQueueConfig): JobQueue {
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
          : startSdkClient(config.connectionString as string);
    }
    return clientPromise;
  }

  return {
    async enqueue(name: string, payload: unknown): Promise<void> {
      const client = await getClient();
      if (!knownQueues.has(name)) {
        await client.createQueue(name);
        knownQueues.add(name);
      }
      await client.send(name, (payload as object | null) ?? null);
    },
  };
}

/** Builds the real pg-boss-backed client and starts it. */
async function startSdkClient(connectionString: string): Promise<PgBossClient> {
  const boss = new PgBoss(connectionString);
  await boss.start();
  return boss;
}
