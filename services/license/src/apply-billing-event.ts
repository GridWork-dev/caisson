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
import {
  clawback,
  grant,
  lineCreditLedger,
  outstandingClaw,
} from "@caisson/credits";
import { ConfigError, asCredits, type Credits } from "@caisson/kernel";
import {
  isRenewalPrice,
  resolvePlan,
  resolvePurchase,
  resolveRenewal,
} from "@caisson/pricebook";
import {
  entitlementIdAliasGroup,
  normalizeEntitlementId,
} from "@caisson/registry-schema";
import type { TenantExecutor } from "@caisson/tenancy-rls";
import {
  acquireAccountBillingLock,
  computeUpdatesWindows,
  extendUpdatesWindow,
  grantEntitlements,
  grantOwnedCoverageMirrors,
  reconcileCoverageGrants,
  reverseRenewalExtensions,
  revokePurchaseGrants,
  revokePurchaseLineGrants,
  revokeSubscriptionGrants,
  upsertSubscriptionGrants,
} from "./entitlement-store.ts";
import type { SkuLine } from "./posthog-capture.ts";

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
}

const NO_EFFECT: AppliedBillingEffect = {
  grantedEntitlements: [],
  skuLines: [],
  renewedEntitlements: [],
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
      await upsertSubscriptionGrants(tx, {
        accountId: ev.accountId,
        entitlementIds: plan.entitlements,
        subscriptionId: ev.subscriptionId,
        sourceEventId: ev.invoiceId,
        cadence: plan.cadence,
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
      const coveredIds = plan.coversOwnedEntitlements
        ? await grantOwnedCoverageMirrors(tx, {
            accountId: ev.accountId,
            subscriptionId: ev.subscriptionId,
            sourceEventId: ev.invoiceId,
            cadence: plan.cadence,
          })
        : [];
      return {
        grantedEntitlements: [
          ...new Set([...plan.entitlements, ...coveredIds]),
        ],
        skuLines: [
          {
            priceId: ev.priceId,
            productSlug: normalizeEntitlementId(plan.planTag),
          },
        ],
        renewedEntitlements: [], // a subscription cycle never carries a renewal-book line
      };
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
      const grantedEntitlements = new Set<string>();
      const skuLines: SkuLine[] = [];
      const renewedEntitlementIds = new Set<string>();
      for (const line of ev.lineItems) {
        // Updates-RENEWAL line (ADR-0244/0251): a renewal SKU grants NO entitlement and NO credits —
        // it EXTENDS the buyer's updates window on the entitlement it renews (+12 months, per
        // (account, entitlement) pair). extendUpdatesWindow is fail-closed: renewing an entitlement
        // with no active one_time grant throws → the webhook returns non-2xx and Paddle retries —
        // a renewal never silently mints a grant. Redelivery idempotency is the OUTER sourceEventId
        // claim (webhook.ts processEvent). A price id lives in exactly ONE book (pricebook test),
        // so this branch can never shadow a real purchase row. Renewal lines stay out of
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
        await grantEntitlements(tx, {
          accountId: ev.accountId,
          entitlementIds: purchase.entitlements,
          sourceEventId: ev.paymentId,
          source: { kind: "one_time", purchaseId: ev.paymentId },
          lineItemId: line.itemId,
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
      return {
        grantedEntitlements: [...grantedEntitlements],
        skuLines,
        renewedEntitlements,
      };
    }
    case "subscription.canceled":
      // Canonical lock order + coverage-mirror consistency: this revoke sweeps MIRROR rows too,
      // so it must serialize with a racing invoice.paid mint for the same account — without the
      // lock a mint interleaving past the sweep strands an active mirror until its horizon lapses.
      await acquireAccountBillingLock(tx, ev.accountId);
      // IMMEDIATE revoke (ADR-0113): soft-revoke every grant backed by this subscription. An entitlement
      // also held via an active one-time grant survives (refcount). Idempotent (only active grants flip).
      await revokeSubscriptionGrants(tx, {
        accountId: ev.accountId,
        subscriptionId: ev.subscriptionId,
      });
      return NO_EFFECT;
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
        await revokePurchaseGrants(tx, {
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
        return NO_EFFECT;
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
      for (const item of ev.items) {
        const ledger = await lineCreditLedger(tx, ev.accountId, item.itemId);
        const remaining = Math.min(
          ledger.granted - ledger.clawed,
          purchaseRemaining,
        );
        const key = `${ev.adjustmentId}:${item.itemId}`;
        if (item.fullyRefunded) {
          fullyRefundedItemIds.push(item.itemId);
          await revokePurchaseLineGrants(tx, {
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
      return NO_EFFECT;
    }
    case "subscription.created": // signup only — granting here would never renew (the X-2 trap)
    case "subscription.updated": // plan change recorded; proration grant is the deferred SD-1
      return NO_EFFECT;
    default: {
      // Exhaustiveness guard: a future DomainBillingEvent member forces an explicit decision here
      // rather than silently no-op'ing (the silent-miss class this mapper exists to prevent).
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
