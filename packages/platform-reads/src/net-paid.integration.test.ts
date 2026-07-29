// readNetPaidByItem on PGlite + real withTenant RLS. Two things are under test and only one of them
// is the query: the SQL netting expression must agree with `@caisson/service-license`'s own
// `netCharged` on every case, because the money lives in one place and the arithmetic now lives in
// two. `charged_amount` / `refunded_amount` arrive by ALTER TABLE, so the columns-contract test's
// CREATE-TABLE parser cannot see them — this file exercises them against live columns instead.
//
// Fixtures go through the real `@caisson/service-license` write path (a devDependency here, same as
// updates-window.integration.test.ts) so the rows look exactly like production's; the read under
// test never imports that package.
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import {
  ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL,
  ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL,
  ENTITLEMENT_SCHEMA_SQL,
  grantEntitlements,
  netCharged,
  recordLineRefund,
  revokePurchaseGrants,
} from "@caisson/service-license";
import { withTenant } from "@caisson/tenancy-rls";
import { readNetPaidByItem } from "./index.ts";

setDefaultTimeout(30_000);

let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(ENTITLEMENT_SCHEMA_SQL);
  await tp.exec(ENTITLEMENT_GRANT_LINE_ITEM_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_CHARGED_AMOUNT_MIGRATION_SQL);
  await tp.exec(ENTITLEMENT_GRANT_REFUNDED_AMOUNT_MIGRATION_SQL);
});

afterAll(async () => {
  await tp.close();
});

const onetime = (purchaseId: string) =>
  ({ kind: "one_time", purchaseId }) as const;

interface SeedInput {
  readonly acct: string;
  readonly entitlementId: string;
  readonly purchaseId: string;
  readonly lineItemId: string;
  readonly charged?: { amountMinorUnits: number; currency: string };
}

async function seedGrant(input: SeedInput): Promise<void> {
  await withTenant(tp.pg, input.acct, (tx) =>
    grantEntitlements(tx, {
      accountId: input.acct,
      entitlementIds: [input.entitlementId],
      sourceEventId: input.purchaseId,
      source: onetime(input.purchaseId),
      lineItemId: input.lineItemId,
      ...(input.charged === undefined ? {} : { charged: input.charged }),
    }),
  );
}

const refund = (
  acct: string,
  lineItemId: string,
  amountMinorUnits: number,
  adjustmentId: string,
) =>
  withTenant(tp.pg, acct, (tx) =>
    recordLineRefund(tx, {
      accountId: acct,
      lineItemId,
      amountMinorUnits,
      adjustmentId,
    }),
  );

const read = (acct: string) =>
  withTenant(tp.pg, acct, (tx) => readNetPaidByItem(tx, acct));

describe("readNetPaidByItem — the paidByItem producer (ADR-0382 lock 2 / ADR-0394)", () => {
  test("unknown account -> empty map", async () => {
    expect(await read("acct_np_unknown")).toEqual({});
  });

  test("an unrefunded grant reports its full charge", async () => {
    const acct = "acct_np_plain";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_1",
      lineItemId: "txnitm_np_1",
      charged: { amountMinorUnits: 164_900, currency: "usd" },
    });
    expect(await read(acct)).toEqual({
      compliance: { amountMinorUnits: 164_900, currency: "usd" },
    });
  });

  test("a partial refund is netted out of the reported charge", async () => {
    const acct = "acct_np_partial";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_2",
      lineItemId: "txnitm_np_2",
      charged: { amountMinorUnits: 164_900, currency: "usd" },
    });
    expect(await refund(acct, "txnitm_np_2", 40_000, "adj_np_2")).toBe(1);
    expect(await read(acct)).toEqual({
      compliance: { amountMinorUnits: 124_900, currency: "usd" },
    });
  });

  test("two partials accumulate; the floor is 0, never negative", async () => {
    const acct = "acct_np_floor";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_3",
      lineItemId: "txnitm_np_3",
      charged: { amountMinorUnits: 100_000, currency: "usd" },
    });
    await refund(acct, "txnitm_np_3", 60_000, "adj_np_3a");
    await refund(acct, "txnitm_np_3", 90_000, "adj_np_3b");
    // 100_000 − 150_000 would be −50_000; the read floors it, matching netCharged.
    expect(await read(acct)).toEqual({
      compliance: { amountMinorUnits: 0, currency: "usd" },
    });
  });

  test("a NULL charge yields NO key, so the quote credits at retail", async () => {
    const acct = "acct_np_null";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_4",
      lineItemId: "txnitm_np_4",
      // charge omitted — could not be attributed to one SKU
    });
    // Not `{compliance: {amountMinorUnits: 0}}`: a zero would credit the buyer at nothing.
    expect(await read(acct)).toEqual({});
  });

  test("a revoked grant is not owned, so it never reaches the map", async () => {
    const acct = "acct_np_revoked";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_5",
      lineItemId: "txnitm_np_5",
      charged: { amountMinorUnits: 164_900, currency: "usd" },
    });
    await withTenant(tp.pg, acct, (tx) =>
      revokePurchaseGrants(tx, { accountId: acct, purchaseId: "pay_np_5" }),
    );
    expect(await read(acct)).toEqual({});
  });

  test("several active grants for one id -> the LARGEST net charge wins", async () => {
    const acct = "acct_np_multi";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_6a",
      lineItemId: "txnitm_np_6a",
      charged: { amountMinorUnits: 144_900, currency: "usd" },
    });
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_6b",
      lineItemId: "txnitm_np_6b",
      charged: { amountMinorUnits: 164_900, currency: "usd" },
    });
    // Most favorable to the buyer, matching readUpdatesWindows's max fold.
    expect((await read(acct)).compliance).toEqual({
      amountMinorUnits: 164_900,
      currency: "usd",
    });
    // ...and it tracks refunds: refunding the larger line demotes it below the smaller one.
    await refund(acct, "txnitm_np_6b", 50_000, "adj_np_6");
    expect((await read(acct)).compliance).toEqual({
      amountMinorUnits: 144_900,
      currency: "usd",
    });
  });

  test("a non-USD charge keeps its currency for the pricebook to reject", async () => {
    const acct = "acct_np_eur";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_7",
      lineItemId: "txnitm_np_7",
      charged: { amountMinorUnits: 150_000, currency: "eur" },
    });
    // The read does not invent an exchange rate or silently drop the row — it reports the currency
    // and the pricebook credits at retail because it is not USD.
    expect(await read(acct)).toEqual({
      compliance: { amountMinorUnits: 150_000, currency: "eur" },
    });
  });

  test("a USD grant outranks a numerically LARGER non-USD one", async () => {
    // Minor units are not comparable across currencies. ¥165,000 (no minor unit) beats $1,649 on the
    // raw integer while being worth less, and only the USD row can lift credit above retail — rank
    // by amount alone and the yen row shadows it, silently dropping the buyer's above-retail floor.
    const acct = "acct_np_currency_rank";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_8a",
      lineItemId: "txnitm_np_8a",
      charged: { amountMinorUnits: 164_900, currency: "usd" },
    });
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_8b",
      lineItemId: "txnitm_np_8b",
      charged: { amountMinorUnits: 165_000, currency: "jpy" },
    });
    expect((await read(acct)).compliance).toEqual({
      amountMinorUnits: 164_900,
      currency: "usd",
    });
  });

  test("the USD preference is case-insensitive (providers send USD and usd)", async () => {
    const acct = "acct_np_currency_case";
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_9a",
      lineItemId: "txnitm_np_9a",
      charged: { amountMinorUnits: 164_900, currency: "USD" },
    });
    await seedGrant({
      acct,
      entitlementId: "compliance",
      purchaseId: "pay_np_9b",
      lineItemId: "txnitm_np_9b",
      charged: { amountMinorUnits: 165_000, currency: "jpy" },
    });
    // An exact `charged_currency = 'usd'` comparison would rank this row below the yen one.
    expect((await read(acct)).compliance).toEqual({
      amountMinorUnits: 164_900,
      currency: "USD",
    });
  });

  test("the SQL netting agrees with netCharged on every case", async () => {
    // The drift guard. GREATEST(charged − COALESCE(refunded,0), 0) in the query and
    // Math.max(charged − (refunded ?? 0), 0) in the service are the same money rule written twice;
    // this is what fails if either side is edited alone.
    const cases: { charged: number | null; refunds: number[] }[] = [
      { charged: 164_900, refunds: [] },
      { charged: 164_900, refunds: [40_000] },
      { charged: 100_000, refunds: [60_000, 90_000] },
      { charged: 65_900, refunds: [65_900] },
      { charged: 0, refunds: [] },
      { charged: 1, refunds: [1] },
      // The NULL case is what makes the `number | null` comparison below real rather than
      // decorative: netCharged is NULL-in/NULL-out, and the read expresses that as an absent key.
      { charged: null, refunds: [] },
    ];
    for (const [i, c] of cases.entries()) {
      const acct = `acct_np_parity_${String(i)}`;
      const lineItemId = `txnitm_np_parity_${String(i)}`;
      await seedGrant({
        acct,
        entitlementId: "compliance",
        purchaseId: `pay_np_parity_${String(i)}`,
        lineItemId,
        ...(c.charged === null
          ? {}
          : { charged: { amountMinorUnits: c.charged, currency: "usd" } }),
      });
      for (const [j, amount] of c.refunds.entries()) {
        await refund(
          acct,
          lineItemId,
          amount,
          `adj_np_parity_${String(i)}_${String(j)}`,
        );
      }
      const total = c.refunds.reduce((sum, n) => sum + n, 0);
      const actual: number | null =
        (await read(acct)).compliance?.amountMinorUnits ?? null;
      expect(actual).toBe(netCharged(c.charged, total === 0 ? null : total));
    }
  });
});
