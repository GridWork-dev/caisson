// The post-purchase receipt email + the credit-expiry-notice emailer (extends ADR-0203/0252's
// driver-gated notification pattern to a THIRD channel). Three responsibilities:
//   • resolveEmailer(): construct the real `@caisson/email` transport — the Resend driver when
//     RESEND_API_KEY is set, the in-memory capture driver otherwise (mirrors
//     apps/site/lib/auth-server.ts's resolveEmailer exactly, so an unconfigured deploy never
//     crashes and never silently touches the network).
//   • findBuyerEmail(db, accountId): resolve the buyer's notification address the SAME way
//     discord-notify.ts resolves Discord identity — account_member (tenant-GUC RLS, personal-
//     account fallback: no membership row ⇒ account_id IS the user id) → better-auth's OWN "user"
//     table. That table (like discord-notify's "account" provider-link table) carries no RLS and
//     no `app`-role grant — it holds cross-tenant identity, not tenant data — so it is read on the
//     PLAIN connection role, outside `withTenant`, exactly like discord-notify's own read. The
//     account OWNER's address is preferred (the org billing contact); any member otherwise.
//   • notifyPurchaseEmail: the post-commit purchase-confirmation send, fired next to the Discord
//     push and the PostHog capture in app.ts's webhook handler. NEVER throws — the SAME never-throw
//     contract as `notifyDiscordGrant`: a failing or misconfigured emailer must never turn a
//     committed grant into a Paddle retry.
import {
  type CaptureEmailer,
  createCaptureEmailer,
  createResendEmailer,
  type Emailer,
} from "@caisson/email";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";

/** The buyer dashboard — license + registry access. Same hardcoded posture as deploy.ts's credit-
 *  expiry `dashboardUrl` (no dedicated env var for a single, stable, non-secret URL). */
const DASHBOARD_URL = "https://caisson.sh/dashboard";

/**
 * Resolve the transactional emailer from env: the Resend driver when `RESEND_API_KEY` is set, the
 * in-memory capture driver otherwise. Mirrors apps/site/lib/auth-server.ts's `resolveEmailer` —
 * same env vars, same default `from` address — so the two services never drift on transport choice.
 */
export function resolveEmailer(
  env: Record<string, string | undefined> = process.env,
): Emailer | CaptureEmailer {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (apiKey !== undefined && apiKey.length > 0) {
    return createResendEmailer({
      apiKey,
      from: env.RESEND_FROM?.trim() || "Caisson <no-reply@caisson.sh>",
    });
  }
  return createCaptureEmailer();
}

/**
 * The buyer account's notification user id: the account_member OWNER when membership rows exist
 * (the org billing-contact perk), the first member as a fallback, or the account id itself when no
 * membership row exists at all (the personal-account invariant, account_id == user_id — same
 * fallback `findDiscordUserIds` applies). Throws on DB errors — callers own the never-throw boundary.
 */
export async function findBuyerUserId(
  db: Transactor,
  accountId: string,
): Promise<string> {
  const members = await withTenant(db, accountId, async (tx) => {
    const r = await tx.query<{ user_id: string; role: string }>(
      "SELECT user_id, role FROM account_member WHERE account_id = $1 ORDER BY created_at",
      [accountId],
    );
    return r.rows;
  });
  if (members.length === 0) return accountId;
  return (
    members.find((m) => m.role === "owner")?.user_id ?? members[0]!.user_id
  );
}

export interface BuyerContact {
  email: string;
  name: string | null;
}

/**
 * Resolve the buyer's notification contact: the account's buyer user id (see `findBuyerUserId`)
 * joined against better-auth's own "user" table, read outside `withTenant` (see module doc — that
 * table carries no RLS, same posture as discord-notify's "account" read). `null` when the user row
 * cannot be found (e.g. better-auth tables absent in this environment). Throws on other DB errors —
 * callers own the never-throw boundary.
 */
export async function findBuyerEmail(
  db: Transactor,
  accountId: string,
): Promise<BuyerContact | null> {
  const userId = await findBuyerUserId(db, accountId);
  const rows = await db.transaction(async (tx) => {
    const r = await tx.query<{ email: string; name: string | null }>(
      `SELECT "email", "name" FROM "user" WHERE "id" = $1`,
      [userId],
    );
    return r.rows;
  });
  return rows[0] ?? null;
}

export interface PurchaseEmailLine {
  /** Canonical product/bundle slug charged on this line (`SkuLine.productSlug`). */
  productSlug: string;
}

/**
 * Receipt display label for a product slug / entitlement id — title-cased words, the same
 * rendering the dashboard's `UpdatesWindowCard` applies to these ids ("field-crypto" →
 * "Field Crypto", "ai-meter" → "AI Meter"). No canonical cross-package label map exists yet;
 * this humanizes the honest id, never invents a product name.
 */
function displayLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) =>
      w === "ai" || w === "ui"
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

export interface RenewalEmailLine {
  /** The renewed purchased entitlement id (`RenewedEntitlement.entitlementId`). */
  entitlementId: string;
  /** The new updates-window end, ISO instant (`RenewedEntitlement.newWindowEnd`) — formatted to a
   *  bare date (YYYY-MM-DD, the credits-expiring `expiresOn` convention) before it reaches the
   *  template. */
  newWindowEnd: string;
}

export interface PurchaseEmailNotice {
  accountId: string;
  /** The provider order/transaction id, for the receipt + support reference. */
  orderId: string;
  /** ISO currency code, e.g. "usd". */
  currency: string;
  /** Charged grand total, minor units (integer cents, ADR-0007). */
  amountTotalMinor: number;
  /**
   * Per-line purchase breakdown (labels only — `SkuLine` carries no per-line charged amount, so
   * the accurate total rides solely on `amountTotalMinor`; the template shows each line's label
   * alone). `[]` renders a receipt with the total only.
   */
  lines: readonly PurchaseEmailLine[];
  /**
   * `true` when this is a subscription-CYCLE charge (`invoice.paid` with
   * `billingReason: "subscription_cycle"` — a renewal cycle whose subscription already granted),
   * NOT a first purchase. Selects the `subscription-payment-received` recurring-payment receipt
   * over the first-buy `purchase-confirmation`. Same data shape either way. Defaults to a first
   * purchase when omitted.
   */
  subscriptionCycle?: boolean;
}

export interface RenewalEmailNotice {
  accountId: string;
  /** The provider order/transaction id, for the receipt + support reference. */
  orderId: string;
  /** ISO currency code, e.g. "usd". */
  currency: string;
  /** Charged grand total, minor units (integer cents, ADR-0007) — OMITTED on a mixed cart, where
   *  the purchase receipt already states the whole-event total (repeating it here would read as a
   *  second full charge). */
  amountTotalMinor?: number | undefined;
  /** Per-line renewed-entitlement breakdown. `[]` never fires (app.ts gates on non-empty). */
  lines: readonly RenewalEmailLine[];
}

/**
 * Fire the post-commit purchase-confirmation email. NEVER throws and never blocks the webhook
 * response path — the caller detaches it (`void`) after the grant transaction commits, the SAME
 * contract `notifyDiscordGrant` documents. A missing buyer address (no resolvable better-auth user)
 * is a log-and-drop, not an error.
 */
export async function notifyPurchaseEmail(
  db: Transactor,
  emailer: Emailer,
  notice: PurchaseEmailNotice,
): Promise<void> {
  try {
    const buyer = await findBuyerEmail(db, notice.accountId);
    if (buyer === null) {
      process.stderr.write(
        `[service-license] purchase confirmation email skipped: no resolvable buyer address for account ${notice.accountId}\n`,
      );
      return;
    }
    await emailer.send({
      to: buyer.email,
      // a subscription-cycle charge reads as a recurring-payment receipt, never the
      // first-purchase copy. Same data payload; only the template (heading/subject/body) differs.
      template: notice.subscriptionCycle
        ? "subscription-payment-received"
        : "purchase-confirmation",
      data: {
        buyerName: buyer.name ?? buyer.email,
        orderId: notice.orderId,
        currency: notice.currency,
        amountTotalMinor: notice.amountTotalMinor,
        lines: notice.lines.map((line) => ({
          label: displayLabel(line.productSlug),
        })),
        dashboardUrl: DASHBOARD_URL,
      },
    });
  } catch (err) {
    process.stderr.write(
      `[service-license] purchase confirmation email failed for account ${notice.accountId}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

/**
 * Fire the post-commit renewal-confirmation email (ADR-0251). Same never-throws, detached
 * contract as `notifyPurchaseEmail` — a renewal grants nothing, so it never fires the purchase
 * receipt; this is its own confirmation. `newWindowEnd` is trimmed from an ISO instant to a bare
 * date (YYYY-MM-DD) here, mirroring the `credits-expiry-scheduler.ts` `expiresOn` convention.
 */
export async function notifyRenewalEmail(
  db: Transactor,
  emailer: Emailer,
  notice: RenewalEmailNotice,
): Promise<void> {
  try {
    const buyer = await findBuyerEmail(db, notice.accountId);
    if (buyer === null) {
      process.stderr.write(
        `[service-license] renewal confirmation email skipped: no resolvable buyer address for account ${notice.accountId}\n`,
      );
      return;
    }
    await emailer.send({
      to: buyer.email,
      template: "renewal-confirmation",
      data: {
        buyerName: buyer.name ?? buyer.email,
        orderId: notice.orderId,
        currency: notice.currency,
        amountTotalMinor: notice.amountTotalMinor,
        lines: notice.lines.map((line) => ({
          label: displayLabel(line.entitlementId),
          newWindowEnd: line.newWindowEnd.slice(0, 10),
        })),
        dashboardUrl: DASHBOARD_URL,
      },
    });
  } catch (err) {
    process.stderr.write(
      `[service-license] renewal confirmation email failed for account ${notice.accountId}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}

/** Resolve a wired emailer's credit-expiry recipient — the same buyer-address resolution as the
 *  purchase confirmation, adapted to `credit-expiry-scheduler.ts`'s `recipientFor` shape (email or
 *  `null`, never throws — a resolution failure just skips the notice like an unconfigured emailer). */
export async function recipientFor(
  db: Transactor,
  accountId: string,
): Promise<string | null> {
  try {
    const buyer = await findBuyerEmail(db, accountId);
    return buyer?.email ?? null;
  } catch {
    return null;
  }
}
