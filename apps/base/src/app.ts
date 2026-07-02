// The base reference app (P1) — the composition of the base packages, framework-agnostic. This
// object IS the wiring: a credit-gated operation (auth → tenancy → credits), a Stripe webhook that
// grants credits (billing → credits), and a buyer MCP query. The app framework per edition
// (Next/TanStack/Hono) is a deferred fork — the HTTP binding here is plain Bun.serve (server.ts).
import { withTenant, type Transactor } from "@caisson/tenancy-rls";
import { asCredits } from "@caisson/kernel";
import { balance, debit, grant, type CreditResult } from "@caisson/credits";
import type { SessionContext } from "@caisson/auth";
import {
  createMcpServer,
  type McpServerOptions,
  type RateLimitHook,
} from "@caisson/mcp-server";
import { createRateLimitHook } from "@caisson/service-license";
import type { BillingProvider } from "@caisson/billing";

export interface BaseAppDeps {
  db: Transactor;
  billing: BillingProvider;
  mcp: McpServerOptions;
  /**
   * Telemetry sink for an MCP rate-limit store FAIL-OPEN event (ADR-0112 lock 5). The base
   * mcp-server ships DB-free and only declares the `checkRateLimit` PORT; this reference app — the
   * served composition that owns the `Transactor` — provisions the token-bucket-backed throttle hook
   * from `services/license` BY DEFAULT (see `createBaseApp`). When that store faults the hook fails
   * OPEN (allow + alert) so a paying buyer is never locked out by infra; the alert lands here. Wire
   * it to the observability surface — NEVER `console.log`. Omit only in tests (silent fail-open).
   */
  onRateLimitStoreError?: (err: unknown, accountId: string) => void;
}

export interface SpendInput {
  amount: number;
  idempotencyKey: string;
}

export interface BaseApp {
  /** Credit-gated work: debit before spend (402 if short), scoped by RLS. */
  spend(session: SessionContext, input: SpendInput): Promise<CreditResult>;
  balanceFor(session: SessionContext): Promise<number>;
  /** Verify a Stripe webhook and grant credits idempotently on a completed purchase. */
  handleStripeWebhook(
    rawBody: string,
    signature: string,
  ): Promise<{ handled: boolean; credits: number }>;
  /** Buyer MCP: authenticate the Bearer then dispatch the tool. */
  mcpQuery(bearer: string, tool: string, args: unknown): Promise<unknown>;
}

export function createBaseApp(deps: BaseAppDeps): BaseApp {
  // ADR-0112: throttle EVERY buyer-MCP tool dispatch BY DEFAULT. The base mcp-server declares the
  // `checkRateLimit` PORT but ships DB-free, so the served composition (this reference app, which is
  // the embedding buyer's wiring and owns the Transactor) provisions the token-bucket-backed hook
  // from `services/license`. An embedding buyer therefore gets per-account abuse throttling with no
  // extra wiring; a caller may still override by supplying its own `deps.mcp.checkRateLimit`. The
  // hook fails OPEN on a store fault (lock 5) and routes the alert to `onRateLimitStoreError`.
  const checkRateLimit: RateLimitHook =
    deps.mcp.checkRateLimit ??
    createRateLimitHook({
      db: deps.db,
      ...(deps.onRateLimitStoreError !== undefined
        ? { onStoreError: deps.onRateLimitStoreError }
        : {}),
    });
  const mcp = createMcpServer({ ...deps.mcp, checkRateLimit });
  return {
    spend(session, input) {
      return withTenant(deps.db, session.accountId, (tx) =>
        debit(tx, {
          accountId: session.accountId,
          // Mint the brand at this boundary (ADR-0206) — SpendInput.amount stays a plain integer.
          amount: asCredits(input.amount),
          eventType: "ai_feature_debit",
          idempotencyKey: input.idempotencyKey,
        }),
      );
    },

    balanceFor(session) {
      return withTenant(deps.db, session.accountId, (tx) =>
        balance(tx, session.accountId),
      );
    },

    async handleStripeWebhook(rawBody, signature) {
      const event = deps.billing.verifyAndParse(rawBody, signature);
      if (event?.type === "purchase.completed") {
        const credits = asCredits(Math.floor(event.amountTotal / 100)); // cents → credits
        await withTenant(deps.db, event.accountId, (tx) =>
          grant(tx, {
            accountId: event.accountId,
            amount: credits,
            eventType: "purchase",
            sourceEventId: event.sourceEventId,
          }),
        );
        return { handled: true, credits };
      }
      return { handled: false, credits: 0 };
    },

    mcpQuery(bearer, tool, args) {
      const session = mcp.authenticate(bearer);
      return mcp.handleToolCall(session, tool, args);
    },
  };
}
