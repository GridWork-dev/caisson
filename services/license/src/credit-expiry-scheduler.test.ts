// Unit coverage for the ADR-0256 credit-expiry scheduler (extended G24, buyer-lifecycle audit
// 2026-07-07). Three things matter here, none of which need a live pg-boss (pg-boss needs real
// Postgres; PGlite cannot back it — construction stays behind the env gate in every test below):
//   1. the wallet-account enumerator + tick fan-out are correct against a REAL PGlite (RLS applies
//      for real, via the same `admin_write` policy the admin mutation surface already provisions) —
//      and, since G24, the SAME shape for the updates-window account population;
//   2. `startCreditExpiryScheduler` is INERT when unarmed — a throwing factory proves it is never
//      even called;
//   3. when armed, it registers all FIVE tasks (credit sweep/notice/tick + G24's updates-window
//      notice/tick), starts consuming each, and schedules BOTH daily ticks on the one cron —
//      proven with a FAKE `createPgBossJobQueue`-shaped factory; a start failure logs and never
//      throws (the commerce path must stay up regardless of scheduler health).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  CREDIT_EXPIRY_NOTICE_TASK,
  CREDIT_EXPIRY_SWEEP_TASK,
  CREDIT_SCHEMA_SQL,
} from "@caisson/credits";
import type { createPgBossJobQueue } from "@caisson/jobs";
import {
  createFakeQueue,
  createFakeQueueFactory,
} from "./scheduler-test-fixtures.ts";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  buildAdminWritePolicySql,
} from "@caisson/org-controls";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  CREDIT_EXPIRY_TICK_TASK,
  listUpdatesWindowAccountIds,
  listWalletAccountIds,
  loadCreditExpiryScheduleConfig,
  runCreditExpiryTick,
  runUpdatesWindowExpiryTick,
  startCreditExpiryScheduler,
  UPDATES_WINDOW_EXPIRY_TICK_TASK,
} from "./credit-expiry-scheduler.ts";
import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
  UPDATES_WINDOW_EXPIRY_NOTICE_SCHEMA_SQL,
} from "./entitlement-store.ts";
import { UPDATES_WINDOW_EXPIRY_NOTICE_TASK } from "./updates-window-expiry-task.ts";

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
  // G24: the entitlement_grant junction, same reuse rationale for its own admin_write policy.
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_UPDATES_WINDOW_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL);
  await tp.exec(buildAdminWritePolicySql("entitlement_grant"));
  await tp.exec(UPDATES_WINDOW_EXPIRY_NOTICE_SCHEMA_SQL);
});

afterAll(async () => {
  await tp.close();
});

/** A fake `JobQueue` recording every `enqueue` call instead of touching a driver. */

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

describe("listUpdatesWindowAccountIds / runUpdatesWindowExpiryTick (G24, PGlite, real RLS)", () => {
  test("enumerates every distinct account holding a windowed active one_time grant, ordered", async () => {
    const onetime = (purchaseId: string) =>
      ({ kind: "one_time", purchaseId }) as const;
    await withTenant(db, "acct_w_b", (tx) =>
      grantEntitlements(tx, {
        accountId: "acct_w_b",
        entitlementIds: ["compliance"],
        sourceEventId: "pi_w_b",
        source: onetime("pi_w_b"),
      }),
    );
    await withTenant(db, "acct_w_a", (tx) =>
      grantEntitlements(tx, {
        accountId: "acct_w_a",
        entitlementIds: ["compliance"],
        sourceEventId: "pi_w_a",
        source: onetime("pi_w_a"),
      }),
    );
    // A grant with NO stamped window must NOT be enumerated (never notice-eligible).
    await withTenant(db, "acct_w_nowindow", (tx) =>
      grantEntitlements(tx, {
        accountId: "acct_w_nowindow",
        entitlementIds: ["compliance"],
        sourceEventId: "pi_w_nowindow",
        source: onetime("pi_w_nowindow"),
      }),
    );
    await tp.exec(
      `UPDATE entitlement_grant SET updates_expires_at = now() + interval '10 days'
       WHERE account_id IN ('acct_w_a', 'acct_w_b')`,
    );

    expect(await listUpdatesWindowAccountIds(db)).toEqual([
      "acct_w_a",
      "acct_w_b",
    ]);
  });

  test("the tick enqueues one notice job per windowed account, singletonKey'd by account", async () => {
    const queue = createFakeQueue();

    await runUpdatesWindowExpiryTick(db, queue);

    // Seeded above: acct_w_a, acct_w_b — ORDER BY account_id.
    expect(queue.calls).toEqual([
      {
        name: UPDATES_WINDOW_EXPIRY_NOTICE_TASK,
        payload: { accountId: "acct_w_a" },
        options: { singletonKey: "acct_w_a" },
      },
      {
        name: UPDATES_WINDOW_EXPIRY_NOTICE_TASK,
        payload: { accountId: "acct_w_b" },
        options: { singletonKey: "acct_w_b" },
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
  test("registers all FIVE tasks (G24 adds two), starts consuming each, and schedules BOTH daily ticks", async () => {
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
      UPDATES_WINDOW_EXPIRY_NOTICE_TASK,
      UPDATES_WINDOW_EXPIRY_TICK_TASK,
    ].sort();
    expect(fake.registeredTaskNames.sort()).toEqual(expectedNames);
    expect(fake.workCalls.sort()).toEqual(expectedNames);
    expect(
      [...fake.scheduleCalls].sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual(
      [
        { name: CREDIT_EXPIRY_TICK_TASK, cron: "30 3 * * *", data: {} },
        {
          name: UPDATES_WINDOW_EXPIRY_TICK_TASK,
          cron: "30 3 * * *",
          data: {},
        },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
  });

  test("the updates-window notice uses updatesWindowDashboardUrl when given, not the credits dashboardUrl", async () => {
    const fake = createFakeQueueFactory();
    let capturedUrl: string | undefined;
    const emailer = {
      send: async (msg: { data: Record<string, unknown> }) => {
        capturedUrl = msg.data.url as string;
      },
    };
    await withTenant(db, "acct_url_check", (tx) =>
      grantEntitlements(tx, {
        accountId: "acct_url_check",
        entitlementIds: ["compliance"],
        sourceEventId: "pi_url_check",
        source: { kind: "one_time", purchaseId: "pi_url_check" },
      }),
    );
    await tp.exec(
      `UPDATE entitlement_grant SET updates_expires_at = now() + interval '5 days'
       WHERE account_id = 'acct_url_check'`,
    );
    await startCreditExpiryScheduler({
      db,
      connectionString: "postgres://unused",
      schedule: "30 3 * * *",
      createQueue: fake.factory,
      emailer,
      recipientFor: async () => "buyer@example.test",
      dashboardUrl: "https://example.test/dashboard/credits",
      updatesWindowDashboardUrl: "https://example.test/dashboard/license",
    });
    // Invoke the ACTUAL registered task's handler (captured by the fake factory) — proves the
    // real `startCreditExpiryScheduler` wiring resolved `updatesWindowDashboardUrl`, not a
    // hand-rolled duplicate of the resolution logic.
    const task = fake.registeredTasks.find(
      (t) => t.name === UPDATES_WINDOW_EXPIRY_NOTICE_TASK,
    );
    expect(task).toBeDefined();
    await task?.handler({ accountId: "acct_url_check" });
    expect(capturedUrl).toBe("https://example.test/dashboard/license");
  });

  test("threads `alerting` through to the queue factory's config (CAISSON-53)", async () => {
    const fake = createFakeQueueFactory();
    const alerting = {
      reportTaskFailure: async () => {},
      reportInfraError: async () => {},
    };

    await startCreditExpiryScheduler({
      db,
      connectionString: "postgres://unused",
      schedule: "30 3 * * *",
      createQueue: fake.factory,
      alerting,
      ...noEmailer,
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
