// Unit coverage for the ADR-0256 credit-expiry scheduler. Three things matter here, none of which
// need a live pg-boss (pg-boss needs real Postgres; PGlite cannot back it — construction stays
// behind the env gate in every test below):
//   1. the wallet-account enumerator + tick fan-out are correct against a REAL PGlite (RLS applies
//      for real, via the same `admin_write` policy the admin mutation surface already provisions);
//   2. `startCreditExpiryScheduler` is INERT when unarmed — a throwing factory proves it is never
//      even called;
//   3. when armed, it registers all three tasks, starts consuming each, and schedules the daily
//      tick — proven with a FAKE `createPgBossJobQueue`-shaped factory; a start failure logs and
//      never throws (the commerce path must stay up regardless of scheduler health).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  CREDIT_EXPIRY_NOTICE_TASK,
  CREDIT_EXPIRY_SWEEP_TASK,
  CREDIT_SCHEMA_SQL,
} from "@caisson/credits";
import type {
  createPgBossJobQueue,
  EnqueueOptions,
  JobQueue,
} from "@caisson/jobs";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  buildAdminWritePolicySql,
} from "@caisson/org-controls";
import type { Transactor } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  CREDIT_EXPIRY_TICK_TASK,
  listWalletAccountIds,
  loadCreditExpiryScheduleConfig,
  runCreditExpiryTick,
  startCreditExpiryScheduler,
} from "./credit-expiry-scheduler.ts";

let tp: TestPg;
let db: Transactor;

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(CREDIT_SCHEMA_SQL);
  // The minimal slice of ADMIN_MUTATION_PROVISION_SQL this module actually needs — the same
  // cross-tenant policy the admin negative-adjust mutation already relies on, applied directly
  // rather than the whole provisioning bundle (which also references tables this suite never
  // creates, e.g. account_member/license_grant).
  await tp.exec(buildAdminWritePolicySql("credit_wallet"));
});

afterAll(async () => {
  await tp.close();
});

/** A fake `JobQueue` recording every `enqueue` call instead of touching a driver. */
function createFakeQueue(): JobQueue & {
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

/** A fake `createPgBossJobQueue`-shaped factory: records registered task names, `work()` calls,
 * and `schedule()` calls, without ever touching pg-boss. */
function createFakeQueueFactory(): {
  factory: typeof createPgBossJobQueue;
  registeredTaskNames: string[];
  workCalls: string[];
  scheduleCalls: Array<{ name: string; cron: string; data: unknown }>;
} {
  const registeredTaskNames: string[] = [];
  const workCalls: string[] = [];
  const scheduleCalls: Array<{ name: string; cron: string; data: unknown }> =
    [];
  const factory: typeof createPgBossJobQueue = (tasks) => {
    registeredTaskNames.push(...tasks.map((t) => t.name));
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
    };
  };
  return { factory, registeredTaskNames, workCalls, scheduleCalls };
}

describe("loadCreditExpiryScheduleConfig", () => {
  test("unset env → null (inert)", () => {
    expect(loadCreditExpiryScheduleConfig({})).toBeNull();
  });

  test("a blank env value → null (inert, not a bad-cron error)", () => {
    expect(
      loadCreditExpiryScheduleConfig({ CREDIT_EXPIRY_SCHEDULE: "   " }),
    ).toBeNull();
  });

  test("a set cron is trimmed and returned", () => {
    expect(
      loadCreditExpiryScheduleConfig({
        CREDIT_EXPIRY_SCHEDULE: " 30 3 * * * ",
      }),
    ).toBe("30 3 * * *");
  });
});

describe("listWalletAccountIds / runCreditExpiryTick (PGlite, real RLS)", () => {
  test("enumerates every distinct wallet account, ordered", async () => {
    await tp.exec(
      `INSERT INTO credit_wallet (account_id, balance) VALUES ('acct_b', 10), ('acct_a', 20)
       ON CONFLICT DO NOTHING`,
    );

    expect(await listWalletAccountIds(db)).toEqual(["acct_a", "acct_b"]);
  });

  test("the tick enqueues one sweep + one notice job per wallet account, singletonKey'd by account", async () => {
    const queue = createFakeQueue();

    await runCreditExpiryTick(db, queue);

    // Seeded above: acct_a, acct_b — ORDER BY account_id.
    expect(queue.calls).toEqual([
      {
        name: CREDIT_EXPIRY_SWEEP_TASK,
        payload: { accountId: "acct_a" },
        options: { singletonKey: "acct_a" },
      },
      {
        name: CREDIT_EXPIRY_NOTICE_TASK,
        payload: { accountId: "acct_a" },
        options: { singletonKey: "acct_a" },
      },
      {
        name: CREDIT_EXPIRY_SWEEP_TASK,
        payload: { accountId: "acct_b" },
        options: { singletonKey: "acct_b" },
      },
      {
        name: CREDIT_EXPIRY_NOTICE_TASK,
        payload: { accountId: "acct_b" },
        options: { singletonKey: "acct_b" },
      },
    ]);
  });
});

const noEmailer = {
  emailer: null,
  recipientFor: async () => null,
  dashboardUrl: "https://example.test/dashboard",
} as const;

describe("startCreditExpiryScheduler — INERT UNTIL ARMED", () => {
  test("schedule undefined → the queue factory is never called", async () => {
    const throwingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("createQueue must not be called when inert");
    };

    await expect(
      startCreditExpiryScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: undefined,
        createQueue: throwingFactory,
        ...noEmailer,
      }),
    ).resolves.toBeUndefined();
  });

  test("schedule blank → the queue factory is never called", async () => {
    const throwingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("createQueue must not be called when inert");
    };

    await expect(
      startCreditExpiryScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: "   ",
        createQueue: throwingFactory,
        ...noEmailer,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("startCreditExpiryScheduler — armed", () => {
  test("registers all three tasks, starts consuming each, and schedules the daily tick", async () => {
    const fake = createFakeQueueFactory();

    await startCreditExpiryScheduler({
      db,
      connectionString: "postgres://unused",
      schedule: "30 3 * * *",
      createQueue: fake.factory,
      ...noEmailer,
    });

    const expectedNames = [
      CREDIT_EXPIRY_SWEEP_TASK,
      CREDIT_EXPIRY_NOTICE_TASK,
      CREDIT_EXPIRY_TICK_TASK,
    ].sort();
    expect(fake.registeredTaskNames.sort()).toEqual(expectedNames);
    expect(fake.workCalls.sort()).toEqual(expectedNames);
    expect(fake.scheduleCalls).toEqual([
      { name: CREDIT_EXPIRY_TICK_TASK, cron: "30 3 * * *", data: {} },
    ]);
  });

  test("a start failure logs and resolves — never throws past the boot path", async () => {
    const failingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("boom");
    };
    const logs: string[] = [];

    await expect(
      startCreditExpiryScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: "30 3 * * *",
        createQueue: failingFactory,
        log: (message) => logs.push(message),
        ...noEmailer,
      }),
    ).resolves.toBeUndefined();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("boom");
  });
});
