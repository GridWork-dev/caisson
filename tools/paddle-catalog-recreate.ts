#!/usr/bin/env bun
/**
 * paddle-catalog-recreate — scripted, idempotent recreation of the Caisson catalog in Paddle.
 *
 * CAISSON-31 / launch-runbook §2.2. Paddle Sandbox and Production are separate catalogs with
 * separate ids — nothing carries over. This tool re-derives the ADR-0257/0258/0260 six-bundle
 * catalog from the display SOT and creates it in the target Paddle environment, replacing 36
 * manual dashboard clicks with a repeatable, re-runnable script.
 *
 * SOT: `apps/site/lib/pricing.ts` — the display sheet the runbook §2.2 names as authoritative,
 * carrying every committed amount (BUNDLE_PRICES · MODULE_PRICES · PLAN_PRICES) plus the ADR-0260
 * §5 flat-40%-X9 renewal formula (`renewalAmount`). Importing it means no dollar amount is ever
 * hand-typed here, so the tool's catalog cannot drift from the site (or the pricebook, which
 * `pricing.test.ts` pins the same numbers against). Money stays integer cents (ADR-0007).
 *
 * Catalog shape (matches the runbook §2.2 table): 6 bundles + 27 à-la-carte modules (one-time) +
 * 2 annual subscriptions (Compliance-Updates, Developer) + 1 "Updates Renewal" product carrying a
 * per-SKU one-time renewal price. Enterprise is a Contact-us anchor with no price — no product.
 * Every product gets tax_category "saas".
 *
 * Usage:
 *   bun tools/paddle-catalog-recreate.ts               # DRY-RUN: print the create plan, no API calls
 *   PADDLE_ENV=production PADDLE_API_KEY=pdl_live_... \
 *     bun tools/paddle-catalog-recreate.ts --execute \
 *       --export-map=outputs/executions/paddle-production-map.json
 *                                                    # create, verify, export marker → live-id map
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
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

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

export type ProductKind =
  "bundle" | "module" | "subscription" | "renewal-parent";

export interface PlanPrice {
  /** Stable marker written to the Paddle price's custom_data.caisson_key for idempotent re-lookup. */
  key: string;
  description: string;
  type: "standard";
  status: "active";
  /** Integer minor units (cents); money is never a float (ADR-0007). */
  amountCents: number;
  currencyCode: "USD";
  /** Present for a recurring price; omitted for a one-time price. */
  billingInterval?: "year";
  /** Present with billingInterval; Paddle bills every one interval. */
  billingFrequency?: 1;
}

export interface PlanProduct {
  /** Stable marker written to the Paddle product's custom_data.caisson_id for idempotent re-lookup. */
  caissonId: string;
  kind: ProductKind;
  name: string;
  type: "standard";
  status: "active";
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
export function buildPlan(): PlanProduct[] {
  const products: PlanProduct[] = [];

  // 6 bundles — one-time perpetual license.
  for (const b of BUNDLE_PRICES) {
    if (b.amount === null) continue; // no Contact-us bundle exists, but stay defensive
    products.push({
      caissonId: b.id,
      kind: "bundle",
      name: `Caisson — ${b.label}`,
      type: "standard",
      status: "active",
      taxCategory: "saas",
      prices: [
        {
          key: b.id,
          description: `${b.label} bundle — perpetual license`,
          type: "standard",
          status: "active",
          amountCents: toCents(b.amount),
          currencyCode: "USD",
        },
      ],
    });
  }

  // 27 à-la-carte modules — one-time perpetual license.
  for (const m of MODULE_PRICES) {
    products.push({
      caissonId: m.id,
      kind: "module",
      name: `Caisson module — ${m.label}`,
      type: "standard",
      status: "active",
      taxCategory: "saas",
      prices: [
        {
          key: m.id,
          description: `${m.label} module — perpetual license`,
          type: "standard",
          status: "active",
          amountCents: toCents(m.amount),
          currencyCode: "USD",
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
      type: "standard",
      status: "active",
      taxCategory: "saas",
      prices: [
        {
          key: p.id,
          description: `${p.label} — annual subscription`,
          type: "standard",
          status: "active",
          amountCents: toCents(p.amount),
          currencyCode: "USD",
          billingInterval: "year",
          billingFrequency: 1,
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
      type: "standard",
      status: "active",
      amountCents: toCents(usd),
      currencyCode: "USD",
    });
  }
  products.push({
    caissonId: "updates-renewal",
    kind: "renewal-parent",
    name: "Caisson — Updates Renewal",
    type: "standard",
    status: "active",
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
    throw new Error(
      "PADDLE_API_KEY is required for --execute or --export-map (fail-closed).",
    );
  }
  return key;
}

export interface PaddlePrice {
  id: string;
  product_id: string;
  description: string;
  type: "standard" | "custom";
  billing_cycle: {
    interval: "day" | "week" | "month" | "year";
    frequency: number;
  } | null;
  unit_price: {
    amount: string;
    currency_code: string;
  };
  custom_data: Record<string, unknown> | null;
  status: "active" | "archived";
}

export interface PaddleObject {
  id: string;
  name: string;
  type: "standard" | "custom";
  tax_category: string;
  custom_data: Record<string, unknown> | null;
  status: "active" | "archived";
  prices: PaddlePrice[];
}

const PaddleBillingCycleSchema = z
  .object({
    interval: z.enum(["day", "week", "month", "year"]),
    frequency: z.number().int().positive(),
  })
  .strict();

const PaddleUnitPriceSchema = z
  .object({
    amount: z.string().regex(/^\d+$/u),
    currency_code: z.string().regex(/^[A-Z]{3}$/u),
  })
  .strict();

const PaddleApiPriceSchema = z
  .object({
    id: z.string().min(1),
    product_id: z.string().min(1),
    description: z.string(),
    type: z.enum(["standard", "custom"]),
    name: z.string().nullable(),
    billing_cycle: PaddleBillingCycleSchema.nullable(),
    trial_period: z.unknown().nullable(),
    tax_mode: z.string(),
    unit_price: PaddleUnitPriceSchema,
    unit_price_overrides: z.array(z.unknown()),
    custom_data: z.record(z.string(), z.unknown()).nullable(),
    status: z.enum(["active", "archived"]),
    quantity: z
      .object({
        minimum: z.number().int().positive(),
        maximum: z.number().int().positive().nullable(),
      })
      .strict(),
    import_meta: z.unknown().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

const PaddleApiProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullable(),
    type: z.enum(["standard", "custom"]),
    tax_category: z.string(),
    image_url: z.string(),
    custom_data: z.record(z.string(), z.unknown()).nullable(),
    status: z.enum(["active", "archived"]),
    import_meta: z.unknown().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    prices: z.array(PaddleApiPriceSchema),
  })
  .strict();

const PaddleApiProductsSchema = z.array(PaddleApiProductSchema);

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

/** List every active product and strictly parse the included active/archived price entities. */
async function listExistingProducts(apiKey: string): Promise<PaddleObject[]> {
  const products: PaddleObject[] = [];
  let next: string | undefined =
    "/products?include=prices&per_page=100&status=active";
  while (next !== undefined) {
    const { data, meta } = await paddleRequest(apiKey, "GET", next);
    const parsed = PaddleApiProductsSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const location =
        issue === undefined ? "unknown field" : issue.path.join(".");
      throw new Error(
        `Paddle returned an invalid catalog snapshot at "${location}"`,
      );
    }
    products.push(
      ...parsed.data.map((product) => ({
        id: product.id,
        name: product.name,
        type: product.type,
        tax_category: product.tax_category,
        custom_data: product.custom_data,
        status: product.status,
        prices: product.prices.map((price) => ({
          id: price.id,
          product_id: price.product_id,
          description: price.description,
          type: price.type,
          billing_cycle: price.billing_cycle,
          unit_price: price.unit_price,
          custom_data: price.custom_data,
          status: price.status,
        })),
      })),
    );
    next = meta?.pagination?.has_more ? meta.pagination.next : undefined;
  }
  return products;
}

export interface CatalogMapping {
  readonly schemaVersion: 1;
  readonly environment: "production";
  readonly products: Readonly<Record<string, string>>;
  readonly prices: Readonly<Record<string, string>>;
}

interface ValidatedCatalog {
  readonly products: ReadonlyMap<string, PaddleObject>;
  readonly prices: ReadonlyMap<string, PaddlePrice>;
}

function mismatch(
  markerType: "product" | "price",
  marker: string,
  attribute: string,
  expected: unknown,
  actual: unknown,
): never {
  throw new Error(
    `${attribute} mismatch for ${markerType} marker "${marker}": expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function validateCatalog(
  plan: readonly PlanProduct[],
  snapshot: readonly PaddleObject[],
  requireComplete: boolean,
): ValidatedCatalog {
  const expectedProducts = new Map<string, PlanProduct>();
  const expectedPrices = new Map<
    string,
    { readonly ownerMarker: string; readonly price: PlanPrice }
  >();

  for (const product of plan) {
    if (expectedProducts.has(product.caissonId)) {
      throw new Error(
        `duplicate planned product marker "${product.caissonId}"`,
      );
    }
    expectedProducts.set(product.caissonId, product);
    for (const price of product.prices) {
      if (expectedPrices.has(price.key)) {
        throw new Error(`duplicate planned price marker "${price.key}"`);
      }
      if (!Number.isInteger(price.amountCents) || !(price.amountCents > 0)) {
        throw new Error(
          `invalid planned integer amount for price marker "${price.key}"`,
        );
      }
      if (
        (price.billingInterval === undefined) !==
        (price.billingFrequency === undefined)
      ) {
        throw new Error(
          `invalid planned billing cycle for price marker "${price.key}"`,
        );
      }
      expectedPrices.set(price.key, {
        ownerMarker: product.caissonId,
        price,
      });
    }
  }

  const activePriceCounts = new Map<string, number>();
  for (const product of snapshot) {
    for (const price of product.prices) {
      const marker = price.custom_data?.caisson_key;
      if (price.status !== "active" || typeof marker !== "string") continue;
      activePriceCounts.set(marker, (activePriceCounts.get(marker) ?? 0) + 1);
    }
  }
  for (const [marker, count] of activePriceCounts) {
    if (count > 1) {
      throw new Error(
        `duplicate active price marker "${marker}" in Paddle (${count} prices)`,
      );
    }
  }

  const products = new Map<string, PaddleObject>();
  const prices = new Map<string, PaddlePrice>();
  for (const product of snapshot) {
    const productMarker = product.custom_data?.caisson_id;
    const isMarkedProduct = typeof productMarker === "string";
    if (isMarkedProduct) {
      const plannedProduct = expectedProducts.get(productMarker);
      if (!plannedProduct) {
        throw new Error(
          `unexpected product marker "${productMarker}" in Paddle`,
        );
      }
      if (products.has(productMarker)) {
        throw new Error(
          `duplicate active product marker "${productMarker}" in Paddle`,
        );
      }
      if (product.id.length === 0) {
        throw new Error(`empty product id for marker "${productMarker}"`);
      }
      if (product.status !== plannedProduct.status) {
        mismatch(
          "product",
          productMarker,
          "status",
          plannedProduct.status,
          product.status,
        );
      }
      if (product.name !== plannedProduct.name) {
        mismatch(
          "product",
          productMarker,
          "name",
          plannedProduct.name,
          product.name,
        );
      }
      if (product.type !== plannedProduct.type) {
        mismatch(
          "product",
          productMarker,
          "type",
          plannedProduct.type,
          product.type,
        );
      }
      if (product.tax_category !== plannedProduct.taxCategory) {
        mismatch(
          "product",
          productMarker,
          "tax category",
          plannedProduct.taxCategory,
          product.tax_category,
        );
      }
      const actualKind = product.custom_data?.caisson_kind;
      if (actualKind !== plannedProduct.kind) {
        mismatch(
          "product",
          productMarker,
          "kind",
          plannedProduct.kind,
          actualKind,
        );
      }
      products.set(productMarker, product);
    }

    for (const price of product.prices) {
      if (price.status !== "active") continue;
      const priceMarker = price.custom_data?.caisson_key;
      if (typeof priceMarker !== "string") {
        if (isMarkedProduct) {
          throw new Error(
            `unmarked active price "${price.id}" on product "${productMarker}"`,
          );
        }
        continue;
      }
      const expected = expectedPrices.get(priceMarker);
      if (!expected) {
        throw new Error(
          `unexpected active price marker "${priceMarker}" in Paddle`,
        );
      }
      if (
        productMarker !== expected.ownerMarker ||
        price.product_id !== product.id
      ) {
        mismatch(
          "price",
          priceMarker,
          "owning product",
          expected.ownerMarker,
          typeof productMarker === "string"
            ? `${productMarker} (${price.product_id})`
            : `unmarked (${price.product_id})`,
        );
      }
      if (price.id.length === 0) {
        throw new Error(`empty price id for marker "${priceMarker}"`);
      }
      if (price.description !== expected.price.description) {
        mismatch(
          "price",
          priceMarker,
          "description",
          expected.price.description,
          price.description,
        );
      }
      if (price.type !== expected.price.type) {
        mismatch("price", priceMarker, "type", expected.price.type, price.type);
      }
      if (price.status !== expected.price.status) {
        mismatch(
          "price",
          priceMarker,
          "status",
          expected.price.status,
          price.status,
        );
      }
      const expectedAmount = String(expected.price.amountCents);
      if (price.unit_price.amount !== expectedAmount) {
        mismatch(
          "price",
          priceMarker,
          "amount",
          expectedAmount,
          price.unit_price.amount,
        );
      }
      if (price.unit_price.currency_code !== expected.price.currencyCode) {
        mismatch(
          "price",
          priceMarker,
          "currency",
          expected.price.currencyCode,
          price.unit_price.currency_code,
        );
      }
      const expectedBillingCycle =
        expected.price.billingInterval === undefined
          ? null
          : {
              interval: expected.price.billingInterval,
              frequency: expected.price.billingFrequency,
            };
      if (
        price.billing_cycle?.interval !== expectedBillingCycle?.interval ||
        price.billing_cycle?.frequency !== expectedBillingCycle?.frequency
      ) {
        mismatch(
          "price",
          priceMarker,
          "billing cycle",
          expectedBillingCycle,
          price.billing_cycle,
        );
      }
      prices.set(priceMarker, price);
    }
  }

  if (requireComplete) {
    for (const marker of expectedProducts.keys()) {
      if (!products.has(marker)) {
        throw new Error(`missing active product marker "${marker}" in Paddle`);
      }
    }
    for (const marker of expectedPrices.keys()) {
      if (!prices.has(marker)) {
        throw new Error(`missing active price marker "${marker}" in Paddle`);
      }
    }
  }
  return { products, prices };
}

/**
 * Validate a Paddle snapshot against the complete desired plan and return the stable marker → id
 * mapping used for production wiring. Unmarked non-Caisson products are ignored; once a product
 * carries `caisson_id`, its product and every active price must match the plan exactly.
 */
export function buildCatalogMapping(
  plan: readonly PlanProduct[],
  snapshot: readonly PaddleObject[],
): CatalogMapping {
  const validated = validateCatalog(plan, snapshot, true);
  const sortedProducts = [...validated.products].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const sortedPrices = [...validated.prices].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return {
    schemaVersion: 1,
    environment: "production",
    products: Object.fromEntries(
      sortedProducts.map(([marker, product]) => [marker, product.id]),
    ),
    prices: Object.fromEntries(
      sortedPrices.map(([marker, price]) => [marker, price.id]),
    ),
  };
}

/** Resolve an operator-supplied export path without allowing writes outside the current checkout. */
export function resolveExportPath(
  requestedPath: string,
  cwd: string = process.cwd(),
): string {
  if (requestedPath.includes("\u0000")) {
    throw new Error("export path must not contain a null byte");
  }
  if (path.isAbsolute(requestedPath)) {
    throw new Error("export path must be relative to the current checkout");
  }
  if (requestedPath.split(/[\\/]/u).includes("..")) {
    throw new Error("export path must not contain traversal segments");
  }
  if (!requestedPath.endsWith(".json")) {
    throw new Error("export path must end in .json");
  }
  const root = path.resolve(cwd);
  const resolved = path.resolve(root, requestedPath);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("export path must stay inside the current checkout");
  }
  return resolved;
}

async function createProduct(
  apiKey: string,
  prod: PlanProduct,
): Promise<string> {
  const { data } = await paddleRequest(apiKey, "POST", "/products", {
    name: prod.name,
    tax_category: prod.taxCategory,
    type: prod.type,
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
    type: price.type,
    unit_price: {
      amount: String(price.amountCents),
      currency_code: price.currencyCode,
    },
    ...(price.billingInterval
      ? {
          billing_cycle: {
            interval: price.billingInterval,
            frequency: price.billingFrequency,
          },
        }
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
  const existing = validateCatalog(
    plan,
    await listExistingProducts(apiKey),
    false,
  );
  let createdProducts = 0;
  let createdPrices = 0;
  for (const prod of plan) {
    const found = existing.products.get(prod.caissonId);
    let productId: string;
    if (found) {
      productId = found.id;
      out(`skip product   ${prod.caissonId} (${productId})`);
    } else {
      productId = await createProduct(apiKey, prod);
      createdProducts += 1;
      out(`create product ${prod.caissonId} (${productId})`);
    }
    for (const price of prod.prices) {
      if (existing.prices.has(price.key)) {
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

async function exportCatalogMapping(
  plan: readonly PlanProduct[],
  requestedPath: string,
): Promise<void> {
  if (paddleEnv() !== "production") {
    throw new Error(
      "--export-map is production-only; set PADDLE_ENV=production explicitly",
    );
  }
  const apiKey = requireApiKey();
  const mapping = buildCatalogMapping(plan, await listExistingProducts(apiKey));
  const exportPath = resolveExportPath(requestedPath);
  await mkdir(path.dirname(exportPath), { recursive: true });
  await writeFile(exportPath, `${JSON.stringify(mapping, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  out(
    `Verified production mapping written (${Object.keys(mapping.products).length} products, ${Object.keys(mapping.prices).length} prices): ${path.relative(process.cwd(), exportPath)}`,
  );
}

/** Assert the plan shape + money math (the one runnable check). */
function selfCheck(): void {
  const plan = buildPlan();
  const byKind = (k: ProductKind) => plan.filter((p) => p.kind === k);
  assert.equal(byKind("bundle").length, 6, "expected 6 bundles");
  // 27 = the 22 of the sandbox big-bang era + agent-trajectory + the compliance-gap trio +
  // oscal-spine (2026-07-25).
  assert.equal(byKind("module").length, 27, "expected 27 modules");
  assert.equal(byKind("subscription").length, 2, "expected 2 subscriptions");
  assert.equal(
    byKind("renewal-parent").length,
    1,
    "expected 1 renewal product",
  );
  assert.equal(plan.length, 36, "expected 36 products total");
  assert.equal(
    plan.reduce((count, product) => count + product.prices.length, 0),
    68,
    "expected 68 prices total",
  );

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
  assert.equal(bundleCents("compliance"), 164900, "compliance = $1,649.00");
  assert.equal(bundleCents("everything"), 225900, "everything = $2,259.00");

  const renewalCents = (id: string) =>
    byKind("renewal-parent")[0]?.prices.find((pr) => pr.key === `renew:${id}`)
      ?.amountCents;
  // ADR-0260 §5 flat-40%-X9 renewal ladder: the locked bundle reprices derive to $659 and $899.
  assert.equal(renewalCents("compliance"), 65900, "compliance renewal = $659");
  assert.equal(renewalCents("everything"), 89900, "everything renewal = $899");
  assert.equal(renewalCents("oscal-spine"), 9900, "oscal-spine renewal = $99");
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
    "self-check OK — 36 products, 68 prices, money math pinned to the runbook §2.2 catalog.",
  );
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const exportArgs = argv.filter((arg) => arg.startsWith("--export-map="));
  if (exportArgs.length > 1) {
    throw new Error("--export-map may be provided only once");
  }
  const exportPath = exportArgs[0]?.slice("--export-map=".length);
  if (exportArgs.length === 1 && exportPath?.length === 0) {
    throw new Error("--export-map requires a relative .json path");
  }
  const knownArgs = new Set([
    "--execute",
    "--self-check",
    ...(exportArgs.length === 1 ? [exportArgs[0] as string] : []),
  ]);
  const unknown = argv.filter((arg) => !knownArgs.has(arg));
  if (unknown.length > 0) {
    throw new Error(`unknown argument(s): ${unknown.join(", ")}`);
  }
  if (args.has("--self-check")) {
    if (args.has("--execute") || exportPath !== undefined) {
      throw new Error(
        "--self-check cannot be combined with execution or export",
      );
    }
    selfCheck();
    return;
  }
  const plan = buildPlan();
  if (args.has("--execute")) {
    await execute(plan);
  } else {
    printPlan(plan);
  }
  if (exportPath !== undefined) {
    await exportCatalogMapping(plan, exportPath);
  }
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    errOut(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
