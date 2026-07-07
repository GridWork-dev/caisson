#!/usr/bin/env bun
/**
 * paddle-catalog-recreate — scripted, idempotent recreation of the Caisson catalog in Paddle.
 *
 * CAISSON-31 / launch-runbook §2.2. Paddle Sandbox and Production are separate catalogs with
 * separate ids — nothing carries over. This tool re-derives the ADR-0257/0258/0260 six-bundle
 * catalog from the display SOT and creates it in the target Paddle environment, replacing ~35
 * manual dashboard clicks with a repeatable, re-runnable script.
 *
 * SOT: `apps/site/lib/pricing.ts` — the display sheet the runbook §2.2 names as authoritative,
 * carrying every committed amount (BUNDLE_PRICES · MODULE_PRICES · PLAN_PRICES) plus the ADR-0260
 * §5 flat-40%-X9 renewal formula (`renewalAmount`). Importing it means no dollar amount is ever
 * hand-typed here, so the tool's catalog cannot drift from the site (or the pricebook, which
 * `pricing.test.ts` pins the same numbers against). Money stays integer cents (ADR-0007).
 *
 * Catalog shape (matches the runbook §2.2 table): 6 bundles + 22 à-la-carte modules (one-time) +
 * 2 annual subscriptions (Compliance-Updates, Developer) + 1 "Updates Renewal" product carrying a
 * per-SKU one-time renewal price. Enterprise is a Contact-us anchor with no price — no product.
 * Every product gets tax_category "saas".
 *
 * Usage:
 *   bun tools/paddle-catalog-recreate.ts               # DRY-RUN: print the create plan, no API calls
 *   PADDLE_ENV=production PADDLE_API_KEY=pdl_live_... \
 *     bun tools/paddle-catalog-recreate.ts --execute    # create against Paddle (idempotent)
 *   bun tools/paddle-catalog-recreate.ts --self-check   # assert the plan/money math, exit
 *
 * Idempotency: every product carries custom_data.caisson_id (+ caisson_kind) and every price
 * carries custom_data.caisson_key. --execute looks products/prices up by those markers first and
 * skips anything already present, so a re-run never duplicates. It only ever CREATES — it never
 * edits or archives an existing object (the operator owns any teardown).
 *
 * PADDLE_ENV switch defaults to "sandbox" so an --execute can never accidentally hit production;
 * the operator sets PADDLE_ENV=production explicitly for the real flip. Verification submission and
 * the flip stay the operator's act — this tool only builds the catalog.
 */
import assert from "node:assert/strict";

// Root tools/ scripts are linted by the root eslint pass (no-console); match the
// tooling/scripts/sot-check.ts convention of writing straight to stdio.
function out(...parts: unknown[]): void {
  process.stdout.write(parts.map(String).join(" ") + "\n");
}
function errOut(...parts: unknown[]): void {
  process.stderr.write(parts.map(String).join(" ") + "\n");
}

import {
  BUNDLE_PRICES,
  MODULE_PRICES,
  PLAN_PRICES,
  renewalAmount,
} from "../apps/site/lib/pricing.ts";

/** Outbound fetch with an explicit AbortController timeout — the native `AbortSignal.timeout` is
 *  forbidden on Bun (ADR-0002). Inlined so this standalone operator script needs no workspace
 *  import (`@caisson/kernel` is not hoisted to the repo-root node_modules). */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---- Plan model ---------------------------------------------------------------------------------

type ProductKind = "bundle" | "module" | "subscription" | "renewal-parent";

interface PlanPrice {
  /** Stable marker written to the Paddle price's custom_data.caisson_key for idempotent re-lookup. */
  key: string;
  description: string;
  /** Integer minor units (cents); money is never a float (ADR-0007). */
  amountCents: number;
  /** Present for a recurring price; omitted for a one-time price. */
  billingInterval?: "year";
}

interface PlanProduct {
  /** Stable marker written to the Paddle product's custom_data.caisson_id for idempotent re-lookup. */
  caissonId: string;
  kind: ProductKind;
  name: string;
  /** Always "saas" per the catalog policy (tax category locks after the first sale). */
  taxCategory: "saas";
  prices: PlanPrice[];
}

/** Integer cents from whole-USD list price. Fail-closed: a non-positive or non-integer result
 *  THROWS rather than shipping a bad amount — `!(c > 0)` so a NaN fails CLOSED. */
function toCents(usd: number): number {
  const c = Math.round(usd * 100);
  if (!Number.isInteger(c) || !(c > 0)) {
    throw new Error(
      `refusing non-positive/non-integer cents (${c}) for $${usd}`,
    );
  }
  return c;
}

/** Build the full desired catalog from the pricing SOT. Pure — no env, no network. */
function buildPlan(): PlanProduct[] {
  const products: PlanProduct[] = [];

  // 6 bundles — one-time perpetual license.
  for (const b of BUNDLE_PRICES) {
    if (b.amount === null) continue; // no Contact-us bundle exists, but stay defensive
    products.push({
      caissonId: b.id,
      kind: "bundle",
      name: `Caisson — ${b.label}`,
      taxCategory: "saas",
      prices: [
        {
          key: b.id,
          description: `${b.label} bundle — perpetual license`,
          amountCents: toCents(b.amount),
        },
      ],
    });
  }

  // 22 à-la-carte modules — one-time perpetual license.
  for (const m of MODULE_PRICES) {
    products.push({
      caissonId: m.id,
      kind: "module",
      name: `Caisson module — ${m.label}`,
      taxCategory: "saas",
      prices: [
        {
          key: m.id,
          description: `${m.label} module — perpetual license`,
          amountCents: toCents(m.amount),
        },
      ],
    });
  }

  // 2 annual subscriptions (Compliance-Updates, Developer). PLAN_PRICES also carries the "module"
  // from-anchor (a display aggregate, no product) and Enterprise (Contact-us, null amount) — both
  // excluded by the year+priced filter.
  for (const p of PLAN_PRICES) {
    if (p.unit !== "year" || p.amount === null) continue;
    products.push({
      caissonId: p.id,
      kind: "subscription",
      name: `Caisson — ${p.label}`,
      taxCategory: "saas",
      prices: [
        {
          key: p.id,
          description: `${p.label} — annual subscription`,
          amountCents: toCents(p.amount),
          billingInterval: "year",
        },
      ],
    });
  }

  // 1 "Updates Renewal" product carrying one per-SKU one-time renewal price (ADR-0251 Decision 4:
  // one product, per-SKU prices). Renewal cents = the shared 40%-X9 formula (`renewalAmount`), so
  // they match the site and the runbook exactly. A SKU whose list price is too low for an X9 point
  // (`renewalAmount` returns null) simply gets no renewal price.
  const renewalPrices: PlanPrice[] = [];
  const renewable = [
    ...BUNDLE_PRICES.map((b) => ({ id: b.id, label: b.label })),
    ...MODULE_PRICES.map((m) => ({ id: m.id, label: m.label })),
  ];
  for (const r of renewable) {
    const usd = renewalAmount(r.id);
    if (usd === null) continue;
    renewalPrices.push({
      key: `renew:${r.id}`,
      description: `${r.label} — 12-month updates renewal`,
      amountCents: toCents(usd),
    });
  }
  products.push({
    caissonId: "updates-renewal",
    kind: "renewal-parent",
    name: "Caisson — Updates Renewal",
    taxCategory: "saas",
    prices: renewalPrices,
  });

  return products;
}

// ---- Paddle API client (minimal) ----------------------------------------------------------------

const PADDLE_TIMEOUT_MS = 15_000;

function paddleEnv(): "sandbox" | "production" {
  // Default sandbox — an --execute never hits production unless PADDLE_ENV is set to it explicitly.
  return process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

function paddleBase(): string {
  return paddleEnv() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

function requireApiKey(): string {
  const key = process.env.PADDLE_API_KEY;
  if (key === undefined || key.length === 0) {
    throw new Error("PADDLE_API_KEY is required for --execute (fail-closed).");
  }
  return key;
}

interface PaddleObject {
  id: string;
  custom_data?: Record<string, unknown> | null;
  prices?: PaddleObject[];
}

async function paddleRequest(
  apiKey: string,
  method: "GET" | "POST",
  pathOrUrl: string,
  body?: unknown,
): Promise<{
  data: unknown;
  meta?: { pagination?: { has_more?: boolean; next?: string } };
}> {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${paddleBase()}${pathOrUrl}`;
  const res = await fetchWithTimeout(
    url,
    {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    PADDLE_TIMEOUT_MS,
  );
  const json = (await res.json()) as {
    data?: unknown;
    error?: { detail?: string };
    meta?: { pagination?: { has_more?: boolean; next?: string } };
  };
  if (!res.ok) {
    throw new Error(
      `Paddle ${method} ${url} → ${res.status}: ${json.error?.detail ?? "unknown error"}`,
    );
  }
  return { data: json.data, meta: json.meta };
}

/** List every existing product with its prices, keyed by custom_data.caisson_id (idempotency map). */
async function listExistingProducts(
  apiKey: string,
): Promise<Map<string, PaddleObject>> {
  const byId = new Map<string, PaddleObject>();
  let next: string | undefined =
    "/products?include=prices&per_page=100&status=active";
  while (next !== undefined) {
    const { data, meta } = await paddleRequest(apiKey, "GET", next);
    for (const p of data as PaddleObject[]) {
      const cid = p.custom_data?.caisson_id;
      if (typeof cid === "string") byId.set(cid, p);
    }
    next = meta?.pagination?.has_more ? meta.pagination.next : undefined;
  }
  return byId;
}

function existingPriceKeys(product: PaddleObject | undefined): Set<string> {
  const keys = new Set<string>();
  for (const pr of product?.prices ?? []) {
    const k = pr.custom_data?.caisson_key;
    if (typeof k === "string") keys.add(k);
  }
  return keys;
}

async function createProduct(
  apiKey: string,
  prod: PlanProduct,
): Promise<string> {
  const { data } = await paddleRequest(apiKey, "POST", "/products", {
    name: prod.name,
    tax_category: prod.taxCategory,
    type: "standard",
    custom_data: { caisson_id: prod.caissonId, caisson_kind: prod.kind },
  });
  return (data as PaddleObject).id;
}

async function createPrice(
  apiKey: string,
  productId: string,
  price: PlanPrice,
): Promise<void> {
  await paddleRequest(apiKey, "POST", "/prices", {
    product_id: productId,
    description: price.description,
    type: "standard",
    unit_price: { amount: String(price.amountCents), currency_code: "USD" },
    ...(price.billingInterval
      ? { billing_cycle: { interval: price.billingInterval, frequency: 1 } }
      : {}),
    custom_data: { caisson_key: price.key },
  });
}

// ---- Rendering + CLI ----------------------------------------------------------------------------

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function printPlan(plan: PlanProduct[]): void {
  const priceCount = plan.reduce((n, p) => n + p.prices.length, 0);
  out(`\nCaisson → Paddle catalog plan   [env: ${paddleEnv()}]`);
  out(`${plan.length} products (tax_category=saas), ${priceCount} prices\n`);
  const groups: Record<ProductKind, string> = {
    bundle: "BUNDLES",
    module: "MODULES",
    subscription: "SUBSCRIPTIONS",
    "renewal-parent": "UPDATES RENEWAL",
  };
  for (const kind of [
    "bundle",
    "module",
    "subscription",
    "renewal-parent",
  ] as ProductKind[]) {
    const rows = plan.filter((p) => p.kind === kind);
    if (rows.length === 0) continue;
    out(`${groups[kind]}`);
    for (const prod of rows) {
      out(`  ${prod.name}  [caisson_id=${prod.caissonId}]`);
      for (const pr of prod.prices) {
        const cadence = pr.billingInterval
          ? `/${pr.billingInterval}`
          : "one-time";
        out(
          `      ${pr.key.padEnd(26)} ${fmtUsd(pr.amountCents).padStart(11)}${cadence === "one-time" ? "  one-time" : cadence.padStart(10)}  (${pr.amountCents})`,
        );
      }
    }
    out("");
  }
  out(
    "Dry run — nothing created. Re-run with --execute (PADDLE_API_KEY set) to create.",
  );
  out(
    "Idempotent: existing products/prices are matched by custom_data and skipped.\n",
  );
}

async function execute(plan: PlanProduct[]): Promise<void> {
  const apiKey = requireApiKey();
  out(`\nExecuting against Paddle [${paddleEnv()}] — ${paddleBase()}\n`);
  const existing = await listExistingProducts(apiKey);
  let createdProducts = 0;
  let createdPrices = 0;
  for (const prod of plan) {
    const found = existing.get(prod.caissonId);
    let productId: string;
    if (found) {
      productId = found.id;
      out(`skip product   ${prod.caissonId} (${productId})`);
    } else {
      productId = await createProduct(apiKey, prod);
      createdProducts += 1;
      out(`create product ${prod.caissonId} (${productId})`);
    }
    const haveKeys = existingPriceKeys(found);
    for (const price of prod.prices) {
      if (haveKeys.has(price.key)) {
        out(`  skip price   ${price.key}`);
        continue;
      }
      await createPrice(apiKey, productId, price);
      createdPrices += 1;
      out(`  create price ${price.key}  ${fmtUsd(price.amountCents)}`);
    }
  }
  out(
    `\nDone. Created ${createdProducts} products, ${createdPrices} prices (existing were skipped).\n`,
  );
}

/** Assert the plan shape + money math (the one runnable check). */
function selfCheck(): void {
  const plan = buildPlan();
  const byKind = (k: ProductKind) => plan.filter((p) => p.kind === k);
  assert.equal(byKind("bundle").length, 6, "expected 6 bundles");
  assert.equal(byKind("module").length, 22, "expected 22 modules");
  assert.equal(byKind("subscription").length, 2, "expected 2 subscriptions");
  assert.equal(
    byKind("renewal-parent").length,
    1,
    "expected 1 renewal product",
  );
  assert.equal(plan.length, 31, "expected 31 products total");

  for (const prod of plan) {
    assert.equal(
      prod.taxCategory,
      "saas",
      `tax_category must be saas: ${prod.caissonId}`,
    );
    for (const pr of prod.prices) {
      assert.ok(
        Number.isInteger(pr.amountCents) && pr.amountCents > 0,
        `bad cents for ${pr.key}`,
      );
    }
  }

  // Pin the money math against the runbook §2.2 locked numbers.
  const bundleCents = (id: string) =>
    byKind("bundle").find((p) => p.caissonId === id)?.prices[0]?.amountCents;
  assert.equal(bundleCents("compliance"), 104900, "compliance = $1,049.00");
  assert.equal(bundleCents("everything"), 205900, "everything = $2,059.00");

  const renewalCents = (id: string) =>
    byKind("renewal-parent")[0]?.prices.find((pr) => pr.key === `renew:${id}`)
      ?.amountCents;
  // ADR-0260 §5 flat-40%-X9 renewal ladder (runbook: $419/$289/$249/$129/$159/$819).
  assert.equal(renewalCents("compliance"), 41900, "compliance renewal = $419");
  assert.equal(renewalCents("everything"), 81900, "everything renewal = $819");
  assert.equal(
    renewalCents("agentic-dev"),
    12900,
    "agentic-dev renewal = $129",
  );

  const subCents = (id: string) =>
    byKind("subscription").find((p) => p.caissonId === id)?.prices[0]
      ?.amountCents;
  assert.equal(
    subCents("compliance-updates"),
    149900,
    "compliance-updates = $1,499/yr",
  );
  assert.equal(subCents("developer"), 49900, "developer = $499/yr");

  out(
    "self-check OK — 31 products, money math pinned to the runbook §2.2 catalog.",
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  if (args.has("--self-check")) {
    selfCheck();
    return;
  }
  const plan = buildPlan();
  if (args.has("--execute")) {
    await execute(plan);
  } else {
    printPlan(plan);
  }
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    errOut(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
