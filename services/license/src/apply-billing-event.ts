// The billing-event -> grant/revoke mapper (ADR-0089/0071/0109), the locked home for billing
// orchestration (ADR-0017: @caisson/billing only verifies+parses; the event->effect
// logic lives here). Runs inside withTenant (the caller scopes RLS to the buyer's account, one
// transaction). It does FOUR things by event type:
//   - invoice.paid (gated)      -> grant the cycle credits + the plan's SUBSCRIPTION entitlement grants
//   - purchase.completed        -> grant a ONE-TIME purchase's credits + its one_time entitlement grants;
//                                  a RENEWAL_BOOK line instead EXTENDS the updates window (ADR-0251)
//   - subscription.canceled     -> IMMEDIATELY soft-revoke that subscription's entitlement grants
//   - refund.completed          -> soft-revoke the purchase's grants + claw back ONLY unspent credits
// Fail-closed throughout: an unknown plan/purchase price throws (the webhook returns non-2xx, the
// provider retries) — never a guessed grant. Idempotent: the credit ledger keys on the source id; entitlement
// grants key per-source; the refund latches on the active->revoked transition so a re-delivery is inert.
import type { DomainBillingEvent } from "@caisson/billing";
import { withIdempotentSideEffect } from "@caisson/billing-orchestration";
import {
  clawback,
  grant,
  lineCreditLedger,
  outstandingClaw,
} from "@caisson/credits";
import { ConfigError, asCredits, type Credits } from "@caisson/kernel";
import {
  isRenewalPrice,
  renewalYears,
  resolvePlan,
  resolvePurchase,
  resolveRenewal,
} from "@caisson/pricebook";
import {
  entitlementIdAliasGroup,
  normalizeEntitlementId,
} from "@caisson/registry-schema";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import type { ChargebackAlert } from "./chargeback-notify.ts";
import {
  acquireAccountBillingLock,
  countActivePurchaseGrants,
  computeUpdatesWindows,
  extendUpdatesWindow,
  grantEntitlements,
  grantOwnedCoverageMirrors,
  reconcileCoverageGrants,
  recordLineRefund,
  reverseRenewalExtensions,
  revokePurchaseGrants,
  revokePurchaseLineGrants,
  revokeSubscriptionGrants,
  rollbackSubscriptionCoverageHorizon,
  upsertSubscriptionGrants,
} from "./entitlement-store.ts";
import type { SkuLine } from "./posthog-capture.ts";
// ADR-0293 — the G13 subscription-status signal + the G26 order/invoice ledger, both written
// alongside the existing grants in this same withTenant transaction.
import {
  cancelSubscriptionStatus,
  insertOrderRecord,
  readSubscriptionStatus,
  refundOrderRecord,
  refundSubscriptionOrderRecord,
  upsertSubscriptionStatus,
} from "./subscription-history-store.ts";

/**
 * Integer proportional credit claw for a dollar-PARTIAL line refund (ADR-0218 fork A-1 / ADR-0007 /
 * ADR-0212): `floor(granted * refunded / charged)`, rounded DOWN so a rounding remainder favors the
 * buyer (never over-claw), mirroring the pricebook's round-down grant ethos. BigInt throughout — no
 * float ever materializes. Returns the branded credits + the `{raw, mode}` provenance the clawback
 * ledger row persists (`raw` = the refunded minor units that drove this claw). Caller guarantees
 * `charged > 0`.
 */
function proportionalClaw(
  granted: number,
  refunded: number,
  charged: number,
): {
  credits: Credits;
  rounding: { raw: number; mode: "down"; result: Credits };
} {
  const result = Number((BigInt(granted) * BigInt(refunded)) / BigInt(charged));
  const credits = asCredits(result);
  return {
    credits,
    rounding: { raw: refunded, mode: "down", result: credits },
  };
}

// Only these two billing reasons grant: the first charge and each renewal. `subscription_update`
// (proration on upgrade) grants nothing by default (ADR-0089 §6, SD-1) — the next cycle invoice grants
// the new plan's full allotment, avoiding a double-grant. Any other reason (manual, etc.) grants nothing.
const GRANTING_REASONS = new Set(["subscription_create", "subscription_cycle"]);

export interface RenewedEntitlement {
  /** The purchased entitlement id (RENEWAL_BOOK `renewsEntitlement`) whose updates window this
   *  event's renewal line extended. */
  entitlementId: string;
  /** The POST-extension updates-window end, ISO instant (DB truth via `computeUpdatesWindows`,
   *  never recomputed from the extension formula — one source of truth for the bound). */
  newWindowEnd: string;
}

export interface AppliedBillingEffect {
  /**
   * The purchased entitlement ids THIS event application granted (`[]` when nothing granted —
   * a gated/no-op event, a revoke, or a refund). Feeds the post-commit Discord role push
   * (ADR-0203); computed HERE so the push can never drift from the grant gate's own decision.
   */
  grantedEntitlements: string[];
  /**
   * Per-line SKU attribution for THIS event's grant: the provider price id + the
   * CANONICAL catalog slug (bundle-normalized) actually resolved during the grant, feeding the
   * post-commit PostHog `purchase` capture's cart-composition breakdown. `[]` for a non-granting
   * effect (a gated cycle, a revoke, a refund) or a pure-renewal line (which grants nothing).
   */
  skuLines: SkuLine[];
  /**
   * The entitlements THIS event's renewal line(s) extended the updates window for (`[]` for any
   * non-purchase event, or a purchase with no renewal line) — surfacing only, feeding the
   * post-commit renewal-confirmation email. A renewal grants nothing, so it never appears in
   * `grantedEntitlements`; this is the renewal's own signal, computed from DB truth AFTER
   * `extendUpdatesWindow` committed (same tx), never by re-deriving the extension formula here.
   */
  renewedEntitlements: RenewedEntitlement[];
  /**
   * ADR-0294 — chargeback/dispute alerts surfaced by THIS event (`[]` for every event but
   * `chargeback.detected`, which is ALERT-ONLY: it grants/revokes/claws nothing, so it carries no
   * entry in any of the three fields above). Threaded the same way `renewedEntitlements` is, so
   * the post-commit push in app.ts can never drift from this mapper's own decision.
   */
  chargebackAlerts: ChargebackAlert[];
  /**
   * G27 (audit 2026-07-07) — buyer-facing revoke notices for THIS event: a subscription cancel or
   * a refund that ACTUALLY revoked at least one active grant (idempotent by construction — a
   * re-delivery or a Resend revokes nothing further, since `revokeSubscriptionGrants`/
   * `revokePurchaseGrants`/`revokePurchaseLineGrants` only flip ACTIVE rows, so this list is
   * empty on any redelivery without a separate idempotency gate). `[]` for every granting event.
   */
  revokeNotices: RevokeNotice[];
}

/** One buyer-facing "your access changed" notice (G27). `reason` selects the email copy. */
export interface RevokeNotice {
  accountId: string;
  reason: "subscription_canceled" | "refund";
}

const NO_EFFECT: AppliedBillingEffect = {
  grantedEntitlements: [],
  skuLines: [],
  renewedEntitlements: [],
  chargebackAlerts: [],
  revokeNotices: [],
};

/**
 * Apply a verified domain billing event (ADR-0089/0071/0109). See the file header for the per-type
 * effect map. Every effect runs inside the caller's `withTenant` transaction, so the credit move and
 * the entitlement grant/revoke commit or roll back together, RLS-scoped to the buyer.
 */
export async function applyBillingEvent(
  tx: TenantExecutor,
  ev: DomainBillingEvent,
): Promise<AppliedBillingEffect> {
  switch (ev.type) {
    case "invoice.paid": {
      if (!GRANTING_REASONS.has(ev.billingReason)) return NO_EFFECT;
      if (ev.invoiceId === "") {
        // The invoice id IS the idempotency anchor (ADR-0089 §4); an empty one would let two cycles
        // collide on ("", "sub_allotment") and silently under-grant. Fail closed — never grant on a
        // degenerate anchor (the webhook returns non-2xx, the provider retries).
        throw new ConfigError("invoice.paid is missing an invoice id");
      }
      const plan = resolvePlan(ev.priceId); // fail-closed on an unknown price id
      // Canonical lock order (see acquireAccountBillingLock): the account billing lock comes
      // BEFORE the wallet-row grant below — a whole-transaction refund holds this lock while
      // waiting on the wallet row; granting first here would complete that ABBA cycle.
      await acquireAccountBillingLock(tx, ev.accountId);
      // G7 (audit 2026-07-07): gate the WHOLE grant — both the DB writes below AND the returned
      // effect — behind ONE per-invoice claim keyed on the STABLE `invoiceId`, not
      // `ev.sourceEventId` (the Paddle event_id). A dashboard "Resend" mints a FRESH event_id for
      // the SAME invoice, so the OUTER `processEvent` claim in webhook.ts (keyed on event_id)
      // waves it through as if new. The grant()/upsertSubscriptionGrants() calls already no-op
      // correctly at the DB layer on a resend (their own idempotency keys on `invoiceId`), but
      // this function used to rebuild `grantedEntitlements`/`skuLines` from the INPUT regardless —
      // so app.ts's Discord role push, PostHog capture, and purchase-confirmation email all fired
      // a second time for a delivery that granted nothing new. Wiring the already-built
      // `withIdempotentSideEffect` primitive here (rather than re-deriving "was this actually
      // fresh" from each call's own return value) closes it for every current and future notify
      // sink at once, and skips the redundant writes on a resend too.
      let effect: AppliedBillingEffect = NO_EFFECT;
      await withIdempotentSideEffect(tx, ev.invoiceId, "grant", async () => {
        // Grant-time liveness check (the static-grant ordering-race fix, with the cancel-side
        // tombstone in cancelSubscriptionStatus): a `subscription.canceled` processed BEFORE this
        // invoice (out-of-order delivery) leaves a canceled status row — and when no grant rows
        // existed yet, minting them NOW would create active grants no later event ever revokes
        // (the cancel already ran; a redelivery revokes nothing new). So a canceled subscription's
        // late invoice grants NO entitlements and NO coverage mirrors. The CREDITS still grant:
        // the payment really happened, credits are a bounded paid-for allotment, and a refund of
        // this same payment claws them by this invoice id. Serialization with a racing cancel is
        // the account billing lock above (both paths take it first).
        const lifecycle = await readSubscriptionStatus(
          tx,
          ev.accountId,
          ev.subscriptionId,
        );
        const canceledBeforeGrant = lifecycle === "canceled";
        await grant(tx, {
          eventType: "sub_allotment",
          accountId: ev.accountId,
          amount: plan.creditsPerCycle, // exact table integer — no conversion (ADR-0089 §5)
          sourceEventId: ev.invoiceId, // cycle-stable idempotency anchor (ADR-0089 §4)
        });
        // Grant the plan's edition/bundle/module entitlements as SUBSCRIPTION grants (ADR-0071/0109),
        // keyed on the subscription id so a later subscription.canceled revokes exactly these. Each
        // granting invoice stamps/EXTENDS the row's coverage horizon (`updates_expires_at = now() +
        // one cadence` — the instant this payment covers through), so every claim bound the issuer
        // derives from a subscription grant lapses with the LAST PAID period rather than living
        // forever in a stale token (audit hardening 2026-07-06). Idempotent per (account,
        // entitlement, subscription). A credits-only plan carries `entitlements: []` → no-op.
        if (!canceledBeforeGrant) {
          await upsertSubscriptionGrants(tx, {
            accountId: ev.accountId,
            entitlementIds: plan.entitlements,
            subscriptionId: ev.subscriptionId,
            sourceEventId: ev.invoiceId,
            cadence: plan.cadence,
          });
        }
        // ADR-0293 G13/G14: the uniform subscription-status signal (see subscription-history-store.ts
        // header) — written for EVERY subscription plan, not just zero-entitlement ones, so it is the
        // one place the dashboard reads both "is this zero-entitlement plan owned" and "which Paddle
        // subscription id backs this price id, to cancel it". Runs INSIDE the G7 idempotency gate
        // (unlike the invoice-scoped grant calls above it never had its own natural dedupe key), so a
        // Resend's fresh event_id no longer refreshes this row for free either.
        // A canceled tombstone is never resurrected to 'active' by a late invoice either.
        if (!canceledBeforeGrant) {
          await upsertSubscriptionStatus(tx, {
            accountId: ev.accountId,
            subscriptionId: ev.subscriptionId,
            priceId: ev.priceId,
            planTag: plan.planTag,
          });
        }
        // ADR-0293 G26: one order-history row per granting invoice — the SAME resend protection.
        // The row carries its backing subscription id (the refund claw's unambiguous rollback
        // target — never re-derived by price, which two subscriptions of one account can share
        // across a cancel + re-subscribe) and whether this invoice actually stamped a coverage
        // horizon (a canceled-before-grant invoice grants credits only; a refund of it must roll
        // back nothing).
        await insertOrderRecord(tx, {
          accountId: ev.accountId,
          sourceEventId: ev.invoiceId,
          kind: "subscription",
          priceId: ev.priceId,
          label: plan.planTag,
          amount: ev.amountTotal,
          currency: ev.currency,
          subscriptionId: ev.subscriptionId,
          coverageStamped: !canceledBeforeGrant,
          // ADR-0315: attribute this cycle invoice to the affiliate whose discount it redeemed.
          discountId: ev.discountId ?? null,
        });
        // ADR-0269: a `coversOwnedEntitlements` plan (Developer) RE-GRANTS, subscription-sourced,
        // every entitlement the buyer already holds via an active one_time grant — the
        // Compliance-Updates re-grant mirror made dynamic. While these MIRROR rows (marked
        // `line_item_id='covered'`) are active with a live horizon, the issuer EXTENDS the pair's
        // `updatesWindows`/`entitledSince` bounds to the horizon (ADR-0269 Decision 2, hardened);
        // `subscription.canceled` revokes exactly these rows, a refund's reconcile sweeps a mirror
        // whose one_time backing is gone, and the one_time gates re-bind at the next re-mint. Ids
        // bought MID-cycle join at the next granting invoice (the upsert is idempotent per
        // (account, id, subscription, 'covered')). Read AFTER the static grant above so a plan that
        // one day carries both shapes can never miss its own grants; one_time reads are unaffected
        // by it today (Developer grants []). Routed through `grantOwnedCoverageMirrors`, which
        // shares its advisory lock with `reconcileCoverageGrants`'s refund sweep — a
        // concurrent refund for this account can never interleave between the "owned" read and the
        // mirror write, so a mirror can never be minted for an id whose one_time backing a racing
        // refund just revoked.
        const coveredIds =
          !canceledBeforeGrant && plan.coversOwnedEntitlements
            ? await grantOwnedCoverageMirrors(tx, {
                accountId: ev.accountId,
                subscriptionId: ev.subscriptionId,
                sourceEventId: ev.invoiceId,
                cadence: plan.cadence,
              })
            : [];
        effect = {
          // A canceled-before-grant invoice granted nothing — no Discord/PostHog/email push fires.
          grantedEntitlements: canceledBeforeGrant
            ? []
            : [...new Set([...plan.entitlements, ...coveredIds])],
          skuLines: [
            {
              priceId: ev.priceId,
              productSlug: normalizeEntitlementId(plan.planTag),
            },
          ],
          renewedEntitlements: [], // a subscription cycle never carries a renewal-book line
          chargebackAlerts: [],
          revokeNotices: [],
        };
      });
      return effect;
    }
    case "purchase.completed": {
      // A one-time (non-subscription) edition/module/credit-pack buy (ADR-0113). The PaymentIntent id
      // anchors BOTH the credit grant and the entitlement grant so a later charge.refunded can find +
      // reverse them. Fail closed without it — a one-time grant we cannot later revoke must not land.
      if (ev.paymentId === "") {
        throw new ConfigError("purchase.completed is missing a payment id");
      }
      // Fulfill EVERY paid line (Strix vuln-0005: a multi-item cart is ONE transaction with N lines —
      // fulfilling only the first under-grants a cart the buyer paid for in full). resolvePurchase is
      // fail-closed per line: an unknown price id throws and rolls back the whole withTenant tx, so a
      // partial grant across items is impossible.
      //
      // Grants are now PER LINE (ADR-0218), each stamped with its `itemId` join key + charged amount:
      //   - credits: one `purchase` row per credit-bearing line (all keyed `paymentId`, disambiguated
      //     by `line_item_id` in the index) → a later per-line refund claws only that line's credits;
      //     the whole-transaction refund still sums them all by `paymentId` (creditsGrantedBySource).
      //   - entitlements: one grant row per (line, entitlement) → the same edition granted by two cart
      //     lines is two rows (fork B-1 refcount: survives until BOTH lines are refunded).
      // `grantedEntitlements` returns the DISTINCT union for the Discord push (an entitlement is binary).
      //
      // G7 (audit 2026-07-07): the WHOLE loop below — DB writes AND the returned effect — runs
      // behind ONE per-payment claim keyed on the STABLE `paymentId`, not `ev.sourceEventId` (see
      // the sibling comment on the invoice.paid case for the full rationale: a "Resend" mints a
      // fresh event_id for the same transaction, and the per-line grant()/grantEntitlements()/
      // extendUpdatesWindow() calls already no-op correctly at the DB layer on that resend — this
      // closes the SEPARATE bug where the returned effect used to be rebuilt regardless, double-
      // firing every notify sink). A bonus: `extendUpdatesWindow`'s own idempotency is documented
      // as relying on the caller's outer claim (its `renewal_extension` row is `ON CONFLICT DO
      // NOTHING`, but the window UPDATE beside it is NOT re-run-safe) — gating entry here at the
      // stable payment id, not the outer event id, is what makes that guarantee hold on a resend.
      let effect: AppliedBillingEffect = NO_EFFECT;
      await withIdempotentSideEffect(tx, ev.paymentId, "grant", async () => {
        const grantedEntitlements = new Set<string>();
        const skuLines: SkuLine[] = [];
        const renewedEntitlementIds = new Set<string>();
        for (const line of ev.lineItems) {
          // Updates-RENEWAL line (ADR-0244/0251): a renewal SKU grants NO entitlement and NO credits —
          // it EXTENDS the buyer's updates window on the entitlement it renews (+12 months per year of
          // tenor — renewalYears() reads the RENEWAL_BOOK row's multi-year lever, R6 rider, default 1
          // — per (account, entitlement) pair). extendUpdatesWindow is fail-closed: renewing an entitlement
          // with no active one_time grant throws → the webhook returns non-2xx and Paddle retries —
          // a renewal never silently mints a grant. A price id lives in exactly ONE book (pricebook
          // test), so this branch can never shadow a real purchase row. Renewal lines stay out of
          // `grantedEntitlements` — nothing was granted, so no Discord/PostHog push fires for them.
          if (isRenewalPrice(line.priceId)) {
            const renewal = resolveRenewal(line.priceId);
            await extendUpdatesWindow(tx, {
              accountId: ev.accountId,
              entitlementId: renewal.renewsEntitlement,
              sourceEventId: ev.paymentId,
              // Record the LINE so a per-line refund of this exact renewal can un-extend it
              // (ADR-0251 Consequences). A whole-transaction refund reverses by paymentId regardless.
              lineItemId: line.itemId,
              // Multi-year lever (R6 rider): a RENEWAL_BOOK row's `years` (default 1) extends the
              // window by `12 * years` months in one step (renewalYears() reads the "1" default).
              years: renewalYears(renewal),
            });
            renewedEntitlementIds.add(renewal.renewsEntitlement);
            continue;
          }
          const purchase = resolvePurchase(line.priceId); // fail-closed on an unknown price id
          // Canonical SKU line for the PostHog capture — the legacy purchase tag
          // (`ai-kit`, `bundle`, …) normalized to its bundle id (`ai-production`, `everything`, …).
          skuLines.push({
            priceId: line.priceId,
            productSlug: normalizeEntitlementId(purchase.purchaseTag),
          });
          const lineCredits = purchase.credits * line.quantity;
          if (lineCredits > 0) {
            await grant(tx, {
              eventType: "purchase",
              accountId: ev.accountId,
              // Mint at the boundary (ADR-0212): exact table-integer per-line credits, NULL rounding
              // provenance (ADR-0089 §5 — no rounding site on the grant path).
              amount: asCredits(lineCredits),
              sourceEventId: ev.paymentId, // whole-transaction refund sums all lines under this id
              lineItemId: line.itemId, // per-line refund claws just this line's credits
              lineChargedAmount: line.chargedAmount, // the proportional divisor for a dollar-partial claw
            });
          }
          // ADR-0381 lock 2: stamp what the buyer paid, but only when this line's charge belongs to
          // exactly ONE entitlement bought once — otherwise the line total is not a per-SKU price
          // and recording it would overstate a later upgrade credit. Leaving the column NULL is the
          // honest alternative: the quote reads NULL as "unknown" and credits at retail.
          //   - `quantity === 1`: a quantity-2 line charges twice for one BINARY entitlement, so
          //     its total is double the SKU's price.
          //   - `chargedAmount > 0`: a driver with no per-line data (Stripe) reports 0, which is
          //     "not reported", not "free".
          //   - `entitlements.length === 1`: defensive, not a live case — every PURCHASE_BOOK row
          //     today grants exactly one id (a BUNDLE is one id that expands to members downstream,
          //     not N ids here). It guards a future combo SKU that grants two ids off one charge,
          //     where splitting the total between them would be a guess.
          const attributable =
            purchase.entitlements.length === 1 &&
            line.quantity === 1 &&
            line.chargedAmount > 0;
          await grantEntitlements(tx, {
            accountId: ev.accountId,
            entitlementIds: purchase.entitlements,
            sourceEventId: ev.paymentId,
            source: { kind: "one_time", purchaseId: ev.paymentId },
            lineItemId: line.itemId,
            ...(attributable
              ? {
                  charged: {
                    amountMinorUnits: line.chargedAmount,
                    currency: ev.currency,
                  },
                }
              : {}),
          });
          for (const e of purchase.entitlements) grantedEntitlements.add(e);
        }
        // Read the renewed window(s) back from DB truth AFTER every line committed (one query for
        // the whole cart, not one per renewal line) — `computeUpdatesWindows` already takes the
        // MOST FAVORABLE bound per entitlement, so this is the SAME value the next /issue would sign.
        const renewedEntitlements: RenewedEntitlement[] = [];
        if (renewedEntitlementIds.size > 0) {
          const windows = await computeUpdatesWindows(tx, ev.accountId);
          for (const entitlementId of renewedEntitlementIds) {
            // `windows` keys by the RAW stored grant id, and a pre-catalog buyer's row stores the
            // legacy id (`ai-kit`, `bundle`, …) while RENEWAL_BOOK surfaces the canonical one — so
            // fold the alias group, most-favorable bound (ISO strings order lexicographically).
            let newWindowEnd: string | undefined;
            for (const key of entitlementIdAliasGroup(entitlementId)) {
              const bound = windows[key];
              if (
                bound !== undefined &&
                (newWindowEnd === undefined || bound > newWindowEnd)
              ) {
                newWindowEnd = bound;
              }
            }
            if (newWindowEnd !== undefined) {
              renewedEntitlements.push({ entitlementId, newWindowEnd });
            }
          }
        }
        // ADR-0293 G26: one order-history row for the whole cart transaction (never per-line — the
        // event's own `amountTotal` is the one true charged amount for this paymentId). `priceId` is
        // the single line's id when the cart had exactly one, else null (no one id represents a
        // multi-item cart); `label` prefers the granted SKUs, falling back to the renewed entitlement
        // ids for an all-renewal cart, and to a generic label for a pure credit-pack buy (0 lines in
        // either list). Runs INSIDE the G7 idempotency gate, so a Resend never writes a second row —
        // insertOrderRecord's own (source_event_id, kind) uniqueness would absorb it either way, but
        // gating here skips the redundant round trip and keeps ONE resend-protection story.
        const orderLabel =
          skuLines.length > 0
            ? skuLines.map((line) => line.productSlug).join(", ")
            : renewedEntitlementIds.size > 0
              ? `renewal: ${[...renewedEntitlementIds].join(", ")}`
              : "purchase";
        await insertOrderRecord(tx, {
          accountId: ev.accountId,
          sourceEventId: ev.paymentId,
          kind: "purchase",
          priceId: skuLines.length === 1 ? skuLines[0]!.priceId : null,
          label: orderLabel,
          amount: ev.amountTotal,
          currency: ev.currency,
          // ADR-0315: attribute this one-time purchase to the affiliate whose discount it redeemed.
          discountId: ev.discountId ?? null,
        });
        effect = {
          grantedEntitlements: [...grantedEntitlements],
          skuLines,
          renewedEntitlements,
          chargebackAlerts: [],
          revokeNotices: [],
        };
      });
      return effect;
    }
    case "subscription.canceled": {
      // Canonical lock order + coverage-mirror consistency: this revoke sweeps MIRROR rows too,
      // so it must serialize with a racing invoice.paid mint for the same account — without the
      // lock a mint interleaving past the sweep strands an active mirror until its horizon lapses.
      await acquireAccountBillingLock(tx, ev.accountId);
      // IMMEDIATE revoke (ADR-0113): soft-revoke every grant backed by this subscription. An entitlement
      // also held via an active one-time grant survives (refcount). Idempotent (only active grants flip).
      const revoked = await revokeSubscriptionGrants(tx, {
        accountId: ev.accountId,
        subscriptionId: ev.subscriptionId,
      });
      // ADR-0293 G13/G14: the subscription-status row this subscription's granting invoices upserted
      // (if any) flips to 'canceled' too — a no-op if this subscription never wrote one.
      await cancelSubscriptionStatus(tx, ev.accountId, ev.subscriptionId);
      // G27: a buyer-facing "your access changed" notice, ONLY when this call actually revoked
      // something — a re-delivery (or the coverage-mirror-only case where nothing was active)
      // revokes 0 and stays silent, no separate idempotency gate needed (see AppliedBillingEffect).
      return {
        ...NO_EFFECT,
        revokeNotices:
          revoked > 0
            ? [{ accountId: ev.accountId, reason: "subscription_canceled" }]
            : [],
      };
    }
    case "refund.completed": {
      // Refund of a one-time purchase (ADR-0113 whole-transaction / ADR-0218 per-line).
      if (ev.fullyRefunded) {
        // Canonical lock order: account billing lock FIRST, before the row revokes and the claw
        // lock below — this branch previously acquired coverage (inside the reconcile) and THEN
        // the claw lock, the reverse of the per-line branch, an ABBA deadlock under concurrent
        // delivery of a per-line adjustment for the same purchase.
        await acquireAccountBillingLock(tx, ev.accountId);
        // WHOLE-transaction full refund (Paddle `type:'full'` / Stripe `refunded:true`) — the locked
        // ADR-0113 scalar path, unchanged. (a) Soft-revoke ALL the purchase's entitlement grants
        // (idempotent — only active rows flip; a re-delivery finds none). (b) Claw ONLY the UNSPENT
        // credits it granted, bounded to the balance (never negative), summed across every line by the
        // payment id. Idempotent on the compensating debit's (paymentId, refund_clawback) unique key.
        const revoked = await revokePurchaseGrants(tx, {
          accountId: ev.accountId,
          purchaseId: ev.paymentId,
        });
        // ADR-0269 refund reconcile (audit P1 1): a coverage MIRROR whose one_time backing this
        // refund just revoked must fall with it — otherwise the refunded product stays fully
        // accessible subscription-sourced for the life of the covering plan.
        await reconcileCoverageGrants(tx, ev.accountId);
        // ADR-0251 renewal un-extend: if THIS refunded transaction was a renewal purchase, reverse
        // the updates-window extension(s) it granted (all lines — a whole-transaction full refund).
        // A refund of the original purchase (not a renewal) matches no ledger row → no-op.
        await reverseRenewalExtensions(tx, {
          accountId: ev.accountId,
          purchaseId: ev.paymentId,
        });
        // Bound to granted-minus-already-clawed, computed under `outstandingClaw`'s advisory lock: if any of this purchase's lines were already partially/fully clawed via the
        // ADR-0218 per-line path, clawing the full ORIGINAL granted amount here again would
        // over-claw — and since the wallet is a fungible pool, `clawback`'s own current-balance
        // bound would silently drain OTHER purchases' credits to cover it. The lock closes the
        // read-then-claw TOCTOU a plain re-derivation would leave open: a per-line adjustment racing
        // THIS whole-transaction refund (distinct sourceEventId keys, so the unique index alone
        // cannot dedupe them) now blocks until whichever lands first commits, so the second always
        // sees the first's already-committed claw.
        const remaining = await outstandingClaw(tx, ev.accountId, ev.paymentId);
        if (remaining > 0) {
          await clawback(tx, {
            accountId: ev.accountId,
            amount: remaining,
            sourceEventId: ev.paymentId,
          });
        }
        // ADR-0293 G26: the order-history row for this purchase flips to 'refunded' (a no-op if the
        // purchase predates this table, or a redelivery already flipped it).
        await refundOrderRecord(tx, ev.paymentId);
        // SUBSCRIPTION-payment refund → coverage-horizon claw-back. A refunded subscription
        // invoice used to leave the horizon it stamped fully live (grandfathered as a "paid fact"
        // that was just UN-paid) — unbounded value leakage into perpetual offline tokens. The
        // subscription ORDER row's paid→refunded flip is both the detector (only a subscription
        // invoice has one) and the idempotency latch (a redelivery flips nothing → rolls back
        // nothing). The flipped row itself names the rollback target: its `subscription_id`
        // (stamped at insert — never re-derived by price id, which two subscriptions of one
        // account can share across a cancel + re-subscribe) and its `coverage_stamped` bit (a
        // canceled-before-grant invoice granted credits only — a refund of it rolls back nothing,
        // or it would shrink coverage EARLIER un-refunded payments paid for). The row's price id
        // resolves the plan's cadence; one paid period is the claw amount; the target
        // subscription's horizon-stamped grant rows — static AND mirrors, any status — shrink by
        // that period. Access rows themselves are untouched: revoking a still-billing
        // subscription's grants stays the cancel event's job.
        const refundedSubscription = await refundSubscriptionOrderRecord(
          tx,
          ev.paymentId,
        );
        if (
          refundedSubscription !== null &&
          refundedSubscription.coverageStamped &&
          refundedSubscription.priceId !== null &&
          refundedSubscription.priceId !== ""
        ) {
          if (refundedSubscription.subscriptionId === null) {
            // A pre-link row (inserted before the subscription_id column existed): the backing
            // subscription cannot be resolved unambiguously — by-price re-derivation is exactly
            // the wrong-subscription defect the column fixed. Logged, never thrown: failing the
            // whole refund over the cosmetic rollback would block the credit claw.
            process.stderr.write(
              `[service-license] subscription refund ${ev.paymentId}: order row carries no subscription id (pre-link row) — horizon rollback skipped\n`,
            );
          } else {
            let cadence: "month" | "year" | null = null;
            try {
              cadence = resolvePlan(refundedSubscription.priceId).cadence;
            } catch {
              // A price id no longer in the plan book (theoretical — the book is append-only).
              // Same fail-soft posture as above: the refund's money effects must still land.
              process.stderr.write(
                `[service-license] subscription refund ${ev.paymentId}: price id resolves no plan — horizon rollback skipped\n`,
              );
            }
            if (cadence !== null) {
              await rollbackSubscriptionCoverageHorizon(tx, {
                accountId: ev.accountId,
                subscriptionId: refundedSubscription.subscriptionId,
                cadence,
              });
            }
          }
        }
        // ponytail: the rollback keys on the WHOLE-transaction full-refund shape only. A per-line
        // adjustment that fully refunds a subscription invoice's single line (a "partial"-typed
        // full refund) leaves the horizon — bounded at one paid period, favoring the buyer —
        // rather than teaching the per-line branch subscription semantics.
        // G27: a buyer-facing "your access changed" notice, ONLY when this call actually revoked
        // an active grant — idempotent by construction (revokePurchaseGrants only flips ACTIVE
        // rows), no separate gate needed.
        return {
          ...NO_EFFECT,
          revokeNotices:
            revoked > 0 ? [{ accountId: ev.accountId, reason: "refund" }] : [],
        };
      }
      // PER-LINE partial adjustment (ADR-0218). For each refunded line, act by ITEM type:
      //   - full  → revoke that line's entitlement (fork B-1: the edition survives if another line
      //             still backs it) + claw its still-un-clawed credits;
      //   - partial (dollar) → claw a PROPORTIONAL credit amount (fork A-1), entitlement untouched.
      // The clawback amount is always bounded to the line's remaining (granted − alreadyClawed) so a
      // partial-then-full sequence never spills onto other lines' fungible credits, and clawback()
      // further bounds it to the wallet balance (never negative). Idempotency is the per-delivery key
      // `${adjustmentId}:${itemId}` — a redelivery of the same adjustment writes no second debit, while
      // two sequential partial adjustments on one line (distinct adjustment ids) both claw.
      // A Stripe partial refund arrives here with `items: []` → a no-op (ADR-0218 D-1), preserving the
      // ADR-0113 scalar-partial semantics for drivers without per-line data.
      //
      // Purchase-level remainder bound (reversed delivery): a whole-transaction full refund
      // may have landed BEFORE this per-line adjustment — its clawback row is keyed `line_item_id`
      // NULL / `source_event_id = paymentId`, invisible to `lineCreditLedger`'s per-line filter, so
      // that ledger alone would show this line as un-clawed and re-claw it. `creditsClawedForSource`
      // counts that NULL-line row too, so netting it against the purchase's total grant bounds every
      // per-line claw below to what the WHOLE PURCHASE still has outstanding, not just what this one
      // line's own rows show. Read ONCE, under `outstandingClaw`'s account+purchase advisory lock
      // (blocks a concurrently-racing whole-transaction refund or admin revoke for the
      // SAME purchase until whichever lands first commits), then decrement locally by each claw's
      // ACTUAL amount as the loop proceeds — one transaction, no concurrent interleaving within it.
      // Canonical lock order: account billing lock FIRST — this branch previously acquired the
      // claw lock first and the coverage lock last (inside the closing reconcile), the reverse of
      // the whole-transaction branch and the admin revoke. See acquireAccountBillingLock.
      await acquireAccountBillingLock(tx, ev.accountId);
      let purchaseRemaining = await outstandingClaw(
        tx,
        ev.accountId,
        ev.paymentId,
      );
      // The FULLY-refunded line ids of this adjustment — a renewal line among them un-extends its
      // updates window after the loop (ADR-0251). A dollar-partial refund never un-extends (a
      // renewal SKU is all-or-nothing), so only `type:'full'` items enter here.
      const fullyRefundedItemIds: string[] = [];
      let revokedLines = 0;
      for (const item of ev.items) {
        const ledger = await lineCreditLedger(tx, ev.accountId, item.itemId);
        const remaining = Math.min(
          ledger.granted - ledger.clawed,
          purchaseRemaining,
        );
        const key = `${ev.adjustmentId}:${item.itemId}`;
        if (item.fullyRefunded) {
          fullyRefundedItemIds.push(item.itemId);
          revokedLines += await revokePurchaseLineGrants(tx, {
            accountId: ev.accountId,
            purchaseId: ev.paymentId,
            lineItemId: item.itemId,
          });
          if (remaining > 0) {
            const result = await clawback(tx, {
              accountId: ev.accountId,
              amount: remaining,
              sourceEventId: key,
              lineItemId: item.itemId,
            });
            purchaseRemaining -= result.clawedBack;
          }
          continue;
        }
        // ADR-0394 (release-audit F2): record the refunded dollars on the line's surviving grants so
        // the upgrade-credit floor nets them later. Deliberately OUTSIDE the credit-claw guard
        // below — a line that granted zero credits writes no clawback row at all, and those are
        // exactly the rows an upgrade quote reads. Idempotent on its own applied-adjustment set, so
        // a redelivery of this adjustment adds nothing (`recordLineRefund`'s single-statement guard).
        const refundRecorded = await recordLineRefund(tx, {
          accountId: ev.accountId,
          lineItemId: item.itemId,
          amountMinorUnits: item.amountRefunded,
          adjustmentId: ev.adjustmentId,
        });
        // Zero rows with a real refund amount means the grant is not here yet — a refund that
        // overtook its own `transaction.completed`. The later grant then stamps a full
        // `charged_amount` with no refund against it, and Paddle will not redeliver this adjustment
        // (we acked it), so the netting is lost for that ordering. Nothing to repair in-band: there
        // is no row to write to. Say so instead of discarding the signal, the way an unattributed
        // purchase does. The sibling claw and line revoke have the identical hole by construction
        // (an empty ledger reads 0, a revoke matches nothing), so this is the handler's standing
        // ordering posture, not a new one — and it errs toward the buyer.
        if (refundRecorded === 0 && item.amountRefunded > 0) {
          process.stderr.write(
            `[service-license] ALERT: refund ${ev.adjustmentId} for line ${item.itemId} (account ${ev.accountId}) matched no entitlement grant — recorded nothing; if the purchase arrives later its paid amount will not be netted\n`,
          );
        }
        // Dollar-partial: proportional claw, entitlement left intact (fork A-1). Skip when the line
        // granted no credits, its charged amount is unknown (can't proportion), the refund is zero, or
        // the line is already fully clawed.
        if (
          ledger.granted > 0 &&
          ledger.charged > 0 &&
          item.amountRefunded > 0 &&
          remaining > 0
        ) {
          const prop = proportionalClaw(
            ledger.granted,
            item.amountRefunded,
            ledger.charged,
          );
          const amount = Math.min(prop.credits, remaining);
          if (amount > 0) {
            const result = await clawback(tx, {
              accountId: ev.accountId,
              amount,
              sourceEventId: key,
              lineItemId: item.itemId,
              rounding: prop.rounding,
            });
            purchaseRemaining -= result.clawedBack;
          }
        }
      }
      // ADR-0269 refund reconcile (audit P1 1) — same sweep as the whole-transaction branch: any
      // coverage mirror left without an active one_time backing after the per-line revokes falls.
      await reconcileCoverageGrants(tx, ev.accountId);
      // ADR-0251 renewal un-extend (per-line): reverse the window extension of any FULLY-refunded
      // renewal line. Scoped to the refunded lines so a sibling non-renewal line's window is
      // untouched; a line that was not a renewal matches no ledger row → no-op.
      if (fullyRefundedItemIds.length > 0) {
        await reverseRenewalExtensions(tx, {
          accountId: ev.accountId,
          purchaseId: ev.paymentId,
          lineItemIds: fullyRefundedItemIds,
        });
      }
      // SHIP-audit: Paddle types a line-by-line full refund as 'partial', so a purchase whose
      // every line is refunded through THIS branch previously kept `order_record.status='paid'`
      // — the affiliate report showed full payable commission with zero clawback flag (the
      // whole-transaction branch flips it; this one didn't). Flip when this adjustment fully
      // refunded a line (a credits-only line revokes no grant, so `revokedLines` is the wrong
      // trigger) AND the purchase is left verifiably empty: no active grants, no un-clawed
      // credits. Conservative on purpose — a mixed cart with a live line, or spent credits that
      // bounded the claw, stays 'paid' and the report's revoked-grants `partialRefund` alert
      // owns the review instead.
      if (
        fullyRefundedItemIds.length > 0 &&
        purchaseRemaining <= 0 &&
        (await countActivePurchaseGrants(tx, ev.accountId, ev.paymentId)) === 0
      ) {
        await refundOrderRecord(tx, ev.paymentId);
      }
      // G27: only when a line's grant was ACTUALLY revoked this call (a dollar-partial claw with
      // no entitlement loss, or a redelivered/idempotent line revoke, stays silent).
      return {
        ...NO_EFFECT,
        revokeNotices:
          revokedLines > 0
            ? [{ accountId: ev.accountId, reason: "refund" }]
            : [],
      };
    }
    case "subscription.created": // signup only — granting here would never renew (the X-2 trap)
    case "subscription.updated": // plan change recorded; proration grant is the deferred SD-1
      return NO_EFFECT;
    case "chargeback.detected": {
      // ADR-0294 — ALERT-ONLY: no grant, no revoke, no claw. Paddle (merchant of record) absorbs
      // the dispute; an operator reviews the case and, if warranted, acts through the existing
      // admin `purchase_revoke` lever. Surfaced via `chargebackAlerts` only, so the post-commit
      // push in app.ts fires the operator notification without this mapper touching any
      // grant/credit table — the fail-closed `default: return null` posture in `parsePaddleEvent`
      // for every OTHER unsubscribed adjustment reason is unchanged.
      //
      // WR-01 (SHIP review 2026-07-08): gate the alert behind the SAME idempotency primitive the
      // grant paths use, keyed on the STABLE disputed transaction id — a Paddle dashboard "Resend"
      // mints a FRESH event_id for the same underlying dispute (the identical G7 rationale), so
      // without this the outer `processEvent` claim (keyed on `event_id`) waves the resend through
      // and the operator gets alerted twice for one dispute. Falls back to the event's own
      // `sourceEventId` when `transaction_id` was missing on the delivery (`paymentId`'s ""
      // sentinel) — a resend of THAT degenerate case can still re-alert once more (a fresh
      // `event_id` per delivery, nothing stable to key on); see webhook.ts's threading comment.
      const alertKey = ev.paymentId !== "" ? ev.paymentId : ev.sourceEventId;
      let chargebackAlerts: ChargebackAlert[] = [];
      await withIdempotentSideEffect(
        tx,
        alertKey,
        "chargeback_alert",
        async () => {
          chargebackAlerts = [
            {
              accountId: ev.accountId,
              paymentId: ev.paymentId,
              amountDisputed: ev.amountDisputed,
              currency: ev.currency,
            },
          ];
        },
      );
      return { ...NO_EFFECT, chargebackAlerts };
    }
    default: {
      // Exhaustiveness guard: a future DomainBillingEvent member forces an explicit decision here
      // rather than silently no-op'ing (the silent-miss class this mapper exists to prevent).
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
