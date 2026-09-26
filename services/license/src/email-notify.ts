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
  type ResendQuota,
} from "@caisson/email";
import { createInMemoryAuditSink, deliverImmediate } from "@caisson/alerting";
import { type Transactor, withTenant } from "@caisson/tenancy-rls";
import { loadOpsAlertChannels } from "./alerting.ts";

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
      replyTo: "support@caisson.sh",
      onQuota: createQuotaCliffAlert(env),
    });
  }
  return createCaptureEmailer();
}

/**
 * Fire-once-per-window ops alert when Resend's remaining monthly quota drops under the cliff
 * (Kickoff T banner item 8a — Resend exposes NO usage API; the per-send response headers are the
 * only programmatic signal, and Resend's own built-in 80%/100% quota emails land in the operator
 * inbox as the second, zero-code layer). Threshold via RESEND_QUOTA_ALERT_REMAINING (remaining
 * sends; default 5000 ≈ 10% of the 50k tier; "0" disables). Same never-throws posture as every
 * other notify path here — an alert failure must never break the send that triggered it.
 * ponytail: in-memory once-per-6h-per-process rearm — a multi-instance deploy alerts once per
 * instance per window; shared-store dedupe only if that proves noisy.
 */
export function createQuotaCliffAlert(
  env: Record<string, string | undefined> = process.env,
): (quota: ResendQuota) => void {
  const raw = env.RESEND_QUOTA_ALERT_REMAINING?.trim() ?? "";
  const threshold = raw === "" ? 5000 : Number(raw);
  const REARM_MS = 6 * 60 * 60_000;
  let lastAlertAtMs = 0;
  return (quota: ResendQuota): void => {
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    const remaining = quota.monthlyRemaining;
    if (remaining === null || remaining > threshold) return;
    const now = Date.now();
    if (now - lastAlertAtMs < REARM_MS) return;
    lastAlertAtMs = now;
    void deliverImmediate(
      {
        id: crypto.randomUUID(),
        type: "email.quota_low",
        severity: "critical",
        tenantId: "operator",
        recipient: "operator",
        dedupeKey: "email.quota_low",
        title: "Resend monthly quota cliff",
        body: `Remaining monthly Resend quota is ${String(remaining)} sends (alert threshold ${String(threshold)}). Daily remaining: ${quota.dailyRemaining === null ? "n/a" : String(quota.dailyRemaining)}. Lifecycle + receipt email stops at 0 — bump the plan or throttle sends.`,
        createdAt: now,
      },
      loadOpsAlertChannels(env),
      createInMemoryAuditSink(),
    ).catch(() => {
      // Alerting must never break the send that triggered it.
    });
  };
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
  /**
   * ADR-0292 — the buyer's signed license token, when the post-commit webhook-push mint succeeded
   * for this delivery. Omitted (never sent) when the mint failed (logged separately as an operator
   * ALERT) — the receipt still sends either way; a missing token is recoverable on the buyer's next
   * dashboard visit, a missing receipt is not. Not a secret (see `license-grant-store.ts`): already
   * independently offline-verifiable via the public key.
   */
  licenseToken?: string;
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
        licenseToken: notice.licenseToken,
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

export interface RevokeEmailNotice {
  accountId: string;
  /** What triggered the revoke — selects the `access-revoked` template's copy. */
  reason: "subscription_canceled" | "refund";
}

/**
 * Fire the post-commit revoke/refund notice (G27, buyer-lifecycle audit 2026-07-07). Same
 * never-throws, detached contract as `notifyPurchaseEmail`/`notifyRenewalEmail` — a subscription
 * cancel or a refund revokes grants but neither ever fires a receipt, so this closes the "buyer
 * finds entitlements silently gone" gap. Fired only when `applyBillingEvent` reports an ACTUAL
 * revoke for this delivery (see `RevokeNotice`), never on a redelivery.
 */
export async function notifyRevokeEmail(
  db: Transactor,
  emailer: Emailer,
  notice: RevokeEmailNotice,
): Promise<void> {
  try {
    const buyer = await findBuyerEmail(db, notice.accountId);
    if (buyer === null) {
      process.stderr.write(
        `[service-license] revoke notice email skipped: no resolvable buyer address for account ${notice.accountId}\n`,
      );
      return;
    }
    await emailer.send({
      to: buyer.email,
      template: "access-revoked",
      data: {
        buyerName: buyer.name ?? buyer.email,
        reason: notice.reason,
        dashboardUrl: DASHBOARD_URL,
      },
    });
  } catch (err) {
    process.stderr.write(
      `[service-license] revoke notice email failed for account ${notice.accountId}: ${err instanceof Error ? err.message : String(err)}\n`,
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

// --- Abandoned-checkout email (SPEC outputs/specs/deferred-respec/SPEC-abandoned-checkout-email.md,
// operator-locked 2026-07-10) -----------------------------------------------------------------

export interface AbandonedCheckoutDiscount {
  /** A static Paddle discount code the operator creates out-of-band in the Paddle dashboard. */
  code: string;
  /** Human copy, e.g. "10% off". */
  label: string;
}

/**
 * Resolve the optional abandoned-checkout discount from env (operator lock, 2026-07-10): BOTH
 * `ABANDONED_CHECKOUT_DISCOUNT_CODE` and `ABANDONED_CHECKOUT_DISCOUNT_LABEL` must be set, or the
 * email renders with no discount block — no Paddle discount config exists yet, so this degrades
 * gracefully rather than failing closed. Same bare-optional-string shape as
 * `loadCreditExpiryScheduleConfig`/`loadDiscordNotifyConfig` — no Zod schema needed for a two-var
 * env read.
 */
export function resolveAbandonedCheckoutDiscount(
  env: Record<string, string | undefined> = process.env,
): AbandonedCheckoutDiscount | null {
  const code = env.ABANDONED_CHECKOUT_DISCOUNT_CODE?.trim();
  const label = env.ABANDONED_CHECKOUT_DISCOUNT_LABEL?.trim();
  if (code === undefined || code.length === 0) return null;
  if (label === undefined || label.length === 0) return null;
  return { code, label };
}

export interface AbandonedCheckoutEmailLine {
  label: string;
}

export interface AbandonedCheckoutNotice {
  accountId: string;
  lines: readonly AbandonedCheckoutEmailLine[];
}

/**
 * Fire the abandoned-checkout nudge email. NEVER throws — the SAME never-throw contract as
 * `notifyPurchaseEmail`. A missing buyer address is a log-and-drop, not an error. The discount
 * block (env-gated, `resolveAbandonedCheckoutDiscount`) is resolved fresh on every send so a
 * mid-flight env change (the operator wiring up a Paddle discount code) takes effect without a
 * redeploy of the caller.
 */
export async function notifyAbandonedCheckout(
  db: Transactor,
  emailer: Emailer,
  notice: AbandonedCheckoutNotice,
): Promise<void> {
  try {
    const buyer = await findBuyerEmail(db, notice.accountId);
    if (buyer === null) {
      process.stderr.write(
        `[service-license] abandoned checkout email skipped: no resolvable buyer address for account ${notice.accountId}\n`,
      );
      return;
    }
    const discount = resolveAbandonedCheckoutDiscount();
    const cartUrl = `${DASHBOARD_URL}/cart`;
    await emailer.send({
      to: buyer.email,
      template: "abandoned-checkout",
      data: {
        buyerName: buyer.name ?? buyer.email,
        lines: notice.lines.map((line) => ({ label: line.label })),
        url: cartUrl,
        ...(discount !== null
          ? {
              discountLabel: discount.label,
              discountUrl: `${cartUrl}?promo=${encodeURIComponent(discount.code)}`,
            }
          : {}),
      },
    });
  } catch (err) {
    process.stderr.write(
      `[service-license] abandoned checkout email failed for account ${notice.accountId}: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  }
}
