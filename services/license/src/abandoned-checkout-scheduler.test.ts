// Unit coverage for the abandoned-checkout email scheduler (SPEC-abandoned-checkout-email.md,
// operator-locked 2026-07-10), mirroring credit-expiry-scheduler.test.ts's shape: (1) the account
// enumerator + tick fan-out against a REAL PGlite (RLS applies for real, via the admin_write
// SELECT-only policy this table provisions); (2) `startAbandonedCheckoutScheduler` is INERT when
// unarmed; (3) when armed, it registers both tasks, starts consuming each, and schedules the tick
// — proven with a FAKE `createPgBossJobQueue`-shaped factory, then the REAL registered notice
// task's handler is invoked directly to prove the send + PostHog capture actually wire through (the
// same "capture the real handler" technique credit-expiry-scheduler.test.ts uses for
// updatesWindowDashboardUrl); a start failure logs and never throws.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
// PGlite under CI runner load regularly crosses the 5s default; repo-wide standard treatment.
setDefaultTimeout(30_000);
import { ACCOUNT_MEMBER_SCHEMA_SQL } from "@caisson/auth";
import type { createPgBossJobQueue } from "@caisson/jobs";
import {
  createFakeQueue,
  createFakeQueueFactory,
} from "./scheduler-test-fixtures.ts";
import {
  ADMIN_WRITE_ROLE_BOOTSTRAP_SQL,
  buildAdminSelectPolicySql,
} from "@caisson/org-controls";
import { type TestPg, newTestPg } from "@caisson/testing";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import {
  ABANDONED_CHECKOUT_NOTICE_TASK,
  ABANDONED_CHECKOUT_TICK_TASK,
  loadAbandonedCheckoutScheduleConfig,
  runAbandonedCheckoutTick,
  startAbandonedCheckoutScheduler,
} from "./abandoned-checkout-scheduler.ts";
import {
  CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL,
  CHECKOUT_ABANDONMENT_SCHEMA_SQL,
  recordCheckoutAbandonment,
} from "./checkout-abandonment-store.ts";
import { ORDER_RECORD_SCHEMA_SQL } from "./subscription-history-store.ts";

// A minimal test double of better-auth's own "user" table (same shape email-notify.integration.
// test.ts uses) — only the columns email-notify.ts reads.
const BETTER_AUTH_USER_DDL = `
CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "name" text
);
`;

let tp: TestPg;
let db: Transactor;

beforeAll(async () => {
  tp = await newTestPg();
  db = tp.pg as unknown as Transactor;
  await tp.exec(ADMIN_WRITE_ROLE_BOOTSTRAP_SQL);
  await tp.exec(CHECKOUT_ABANDONMENT_SCHEMA_SQL);
  await tp.exec(CHECKOUT_ABANDONMENT_NOTICE_SCHEMA_SQL);
  await tp.exec(ORDER_RECORD_SCHEMA_SQL);
  await tp.exec(buildAdminSelectPolicySql("checkout_abandonment"));
  await tp.exec(ACCOUNT_MEMBER_SCHEMA_SQL);
  await tp.exec(BETTER_AUTH_USER_DDL);
});

afterAll(async () => {
  await tp.close();
});

describe("loadAbandonedCheckoutScheduleConfig", () => {
  test("unset env → null (inert)", () => {
    expect(loadAbandonedCheckoutScheduleConfig({})).toBeNull();
  });

  test("a blank env value → null (inert, not a bad-cron error)", () => {
    expect(
      loadAbandonedCheckoutScheduleConfig({
        ABANDONED_CHECKOUT_SCHEDULE: "   ",
      }),
    ).toBeNull();
  });

  test("a set cron is trimmed and returned", () => {
    expect(
      loadAbandonedCheckoutScheduleConfig({
        ABANDONED_CHECKOUT_SCHEDULE: " 15 4 * * * ",
      }),
    ).toBe("15 4 * * *");
  });
});

describe("runAbandonedCheckoutTick (PGlite, real RLS via admin_write)", () => {
  test("enqueues one notice job per notice-eligible account, singletonKey'd by account", async () => {
    await withTenant(db, "acct_tick_a", (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_tick_a",
        accountId: "acct_tick_a",
        items: [{ id: "x", label: "X" }],
      }),
    );
    await tp.exec(
      `UPDATE checkout_abandonment SET started_at = now() - interval '25 hours' WHERE id = 'ca_tick_a'`,
    );
    // Too recent — must not be enqueued.
    await withTenant(db, "acct_tick_too_recent", (tx) =>
      recordCheckoutAbandonment(tx, {
        id: "ca_tick_recent",
        accountId: "acct_tick_too_recent",
        items: [{ id: "x", label: "X" }],
      }),
    );

    const queue = createFakeQueue();
    await runAbandonedCheckoutTick(db, queue);

    expect(queue.calls).toEqual([
      {
        name: ABANDONED_CHECKOUT_NOTICE_TASK,
        payload: { accountId: "acct_tick_a" },
        options: { singletonKey: "acct_tick_a" },
      },
    ]);
  });
});

describe("startAbandonedCheckoutScheduler — INERT UNTIL ARMED", () => {
  test("schedule undefined → the queue factory is never called", async () => {
    const throwingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("createQueue must not be called when inert");
    };

    await expect(
      startAbandonedCheckoutScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: undefined,
        emailer: null,
        posthog: null,
        createQueue: throwingFactory,
      }),
    ).resolves.toBeUndefined();
  });

  test("schedule blank → the queue factory is never called", async () => {
    const throwingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("createQueue must not be called when inert");
    };

    await expect(
      startAbandonedCheckoutScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: "   ",
        emailer: null,
        posthog: null,
        createQueue: throwingFactory,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("startAbandonedCheckoutScheduler — armed", () => {
  test("registers both tasks, starts consuming each, and schedules the tick", async () => {
    const fake = createFakeQueueFactory();

    await startAbandonedCheckoutScheduler({
      db,
      connectionString: "postgres://unused",
      schedule: "0 5 * * *",
      emailer: null,
      posthog: null,
      createQueue: fake.factory,
    });

    const expectedNames = [
      ABANDONED_CHECKOUT_TICK_TASK,
      ABANDONED_CHECKOUT_NOTICE_TASK,
    ].sort();
    expect(fake.registeredTaskNames.sort()).toEqual(expectedNames);
    expect(fake.workCalls.sort()).toEqual(expectedNames);
    expect(fake.scheduleCalls).toEqual([
      { name: ABANDONED_CHECKOUT_TICK_TASK, cron: "0 5 * * *", data: {} },
    ]);
  });

  test("the REAL registered notice task sends the email and fires the PostHog capture on a hit", async () => {
    const fake = createFakeQueueFactory();
    const sent: Array<{ to: string; template: string }> = [];
    const captured: Array<{ event: string; distinct_id: string }> = [];
    const emailer = {
      send: async (msg: { to: string; template: string }) => {
        sent.push({ to: msg.to, template: msg.template });
      },
    };
    // Fake the outbound PostHog fetch (posthog-capture.ts's own fetchImpl seam is internal —
    // capture via a global fetch stub instead, scoped to this test only).
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        event: string;
        distinct_id: string;
      };
      captured.push({ event: body.event, distinct_id: body.distinct_id });
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    try {
      await tp.pg.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO "user" ("id", "email", "name") VALUES ('acct_notice_hit', 'buyer@example.test', 'Ada Buyer')`,
        );
      });
      await withTenant(db, "acct_notice_hit", (tx) =>
        recordCheckoutAbandonment(tx, {
          id: "ca_notice_hit",
          accountId: "acct_notice_hit",
          items: [{ id: "compliance", label: "Compliance bundle" }],
        }),
      );
      await tp.exec(
        `UPDATE checkout_abandonment SET started_at = now() - interval '25 hours' WHERE id = 'ca_notice_hit'`,
      );

      await startAbandonedCheckoutScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: "0 5 * * *",
        emailer,
        posthog: { key: "phc_test", host: "https://posthog.test" },
        createQueue: fake.factory,
      });
      const task = fake.registeredTasks.find(
        (t) => t.name === ABANDONED_CHECKOUT_NOTICE_TASK,
      );
      expect(task).toBeDefined();
      await task?.handler({ accountId: "acct_notice_hit" });

      expect(sent).toEqual([
        { to: "buyer@example.test", template: "abandoned-checkout" },
      ]);
      expect(captured).toEqual([
        {
          event: "abandoned_checkout_email_sent",
          distinct_id: "acct_notice_hit",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("a start failure logs and resolves — never throws past the boot path", async () => {
    const failingFactory: typeof createPgBossJobQueue = () => {
      throw new Error("boom");
    };
    const logs: string[] = [];

    await expect(
      startAbandonedCheckoutScheduler({
        db,
        connectionString: "postgres://unused",
        schedule: "0 5 * * *",
        emailer: null,
        posthog: null,
        createQueue: failingFactory,
        log: (message) => logs.push(message),
      }),
    ).resolves.toBeUndefined();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain("boom");
  });
});
