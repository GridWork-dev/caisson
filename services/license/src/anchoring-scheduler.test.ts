// Unit coverage for the external-anchoring checkpoint scheduler (T6, ADR-0346 P3). Mirrors the
// credit-expiry scheduler tests. Four things matter, none needing a live pg-boss (PGlite cannot back
// pg-boss, so construction stays behind the env gate):
//   1. the active-chain enumerator + tick fan-out are correct against a REAL PGlite (RLS applies, via
//      the same `admin_write` policy the admin surface provisions elsewhere);
//   2. the Fork B hourly floor rejects a sub-hourly cron;
//   3. `startAnchorCheckpointScheduler` is INERT when unarmed (a throwing factory proves it is never
//      even called), and rejects a sub-hourly cron without opening a connection;
//   4. when armed, it registers the checkpoint + tick tasks, consumes each, and schedules the tick —
//      proven with a FAKE `createPgBossJobQueue`-shaped factory; a start failure logs and never throws.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { createPgBossJobQueue } from "@caisson/jobs";
import {
  createFakeQueue,
  createFakeQueueFactory,
} from "./scheduler-test-fixtures.ts";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  buildAdminWritePolicySql,
} from "@caisson/org-controls";
import type { Transactor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  AnchorOutbox,
  ANCHOR_CHECKPOINT_TASK,
  ANCHOR_OUTBOX_SCHEMA_SQL,
  StubTrustedTimestampLog,
  type AnchorCheckpointDeps,
  type ArtifactStore,
  type CurrentAnchorReader,
  type TransparencyTarget,
} from "@caisson/audit-worm";
import {
  ANCHOR_CHECKPOINT_TICK_TASK,
  assertHourlyFloor,
  listActiveChainAccountIds,
  loadAnchorCheckpointScheduleConfig,
  runAnchorCheckpointTick,
  startAnchorCheckpointScheduler,
} from "./anchoring-scheduler.ts";

let tp: TestPg;
let db: Transactor;

const TARGET: TransparencyTarget = {
  kind: "tsa",
  url: "https://tsa.example/tsr",
  grade: "trusted-timestamped",
};

/** A store the checkpoint task never actually drives in these tests (the tick is under test). */
const fakeStore: ArtifactStore = {
  put: () => Promise.reject(new Error("unused")),
  get: () => Promise.reject(new Error("unused")),
  head: () => Promise.resolve(null),
  extendRetention: () => Promise.reject(new Error("unused")),
};
const emptyReader: CurrentAnchorReader = {
  readCurrentAnchor: () => Promise.resolve(null),
};

function checkpointDeps(): AnchorCheckpointDeps {
  return {
    store: fakeStore,
    outbox: new AnchorOutbox(db),
    log: new StubTrustedTimestampLog(),
    reader: emptyReader,
    target: TARGET,
  };
}

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(ANCHOR_OUTBOX_SCHEMA_SQL);
  // A minimal audit_chain_entry with tenant RLS; the cross-tenant enumerator reads it through the
  // `admin_write` role, so provision that policy (the same reuse rationale as credit_wallet).
  await tp.exec(`
    CREATE TABLE IF NOT EXISTS audit_chain_entry (
      account_id text NOT NULL,
      seq        integer NOT NULL
    );
    ALTER TABLE audit_chain_entry ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_chain_entry FORCE ROW LEVEL SECURITY;
  `);
  await tp.exec(buildAdminWritePolicySql("audit_chain_entry"));
});

afterAll(async () => {
  await tp.close();
});

/** A fake `JobQueue` recording every `enqueue` call instead of touching a driver. */

describe("loadAnchorCheckpointScheduleConfig", () => {
  test("unset env → null (inert)", () => {
    expect(loadAnchorCheckpointScheduleConfig({})).toBeNull();
  });

  test("a blank env value → null (inert, not a bad-cron error)", () => {
    expect(
      loadAnchorCheckpointScheduleConfig({ ANCHOR_CHECKPOINT_SCHEDULE: "   " }),
    ).toBeNull();
  });

  test("a set cron is trimmed and returned", () => {
    expect(
      loadAnchorCheckpointScheduleConfig({
        ANCHOR_CHECKPOINT_SCHEDULE: " 0 3 * * * ",
      }),
    ).toBe("0 3 * * *");
  });
});

describe("assertHourlyFloor (Fork B)", () => {
  test("daily + hourly crons pass", () => {
    expect(() => assertHourlyFloor("0 3 * * *")).not.toThrow();
    expect(() => assertHourlyFloor("30 * * * *")).not.toThrow();
    expect(() => assertHourlyFloor("0 * * * *")).not.toThrow();
  });

  test("sub-hourly crons are rejected", () => {
    expect(() => assertHourlyFloor("* * * * *")).toThrow();
    expect(() => assertHourlyFloor("*/30 * * * *")).toThrow();
    expect(() => assertHourlyFloor("0,30 * * * *")).toThrow();
    expect(() => assertHourlyFloor("0-15 * * * *")).toThrow();
  });
});

describe("listActiveChainAccountIds / runAnchorCheckpointTick (PGlite, real RLS)", () => {
  test("enumerates every distinct active-chain account, ordered", async () => {
    await tp.exec(
      `INSERT INTO audit_chain_entry (account_id, seq)
       VALUES ('acct_b', 0), ('acct_b', 1), ('acct_a', 0)`,
    );
    expect(await listActiveChainAccountIds(db)).toEqual(["acct_a", "acct_b"]);
  });

  test("the tick enqueues one checkpoint job per account, singletonKey'd by account", async () => {
    const queue = createFakeQueue();
    await runAnchorCheckpointTick(db, queue);
    expect(queue.calls).toEqual([
      {
        name: ANCHOR_CHECKPOINT_TASK,
        payload: { accountId: "acct_a" },
        options: { singletonKey: "acct_a" },
      },
      {
        name: ANCHOR_CHECKPOINT_TASK,
        payload: { accountId: "acct_b" },
        options: { singletonKey: "acct_b" },
      },
    ]);
  });
});

describe("startAnchorCheckpointScheduler — INERT UNTIL ARMED", () => {
  test("schedule undefined → the queue factory is never called", async () => {
    const throwingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("createQueue must not be called when inert");
    };
    await expect(
      startAnchorCheckpointScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: undefined,
        checkpoint: checkpointDeps(),
        createQueue: throwingFactory,
      }),
    ).resolves.toBeUndefined();
  });

  test("schedule blank → the queue factory is never called", async () => {
    const throwingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("createQueue must not be called when inert");
    };
    await expect(
      startAnchorCheckpointScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: "   ",
        checkpoint: checkpointDeps(),
        createQueue: throwingFactory,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("startAnchorCheckpointScheduler — armed", () => {
  test("registers the checkpoint + tick tasks, consumes each, and schedules the tick", async () => {
    const fake = createFakeQueueFactory();
    await startAnchorCheckpointScheduler({
      db,
      connectionString: "postgres://unused",
      schedule: "0 3 * * *",
      checkpoint: checkpointDeps(),
      createQueue: fake.factory,
    });

    const expectedNames = [
      ANCHOR_CHECKPOINT_TASK,
      ANCHOR_CHECKPOINT_TICK_TASK,
    ].sort();
    expect(fake.registeredTaskNames.sort()).toEqual(expectedNames);
    expect(fake.workCalls.sort()).toEqual(expectedNames);
    expect(fake.scheduleCalls).toEqual([
      { name: ANCHOR_CHECKPOINT_TICK_TASK, cron: "0 3 * * *", data: {} },
    ]);
  });

  test("a sub-hourly cron is rejected: no queue opened, one log line", async () => {
    const fake = createFakeQueueFactory();
    const logs: string[] = [];
    await startAnchorCheckpointScheduler({
      db,
      connectionString: "postgres://unused",
      schedule: "*/5 * * * *",
      checkpoint: checkpointDeps(),
      createQueue: fake.factory,
      log: (m) => logs.push(m),
    });
    expect(fake.registeredTaskNames).toHaveLength(0);
    expect(fake.scheduleCalls).toHaveLength(0);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("hourly");
  });

  test("threads `alerting` through to the queue factory's config", async () => {
    const fake = createFakeQueueFactory();
    const alerting = {
      reportTaskFailure: async () => {},
      reportInfraError: async () => {},
    };
    await startAnchorCheckpointScheduler({
      db,
      connectionString: "postgres://unused",
      schedule: "0 3 * * *",
      checkpoint: checkpointDeps(),
      createQueue: fake.factory,
      alerting,
    });
    expect(fake.configCalls).toHaveLength(1);
    expect(fake.configCalls[0]?.alerting).toBe(alerting);
  });

  test("a start failure logs and resolves — never throws past the boot path", async () => {
    const failingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("boom");
    };
    const logs: string[] = [];
    await expect(
      startAnchorCheckpointScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: "0 3 * * *",
        checkpoint: checkpointDeps(),
        createQueue: failingFactory,
        log: (message) => logs.push(message),
      }),
    ).resolves.toBeUndefined();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("boom");
  });
});
