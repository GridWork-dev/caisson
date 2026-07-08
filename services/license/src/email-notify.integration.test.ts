// Unit + PGlite coverage for email-notify.ts, mirroring discord-notify.integration.test.ts's shape:
// identity resolution over the REAL account_member DDL (dual-GUC RLS, ADR-0176) + a better-auth-
// shaped "user" table (a TEST DOUBLE of better-auth's own migrator output — apps/site/lib/
// deploy-migrate.ts runs the real one), plus resolveEmailer's env gate and notifyPurchaseEmail's
// never-throws push contract.
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
import { createCaptureEmailer, type CaptureEmailer } from "@caisson/email";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  findBuyerEmail,
  findBuyerUserId,
  notifyPurchaseEmail,
  notifyRenewalEmail,
  recipientFor,
  resolveEmailer,
} from "./email-notify.ts";

// A minimal test double of better-auth's own "user" table — only the columns email-notify.ts reads
// (id/email/name). The real one is created by better-auth's getMigrations (deploy-migrate.ts).
const BETTER_AUTH_USER_DDL = `
CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "name" text
);
`;

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ACCOUNT_MEMBER_SCHEMA_SQL);
  await tp.exec(BETTER_AUTH_USER_DDL);

  // An ORG account with an owner + a seat, both with a "user" row.
  await withTenant(tp.pg, "acct_org", async (tx) => {
    await tx.query(
      `INSERT INTO account_member (account_id, user_id, role) VALUES
         ('acct_org', 'user_owner', 'owner'),
         ('acct_org', 'user_seat', 'seat')`,
    );
  });
  await tp.pg.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO "user" ("id", "email", "name") VALUES
         ('user_owner', 'owner@example.test', 'Ada Owner'),
         ('user_seat', 'seat@example.test', 'Sam Seat'),
         ('user_personal', 'solo@example.test', NULL)`,
    );
  });
});
afterAll(async () => {
  await tp.close();
});

describe("findBuyerUserId (org owner preferred, personal-account fallback)", () => {
  test("an org account resolves to the OWNER's user id, not a seat", async () => {
    expect(await findBuyerUserId(tp.pg, "acct_org")).toBe("user_owner");
  });

  test("personal-account fallback: no membership row ⇒ account_id IS the user id", async () => {
    expect(await findBuyerUserId(tp.pg, "user_personal")).toBe("user_personal");
  });

  test("a members-only account with no owner row falls back to the first member", async () => {
    await withTenant(tp.pg, "acct_no_owner", async (tx) => {
      await tx.query(
        `INSERT INTO account_member (account_id, user_id, role) VALUES ('acct_no_owner', 'user_seat', 'seat')`,
      );
    });
    expect(await findBuyerUserId(tp.pg, "acct_no_owner")).toBe("user_seat");
  });
});

describe("findBuyerEmail (account_member → better-auth's user table)", () => {
  test("resolves the org owner's email + name", async () => {
    expect(await findBuyerEmail(tp.pg, "acct_org")).toEqual({
      email: "owner@example.test",
      name: "Ada Owner",
    });
  });

  test("a personal account with no name on file still resolves the email", async () => {
    expect(await findBuyerEmail(tp.pg, "user_personal")).toEqual({
      email: "solo@example.test",
      name: null,
    });
  });

  test("an unresolvable user id (no matching row) resolves to null", async () => {
    expect(await findBuyerEmail(tp.pg, "acct_unlinked")).toBeNull();
  });
});

describe("recipientFor (credit-expiry-scheduler adapter — never throws)", () => {
  test("resolves the buyer's email", async () => {
    expect(await recipientFor(tp.pg, "acct_org")).toBe("owner@example.test");
  });

  test("an unresolvable account resolves to null, not a throw", async () => {
    expect(await recipientFor(tp.pg, "acct_unlinked")).toBeNull();
  });

  test("a failing lookup (missing better-auth tables) resolves to null, not a throw", async () => {
    const fresh = await newTestPg(); // no account_member/user tables at all
    try {
      expect(await recipientFor(fresh.pg, "acct_org")).toBeNull();
    } finally {
      await fresh.close();
    }
  });
});

describe("resolveEmailer (env gate)", () => {
  test("capture driver when RESEND_API_KEY is unset", () => {
    const emailer = resolveEmailer({});
    expect("sent" in emailer).toBe(true); // only CaptureEmailer exposes `.sent`
  });

  test("capture driver when RESEND_API_KEY is blank", () => {
    const emailer = resolveEmailer({ RESEND_API_KEY: "   " });
    expect("sent" in emailer).toBe(true);
  });

  test("the Resend driver when RESEND_API_KEY is set", () => {
    const emailer = resolveEmailer({ RESEND_API_KEY: "re_test" });
    expect("sent" in emailer).toBe(false); // createResendEmailer never exposes `.sent`
  });
});

describe("notifyPurchaseEmail (never-throws push)", () => {
  test("sends the purchase-confirmation template to the buyer's resolved address", async () => {
    const emailer = createCaptureEmailer();
    await notifyPurchaseEmail(tp.pg, emailer, {
      accountId: "acct_org",
      orderId: "ord_1",
      currency: "usd",
      amountTotalMinor: 79900,
      lines: [{ productSlug: "field-crypto" }],
    });
    expect(emailer.sent).toEqual([
      {
        to: "owner@example.test",
        template: "purchase-confirmation",
        data: {
          buyerName: "Ada Owner",
          orderId: "ord_1",
          currency: "usd",
          amountTotalMinor: 79900,
          // The slug humanized for the receipt — never the raw internal id.
          lines: [{ label: "Field Crypto" }],
          dashboardUrl: "https://caisson.sh/dashboard",
        },
      },
    ]);
  });

  test("a subscription-cycle notice sends the subscription-payment-received template (CAISSON-27)", async () => {
    const emailer = createCaptureEmailer();
    await notifyPurchaseEmail(tp.pg, emailer, {
      accountId: "acct_org",
      orderId: "txn_cycle_1",
      currency: "usd",
      amountTotalMinor: 149900,
      lines: [{ productSlug: "compliance-updates" }],
      subscriptionCycle: true,
    });
    expect(emailer.sent).toEqual([
      {
        to: "owner@example.test",
        // The recurring-payment receipt, NOT the first-purchase purchase-confirmation.
        template: "subscription-payment-received",
        data: {
          buyerName: "Ada Owner",
          orderId: "txn_cycle_1",
          currency: "usd",
          amountTotalMinor: 149900,
          lines: [{ label: "Compliance Updates" }],
          dashboardUrl: "https://caisson.sh/dashboard",
        },
      },
    ]);
  });

  test("an unresolvable buyer address sends nothing (log-and-drop, not a throw)", async () => {
    const emailer = createCaptureEmailer();
    await notifyPurchaseEmail(tp.pg, emailer, {
      accountId: "acct_unlinked",
      orderId: "ord_2",
      currency: "usd",
      amountTotalMinor: 100,
      lines: [],
    });
    expect(emailer.sent).toEqual([]);
  });

  test("a throwing emailer never throws out", async () => {
    const boom: CaptureEmailer = {
      async send() {
        throw new Error("resend down");
      },
      get sent() {
        return [];
      },
    };
    await notifyPurchaseEmail(tp.pg, boom, {
      accountId: "acct_org",
      orderId: "ord_3",
      currency: "usd",
      amountTotalMinor: 100,
      lines: [],
    });
  });

  test("a failing identity lookup (missing better-auth tables) never throws out", async () => {
    const fresh = await newTestPg(); // no account/account_member tables at all
    try {
      const emailer = createCaptureEmailer();
      await notifyPurchaseEmail(fresh.pg, emailer, {
        accountId: "acct_org",
        orderId: "ord_4",
        currency: "usd",
        amountTotalMinor: 100,
        lines: [],
      });
      expect(emailer.sent).toEqual([]);
    } finally {
      await fresh.close();
    }
  });
});

describe("notifyRenewalEmail (never-throws push, ADR-0251)", () => {
  test("sends the renewal-confirmation template to the buyer's resolved address, formatting the window to a bare date", async () => {
    const emailer = createCaptureEmailer();
    await notifyRenewalEmail(tp.pg, emailer, {
      accountId: "acct_org",
      orderId: "ord_ren_1",
      currency: "usd",
      amountTotalMinor: 29900,
      lines: [
        {
          entitlementId: "ai-production",
          newWindowEnd: "2028-01-15T00:00:00.000Z",
        },
      ],
    });
    expect(emailer.sent).toEqual([
      {
        to: "owner@example.test",
        template: "renewal-confirmation",
        data: {
          buyerName: "Ada Owner",
          orderId: "ord_ren_1",
          currency: "usd",
          amountTotalMinor: 29900,
          // The id humanized for the receipt ("ai" upper-cased) — never the raw internal id.
          lines: [{ label: "AI Production", newWindowEnd: "2028-01-15" }],
          dashboardUrl: "https://caisson.sh/dashboard",
        },
      },
    ]);
  });

  test("an unresolvable buyer address sends nothing (log-and-drop, not a throw)", async () => {
    const emailer = createCaptureEmailer();
    await notifyRenewalEmail(tp.pg, emailer, {
      accountId: "acct_unlinked",
      orderId: "ord_ren_2",
      currency: "usd",
      amountTotalMinor: 100,
      lines: [],
    });
    expect(emailer.sent).toEqual([]);
  });

  test("a throwing emailer never throws out", async () => {
    const boom: CaptureEmailer = {
      async send() {
        throw new Error("resend down");
      },
      get sent() {
        return [];
      },
    };
    await notifyRenewalEmail(tp.pg, boom, {
      accountId: "acct_org",
      orderId: "ord_ren_3",
      currency: "usd",
      amountTotalMinor: 100,
      lines: [],
    });
  });

  test("a failing identity lookup (missing better-auth tables) never throws out", async () => {
    const fresh = await newTestPg(); // no account/account_member tables at all
    try {
      const emailer = createCaptureEmailer();
      await notifyRenewalEmail(fresh.pg, emailer, {
        accountId: "acct_org",
        orderId: "ord_ren_4",
        currency: "usd",
        amountTotalMinor: 100,
        lines: [],
      });
      expect(emailer.sent).toEqual([]);
    } finally {
      await fresh.close();
    }
  });
});
