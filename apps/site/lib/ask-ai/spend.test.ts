// Spend-cap accounting tests over the in-memory PGlite double (DATABASE_URL unset). Integer
// micro-dollars, persisted, atomic reserve-before-generate (ADR-0234 F2 rider, hardened / ADR-0007).
// Verifies per-lane isolation, cap resolution defaults, settle netting to the real cost, and the
// concurrency boundary that makes the cap a HARD ceiling rather than check-then-charge.
import { beforeAll, expect, test } from "bun:test";
import { getDb } from "../db.ts";
import {
  dollarsToMicro,
  readTodaySpendMicro,
  reserveSpendMicro,
  resolveDailyCapMicro,
  settleSpendMicro,
} from "./spend.ts";

beforeAll(() => {
  delete process.env.DATABASE_URL;
  const g = globalThis as unknown as {
    caissonTransactor?: unknown;
    caissonPglite?: unknown;
  };
  g.caissonTransactor = undefined;
  g.caissonPglite = undefined;
});

test("dollarsToMicro is integer micro-dollars (never floats)", () => {
  expect(dollarsToMicro(0.95)).toBe(950_000);
  expect(dollarsToMicro(0.002)).toBe(2_000);
  expect(Number.isInteger(dollarsToMicro(0.0000019))).toBe(true);
});

test("resolveDailyCapMicro defaults $10 public / $50 premium, is env-swappable per lane, and falls back safely on garbage", () => {
  expect(resolveDailyCapMicro("public", {})).toBe(10_000_000);
  expect(resolveDailyCapMicro("premium", {})).toBe(50_000_000);
  expect(
    resolveDailyCapMicro("public", { ASK_AI_PUBLIC_DAILY_CAP_USD: "5" }),
  ).toBe(5_000_000);
  expect(
    resolveDailyCapMicro("premium", { ASK_AI_PREMIUM_DAILY_CAP_USD: "75" }),
  ).toBe(75_000_000);
  expect(
    resolveDailyCapMicro("public", {
      ASK_AI_PUBLIC_DAILY_CAP_USD: "not-a-number",
    }),
  ).toBe(10_000_000);
  expect(
    resolveDailyCapMicro("public", { ASK_AI_PUBLIC_DAILY_CAP_USD: "-3" }),
  ).toBe(10_000_000);
});

test("reserve + settle nets to the real cost and persists across re-reads, isolated per lane", async () => {
  const db = await getDb();
  const publicBefore = await readTodaySpendMicro(db, "public");
  const premiumBefore = await readTodaySpendMicro(db, "premium");

  const granted = await reserveSpendMicro(
    db,
    "public",
    publicBefore + 1_000_000,
  );
  expect(granted).toBe(true);
  await settleSpendMicro(db, "public", 2_000); // real cost well under the $0.05 reservation

  expect(await readTodaySpendMicro(db, "public")).toBe(publicBefore + 2_000);
  // The premium counter never moved — the two lanes are isolated.
  expect(await readTodaySpendMicro(db, "premium")).toBe(premiumBefore);
});

test("settle with actualMicro 0 fully releases a reservation (e.g. retrieval failed after granting it)", async () => {
  const db = await getDb();
  const before = await readTodaySpendMicro(db, "premium");
  const cap = before + 1_000_000;

  expect(await reserveSpendMicro(db, "premium", cap)).toBe(true);
  await settleSpendMicro(db, "premium", 0);

  expect(await readTodaySpendMicro(db, "premium")).toBe(before);
});

test("reserveSpendMicro fails closed when the reservation itself would breach the cap", async () => {
  const db = await getDb();
  const before = await readTodaySpendMicro(db, "public");
  // The reservation is $0.05 (50_000 micro) — a cap that only leaves 1 micro of headroom cannot fit it.
  const tightCap = before + 1;

  const granted = await reserveSpendMicro(db, "public", tightCap);
  expect(granted).toBe(false);
  // Nothing was reserved — the counter must not have moved.
  expect(await readTodaySpendMicro(db, "public")).toBe(before);
});

test("reserveSpendMicro is atomic under concurrency: two near-cap reservations, only one is granted", async () => {
  const db = await getDb();
  const lane = "premium";
  const before = await readTodaySpendMicro(db, lane);
  // Room for exactly ONE $0.05 (50_000 micro) reservation, not two.
  const cap = before + 60_000;

  const [a, b] = await Promise.all([
    reserveSpendMicro(db, lane, cap),
    reserveSpendMicro(db, lane, cap),
  ]);
  const grantedCount = [a, b].filter(Boolean).length;
  expect(grantedCount).toBe(1);

  // Settle both (the ungranted one is a false-returning no-write call in the real handler, but here we
  // only settle the one that actually reserved, to leave the ledger consistent for later tests).
  if (a) await settleSpendMicro(db, lane, 0);
  if (b) await settleSpendMicro(db, lane, 0);
  expect(await readTodaySpendMicro(db, lane)).toBe(before);
});
