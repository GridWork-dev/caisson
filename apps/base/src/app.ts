// The base reference app (P1) — the composition of the base packages, framework-agnostic. This
// object IS the wiring: a credit-gated operation (auth → tenancy → credits), a Stripe webhook that
// grants credits (billing → credits), and a buyer MCP query. The app framework per edition
// (Next/TanStack/Hono) is a deferred fork — the HTTP binding here is plain Bun.serve (server.ts).
import { withTenant, type Transactor } from "@stack/tenancy-rls";
import { balance, debit, grant, type CreditResult } from "@stack/credits";
import type { SessionContext } from "@stack/auth";
import { createMcpServer, type McpServerOptions } from "@stack/mcp-server";
import type { BillingProvider } from "@stack/billing";

export interface BaseAppDeps {
  db: Transactor;
  billing: BillingProvider;
  mcp: McpServerOptions;
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
  const mcp = createMcpServer(deps.mcp);
  return {
    spend(session, input) {
      return withTenant(deps.db, session.accountId, (tx) =>
        debit(tx, {
          accountId: session.accountId,
          amount: input.amount,
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
        const credits = Math.floor(event.amountTotal / 100); // cents → credits
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
