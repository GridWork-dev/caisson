"use client";

// The billing-orchestration module's flagship "poke" (ADR-0378 lock 2, retired onto the real package
// by ADR-0396). A deterministic in-browser replay of the OUTER webhook-event idempotency claim
// (packages/billing-orchestration/src/idempotency.ts processEvent). Deliver a provider webhook, then
// redeliver the same event id: it fulfills exactly once. Editing the event id is the tamper control —
// a blank or colon-bearing key fails closed with the package's own typed ValidationError.
// Nothing here fetches, persists, or measures the visitor.
//
// WHAT IS REAL vs WHAT IS A PORT. The hand-ported mirror (billing-orchestration-logic.ts) is deleted:
// the claim-key decision now runs the shipped `assertValidSourceEventId` from
// @caisson-sh/billing-orchestration/browser, and the failure is the shipped @caisson-sh/kernel
// ValidationError — its identity (name, code, httpStatus) and its words rendered as thrown, with only
// the em-dash clause break swapped for a comma so a package message stays inside the site's copy law
// (ADR-0375 lock 1, which the deleted mirror satisfied by rewording the same string). See
// `verdictProse` below; nothing else about the message is the poke's. What CANNOT be real is the
// claim itself: it is an
// `INSERT … ON CONFLICT DO NOTHING RETURNING` against a TenantExecutor inside the caller's tenant
// transaction, so `claimTable` below is an in-memory PORT standing in for `billing_processed_event`
// the way a test double does — and billing-orchestration-poke.test.ts pins it against the REAL
// processEvent on a real PGlite RLS harness, sequence for sequence. The provider roster, its sample
// ids, and the type chips are sample data and presentation composition, poke-local by design.
import { useCallback, useState } from "react";
import { ValidationError } from "@caisson-sh/kernel";
import { assertValidSourceEventId } from "@caisson-sh/billing-orchestration/browser";
import type { DomainBillingEvent } from "@caisson-sh/billing";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import styles from "./billing-orchestration-poke.module.css";

/** The DomainBillingEvent discriminant, owned by @caisson-sh/billing (the OPEN contract). Type-only, so
 *  the real union governs at compile time and nothing is restated. */
export type DomainBillingEventType = DomainBillingEvent["type"];

/** The chip vocabulary — presentation, pinned against DomainBillingEventSchema's discriminated-union
 *  options (order included) in the poke test, which may import the node-capable barrel freely. */
export const DOMAIN_BILLING_EVENT_TYPES: readonly DomainBillingEventType[] = [
  "purchase.completed",
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "refund.completed",
  "chargeback.detected",
  "invoice.paid",
];

export type ProviderId = "paddle" | "stripe" | "lemonsqueezy" | "polar";

export interface Provider {
  id: ProviderId;
  label: string;
  /** The DomainBillingEvent types THIS provider's mapper actually emits (src/{provider}-events / .ts). */
  types: readonly DomainBillingEventType[];
  /** A SAMPLE source event id in this provider's real shape (labeled sample in the UI). */
  sampleEventId: string;
  /** How this provider's mapper derives the source id, the honest reason its claim key is or is not
   *  colon-free. Cited from the mapper's readSourceEventId / event-id read. */
  idNote: string;
}

/**
 * The four merchant-of-record drivers behind the one BillingProvider port (drivers.ts / lemonsqueezy.ts /
 * polar.ts). Paddle is the live MoR (ADR-0116) and its mapper is the only one that emits
 * chargeback.detected (paddle-events.ts adjustment.created action='chargeback', ADR-0294). Stripe,
 * LemonSqueezy, and Polar are buyer-supplied dormant drivers, each emitting the other six types.
 *
 * Paddle carries a native `event_id` and Stripe a native `id`, both colon-free, so the outer claim keys
 * on them directly. LemonSqueezy and Polar carry NO dependable per-delivery event id (their mappers'
 * readSourceEventId comments), so each synthesizes a `type:id` composite for the DOMAIN event's
 * sourceEventId. That composite carries a ':', which the outer claim refuses (it would alias the
 * per-effect key), exactly-once for those two rides the credit ledger's inner UNIQUE(source_event_id,
 * event_type) index instead (idempotency.ts header: "The credit ledger is ALREADY idempotent").
 */
export const PROVIDERS: readonly Provider[] = [
  {
    id: "paddle",
    label: "Paddle",
    types: DOMAIN_BILLING_EVENT_TYPES,
    sampleEventId: "evt_01j8xk2m9q7rst4v6wz3n5abc",
    idNote:
      "Paddle carries a native event_id (colon free), so the outer claim keys on it directly.",
  },
  {
    id: "stripe",
    label: "Stripe",
    types: [
      "purchase.completed",
      "subscription.created",
      "subscription.updated",
      "subscription.canceled",
      "refund.completed",
      "invoice.paid",
    ],
    sampleEventId: "evt_1Q9pX2Lk3mNoPqRstUvWxYz1",
    idNote:
      "Stripe carries a native event id (colon free), so the outer claim keys on it directly.",
  },
  {
    id: "lemonsqueezy",
    label: "LemonSqueezy",
    types: [
      "purchase.completed",
      "subscription.created",
      "subscription.updated",
      "subscription.canceled",
      "refund.completed",
      "invoice.paid",
    ],
    sampleEventId: "orders:2481",
    idNote:
      "LemonSqueezy has no dependable per-delivery event id, so the mapper synthesizes a type:id composite. The outer claim refuses a colon, so exactly-once rides the credit ledger inner UNIQUE(source_event_id, event_type) index.",
  },
  {
    id: "polar",
    label: "Polar",
    types: [
      "purchase.completed",
      "subscription.created",
      "subscription.updated",
      "subscription.canceled",
      "refund.completed",
      "invoice.paid",
    ],
    sampleEventId: "order.paid:0b7c2f1a9d",
    idNote:
      "Polar has no dedicated per-delivery event id, so the mapper synthesizes a type:id composite. The outer claim refuses a colon, so exactly-once rides the credit ledger inner UNIQUE(source_event_id, event_type) index.",
  },
];

/** The detached, non-DB side-effect the OUTER claim exists to gate: the post-commit Discord role push
 *  (ADR-0203) re-fires on every provider re-delivery unless processEvent skips the whole grant fn first
 *  (idempotency.ts header). The credit ledger is already idempotent; this push is not. */
export const GATED_SIDE_EFFECT = "Discord role push (post-commit)";

export interface LedgerRow {
  seq: number;
  provider: ProviderId;
  type: DomainBillingEventType;
  eventKey: string;
  sideEffect: string;
}

export interface ConsoleState {
  /** Claimed event keys, most-recent first — the in-memory PORT standing in for
   *  billing_processed_event. Membership is the browser's stand-in for the table's PRIMARY KEY, not a
   *  second implementation of anything the package decides. */
  claimed: string[];
  /** Fulfillment rows (one per fresh claim), most-recent first. */
  ledger: LedgerRow[];
  /** Monotonic ledger sequence (session-scoped; never a clock). */
  counter: number;
  /** Total VALID delivery attempts, including re-deliveries, deliveries minus ledger.length = deduped. */
  deliveries: number;
}

export function initConsole(): ConsoleState {
  return { claimed: [], ledger: [], counter: 0, deliveries: 0 };
}

export interface Delivery {
  provider: ProviderId;
  type: DomainBillingEventType;
  sourceEventId: string;
}

export interface ProcessResult {
  /** True when a prior delivery already claimed this key, the grant fn was NOT run this call. */
  alreadyProcessed: boolean;
  /** True when THIS delivery ran the grant (fresh claim). */
  fulfilled: boolean;
  eventKey: string;
}

/**
 * One delivery through processEvent's shape: the REAL `assertValidSourceEventId` decides whether the
 * key may be claimed at all (throwing the package's ValidationError before any state changes — fail
 * closed), then the in-memory port claims it once. A fresh claim runs the grant (here: append a
 * fulfillment row + record the gated side-effect) and reports {alreadyProcessed:false}; a re-delivery
 * of the same key finds the claim, SKIPS the grant, and reports {alreadyProcessed:true}.
 */
export function processEventStep(
  state: ConsoleState,
  delivery: Delivery,
): { state: ConsoleState; result: ProcessResult } {
  assertValidSourceEventId(delivery.sourceEventId, "processEvent");
  const key = delivery.sourceEventId;
  const deliveries = state.deliveries + 1;

  if (state.claimed.includes(key)) {
    return {
      state: { ...state, deliveries },
      result: { alreadyProcessed: true, fulfilled: false, eventKey: key },
    };
  }

  const seq = state.counter + 1;
  const row: LedgerRow = {
    seq,
    provider: delivery.provider,
    type: delivery.type,
    eventKey: key,
    sideEffect: GATED_SIDE_EFFECT,
  };
  return {
    state: {
      claimed: [key, ...state.claimed],
      ledger: [row, ...state.ledger],
      counter: seq,
      deliveries,
    },
    result: { alreadyProcessed: false, fulfilled: true, eventKey: key },
  };
}

/** deliveries minus unique fulfillments = the re-deliveries the claim table deduped. */
export function dedupedCount(state: ConsoleState): number {
  return state.deliveries - state.ledger.length;
}

const DEFAULT_PROVIDER = PROVIDERS[0] as Provider;

function providerById(id: ProviderId): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? DEFAULT_PROVIDER;
}

interface VerdictLine {
  state: VerdictState;
  message: string;
}

/**
 * A shipped error message is internal prose and free to use an em dash as a clause break; a rendered
 * verdict line is buyer-facing prose and is not (ADR-0375 lock 1). Swap that one break for a comma and
 * leave every other character alone, so the sentence a visitor reads is still the package's own words
 * rather than a poke-authored paraphrase that could drift from it.
 */
export function verdictProse(message: string): string {
  return message.replace(/\s+—\s+/g, ", ");
}

export default function BillingOrchestrationPoke() {
  const [providerId, setProviderId] = useState<ProviderId>(DEFAULT_PROVIDER.id);
  const [type, setType] = useState<DomainBillingEventType>(
    DEFAULT_PROVIDER.types[0] ?? "purchase.completed",
  );
  const [sourceEventId, setSourceEventId] = useState(
    DEFAULT_PROVIDER.sampleEventId,
  );
  const [consoleState, setConsole] = useState<ConsoleState>(() =>
    initConsole(),
  );
  const [lastDelivery, setLastDelivery] = useState<Delivery | null>(null);
  const [verdict, setVerdict] = useState<VerdictLine>({
    state: "neutral",
    message: "Pick a provider and event, then deliver.",
  });

  const provider = providerById(providerId);

  const selectProvider = useCallback((id: ProviderId) => {
    const next = providerById(id);
    setProviderId(id);
    setType(next.types[0] ?? "purchase.completed");
    setSourceEventId(next.sampleEventId);
    setVerdict({
      state: "neutral",
      message: `Provider set to ${next.label}. Deliver when ready.`,
    });
  }, []);

  const deliver = useCallback(
    (delivery: Delivery, redelivery: boolean) => {
      try {
        const { state: next, result } = processEventStep(
          consoleState,
          delivery,
        );
        setConsole(next);
        setLastDelivery(delivery);
        if (result.alreadyProcessed) {
          setVerdict({
            state: "ok",
            message: `Redelivery deduped. ${result.eventKey} was already claimed, the grant and the ${next.ledger[0]?.sideEffect ?? "side effect"} were skipped.`,
          });
        } else {
          setVerdict({
            state: "ok",
            message: `${redelivery ? "Redelivered" : "Delivered"} and fulfilled. Claimed ${result.eventKey}, grant ran once.`,
          });
        }
      } catch (err) {
        if (err instanceof ValidationError) {
          setVerdict({
            state: "fail",
            message: `${err.name} (${err.code}, ${err.httpStatus}). ${verdictProse(err.message)}`,
          });
          return;
        }
        throw err;
      }
    },
    [consoleState],
  );

  const handleDeliver = useCallback(() => {
    deliver({ provider: providerId, type, sourceEventId }, false);
  }, [deliver, providerId, type, sourceEventId]);

  const handleRedeliver = useCallback(() => {
    if (lastDelivery === null) {
      setVerdict({ state: "neutral", message: "Deliver a webhook first." });
      return;
    }
    deliver(lastDelivery, true);
  }, [deliver, lastDelivery]);

  const handleReset = useCallback(() => {
    setConsole(initConsole());
    setLastDelivery(null);
    setVerdict({
      state: "neutral",
      message: "Console reset. Claim table empty.",
    });
  }, []);

  const composite = sourceEventId.includes(":");
  const deduped = dedupedCount(consoleState);

  return (
    <PokeShell
      label="@caisson-sh/billing-orchestration · billing_processed_event"
      title="Redeliver the same webhook. It fulfills exactly once."
    >
      <div className={styles.tabs} role="group" aria-label="Billing provider">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={styles.tab}
            aria-pressed={p.id === providerId}
            onClick={() => selectProvider(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        className={styles.chips}
        role="group"
        aria-label="Domain billing event type"
      >
        {provider.types.map((t) => (
          <button
            key={t}
            type="button"
            className={styles.chip}
            aria-pressed={t === type}
            onClick={() => setType(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Source event id, sample. Editable
        </span>
        <input
          className={styles.input}
          type="text"
          value={sourceEventId}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setSourceEventId(e.target.value)}
        />
      </label>

      <p className={styles.note} data-tone={composite ? "warn" : "muted"}>
        {provider.idNote}
      </p>

      <div className={styles.stats}>
        <span>
          Deliveries <strong>{consoleState.deliveries}</strong>
        </span>
        <span>
          Fulfilled <strong>{consoleState.ledger.length}</strong>
        </span>
        <span>
          Deduped <strong>{deduped}</strong>
        </span>
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={handleDeliver}>
          Deliver webhook
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={handleRedeliver}
        >
          Redeliver same id
        </button>
        <button
          type="button"
          className={styles.buttonGhost}
          onClick={handleReset}
        >
          Reset console
        </button>
      </div>

      <div className={styles.panes}>
        <div className={styles.pane}>
          <p className={styles.paneTitle}>Claim table</p>
          <ul className={styles.list}>
            {consoleState.claimed.length === 0 ? (
              <li className={styles.empty}>No claims yet.</li>
            ) : (
              consoleState.claimed.slice(0, 6).map((key) => (
                <li key={key} className={styles.claimRow}>
                  <span className={styles.claimDot} aria-hidden="true" />
                  <span className={styles.claimKey}>{key}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={styles.pane}>
          <p className={styles.paneTitle}>Fulfillment ledger</p>
          <ul className={styles.list}>
            {consoleState.ledger.length === 0 ? (
              <li className={styles.empty}>No fulfillments yet.</li>
            ) : (
              consoleState.ledger.slice(0, 6).map((row) => (
                <li key={row.seq} className={styles.ledgerRow}>
                  <span className={styles.ledgerType}>{row.type}</span>
                  <span className={styles.ledgerSide}>{row.sideEffect}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <Verdict state={verdict.state}>{verdict.message}</Verdict>
    </PokeShell>
  );
}
