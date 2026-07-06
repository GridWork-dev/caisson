// Prove the buyer-MCP `generate` path DRIVES `runGeneration` (debit + audit row)
// end-to-end with run-and-read PGlite evidence. The MCP server validates + gates the selection, mints
// or reuses the idempotency key, then calls `onGenerate` which wires the REAL `runGeneration` inside
// `withTenant` — debit-before-spend (ADR-0007), idempotent dedup (ADR-0024), audit row.
//
// Assertions proved:
//   1. A generate call returns a `generationId` (UUID).
//   2. Credits were debited exactly once (balance delta).
//   3. A `generation` audit row exists for the account (post-debit, same scope).
//   4. A second call with the SAME idempotencyKey debits zero more, returns the SAME generationId,
//      and the audit row count stays at one.
//   5. An account with insufficient credits → InsufficientCreditsError; zero debit; no row.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type TestPg, newTestPg } from "@caisson/testing";
import { withTenant } from "@caisson/tenancy-rls";
import {
  CREDIT_ROUNDING_MIGRATION_SQL,
  CREDIT_SCHEMA_SQL,
  balance,
  debit,
  grant,
} from "@caisson/credits";
import { loadRegistryIndex } from "@caisson/registry";
import {
  GENERATION_SCHEMA_SQL,
  defaultEngine,
  runGeneration,
} from "@caisson/cli";
import { createMcpServer, type GenerateContext } from "@caisson/mcp-server";
import { InsufficientCreditsError, asCredits } from "@caisson/kernel";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BUYER_ACCOUNT = "acct_gen_buyer";
const BUYER_TOKEN = "mcp_tok_gen_buyer_x000000000000";
const BROKE_ACCOUNT = "acct_gen_broke";
const BROKE_TOKEN = "mcp_tok_gen_broke_x000000000000";
const INITIAL_CREDITS = 5;
// Fixed valid UUID v4 used as the idempotency key across the success path + retry (assertions 1-4).
const IDEM_KEY = "11111111-1111-4111-a111-111111111111";

// Minimal two-module index: both base modules, paid tier, no edition scope. The defaultEngine
// materializes a deterministic 3-file set (package.json + .npmrc + README.md) for any selection
// against these modules — no template files on disk required (stable across environments).
const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/auth",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          manifest: {
            id: "@caisson/auth",
            version: "0.1.0",
            kind: "base",
            tier: "paid",
            priceCents: 4900,
            license: "LicenseRef-Caisson-Commercial",
            description: "Auth fixture module for generate composition test.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
    {
      id: "@caisson/kernel",
      latest: "0.1.0",
      versions: [
        {
          version: "0.1.0",
          manifest: {
            id: "@caisson/kernel",
            version: "0.1.0",
            kind: "base",
            tier: "paid",
            priceCents: 2900,
            license: "LicenseRef-Caisson-Commercial",
            description: "Kernel fixture module for generate composition test.",
          },
          publishedAt: "2026-06-27T00:00:00.000Z",
          gateAttestation: "ci-fixture@0000000",
        },
      ],
    },
  ],
});

// One PGlite instance for the entire file. Both accounts (buyer + broke) are RLS-isolated by
// account_id so their assertions never bleed into each other.
let tp: TestPg;

beforeAll(async () => {
  tp = await newTestPg();
  await tp.exec(
    `DROP TABLE IF EXISTS credit_event; DROP TABLE IF EXISTS credit_wallet; DROP TABLE IF EXISTS generation;`,
  );
  await tp.exec(CREDIT_SCHEMA_SQL);
  await tp.exec(CREDIT_ROUNDING_MIGRATION_SQL);
  await tp.exec(GENERATION_SCHEMA_SQL);
  // Grant credits only to the buyer; the broke account intentionally stays at zero balance.
  await withTenant(tp.pg, BUYER_ACCOUNT, (tx) =>
    grant(tx, {
      accountId: BUYER_ACCOUNT,
      amount: asCredits(INITIAL_CREDITS),
      eventType: "purchase",
      sourceEventId: "buy-gen-composition-0",
    }),
  );
});

afterAll(async () => {
  await tp.close();
});

/** Generation row count for one account (superuser read — RLS bypassed, ground-truth assertion). */
const genCount = (accountId: string): Promise<number> =>
  tp
    .query<{ n: number }>(
      `SELECT count(*)::int AS n FROM generation WHERE account_id = $1`,
      [accountId],
    )
    .then((rows) => rows[0]?.n ?? 0);

/**
 * The real host-pattern onGenerate: withTenant + runGeneration in the SAME transaction. This is the
 * actual wiring the composition root uses — it proves (not mocks) that the MCP `generate` path
 * drives `runGeneration` (ADR-0049).
 */
function onGenerate(ctx: GenerateContext): Promise<{ generationId: string }> {
  return withTenant(tp.pg, ctx.accountId, async (tx) => {
    const out = await runGeneration(
      tx,
      // The host supplies the concrete credits debit through the DebitFn port (ADR-0249 G5).
      { index: INDEX, engine: defaultEngine, debit },
      ctx.selection,
      { accountId: ctx.accountId, idempotencyKey: ctx.idempotencyKey },
    );
    return { generationId: out.generationId };
  });
}

// ---------------------------------------------------------------------------

describe("P5 exit-gate-4: buyer-MCP generate → runGeneration (success + idempotency)", () => {
  // The server is constructed once at describe-evaluation time; the onGenerate closure captures
  // `tp` by reference, which is initialised by beforeAll before any test callback runs.
  const server = createMcpServer({
    tokens: [
      {
        token: BUYER_TOKEN,
        accountId: BUYER_ACCOUNT,
        // Direct @caisson/<slug> entitlements — expandEntitlements resolves them against the index.
        entitlements: ["@caisson/auth", "@caisson/kernel"],
      },
    ],
    index: INDEX,
    onGenerate,
  });

  // Assertions 1-4 are sequential and share a generationId, so they live in ONE test to avoid
  // cross-test mutable variable issues and to keep the narrative linear.
  test("assertions 1-4: debit + audit row + idempotent retry returns same generationId", async () => {
    const session = server.authenticate(BUYER_TOKEN);

    // ── First call ──────────────────────────────────────────────────────────
    const r1 = await server.handleToolCall(session, "generate", {
      projectName: "gen-test",
      modules: [{ id: "@caisson/auth", version: "0.1.0" }],
      idempotencyKey: IDEM_KEY,
    });

    // Assertion 1: generationId is returned and is a UUID (the newly inserted audit row id).
    const generationId1 = (r1 as { generationId: string }).generationId;
    expect(generationId1).toMatch(UUID_RE);

    // Assertion 2: exactly one credit debited.
    const bal1 = await withTenant(tp.pg, BUYER_ACCOUNT, (tx) =>
      balance(tx, BUYER_ACCOUNT),
    );
    expect(bal1).toBe(INITIAL_CREDITS - 1);

    // Assertion 3: exactly one generation audit row recorded (post-debit).
    expect(await genCount(BUYER_ACCOUNT)).toBe(1);

    // ── Idempotent retry (same idempotencyKey) ───────────────────────────────
    const r2 = await server.handleToolCall(session, "generate", {
      projectName: "gen-test",
      modules: [{ id: "@caisson/auth", version: "0.1.0" }],
      idempotencyKey: IDEM_KEY, // same key → debit-once dedup (ADR-0024)
    });

    const generationId2 = (r2 as { generationId: string }).generationId;

    // Assertion 4a: SAME generationId returned — the existing audit row id, not a new one.
    expect(generationId2).toBe(generationId1);

    // Assertion 4b: balance unchanged — zero additional debit on the retry.
    const bal2 = await withTenant(tp.pg, BUYER_ACCOUNT, (tx) =>
      balance(tx, BUYER_ACCOUNT),
    );
    expect(bal2).toBe(INITIAL_CREDITS - 1);

    // Assertion 4c: still exactly one generation row (ON CONFLICT dedup on idempotency key).
    expect(await genCount(BUYER_ACCOUNT)).toBe(1);
  });
});

describe("P5 exit-gate-4: buyer-MCP generate — insufficient credits (402 path)", () => {
  // Assertion 5: an account with zero credits → InsufficientCreditsError, nothing written.
  test("assertion 5: insufficient credits → throws, zero debit, no generation row", async () => {
    const server = createMcpServer({
      tokens: [
        {
          token: BROKE_TOKEN,
          accountId: BROKE_ACCOUNT,
          entitlements: ["@caisson/auth"],
        },
      ],
      index: INDEX,
      onGenerate,
    });

    const session = server.authenticate(BROKE_TOKEN);
    await expect(
      server.handleToolCall(session, "generate", {
        projectName: "broke-test",
        modules: [{ id: "@caisson/auth", version: "0.1.0" }],
        idempotencyKey: "22222222-2222-4222-a222-222222222222",
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    // No generation row was written — transaction aborted at the debit step.
    expect(await genCount(BROKE_ACCOUNT)).toBe(0);

    // Balance untouched (still 0).
    const bal = await withTenant(tp.pg, BROKE_ACCOUNT, (tx) =>
      balance(tx, BROKE_ACCOUNT),
    );
    expect(bal).toBe(0);
  });
});
