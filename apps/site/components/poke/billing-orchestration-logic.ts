// Pure, deterministic mirror of @caisson/billing-orchestration's OUTER webhook-event idempotency
// (processEvent + the private assertValidSourceEventId guard + claim, packages/billing-orchestration/
// src/idempotency.ts). The real processEvent is DB-backed: a Postgres
// `INSERT INTO billing_processed_event ... ON CONFLICT (event_key) DO NOTHING RETURNING` run inside the
// caller's tenant transaction (@caisson/tenancy-rls TenantExecutor), so a fresh delivery claims the key
// and runs the grant `fn`, and a re-delivery finds the claim and SKIPS `fn`. None of that resolves in a
// browser bundle (no pg, no tenant GUC), so the claim-once semantics are mirrored here over an in-memory
// key set and parity-pinned in billing-orchestration-logic.test.ts, which drives the REAL processEvent /
// withIdempotentSideEffect against a real PGlite RLS harness under bun and asserts identical outcomes on
// the same inputs.
//
// No crypto: the claim is a plain key-membership test (the real one is an INSERT ON CONFLICT over a
// PRIMARY KEY), so there is nothing to hash. No Date.now(), no Math.random(): every delivery id is
// caller-supplied sample data and the ledger sequence is a session-scoped counter, so replaying the same
// clicks always produces the same claim table and ledger.

/** Mirrors @caisson/kernel's ValidationError (packages/kernel/src/errors.ts): name "ValidationError",
 *  code "validation_error", httpStatus 400. The real class extends CaissonError; this mirror carries the
 *  same three public fields the poke renders. Imported-and-asserted against the real ValidationError in
 *  the test. */
export class ValidationErrorMirror extends Error {
  readonly code = "validation_error";
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Mirrors assertValidSourceEventId (idempotency.ts): a blank claim key would collapse every
 * unattributed event onto one row, and a ':' would alias the per-effect composite key
 * `${sourceEventId}:${sideEffect}` that shares the one claim table's namespace. Both fail closed. The
 * empty-case message is verbatim from the package; the colon-case message is reworded to drop the
 * package's em dash (ADR-0375) while carrying the same reason.
 */
export function assertValidSourceEventId(
  sourceEventId: string,
  caller: string,
): void {
  if (sourceEventId.length === 0) {
    throw new ValidationErrorMirror(
      `${caller} requires a non-empty sourceEventId`,
    );
  }
  if (sourceEventId.includes(":")) {
    throw new ValidationErrorMirror(
      `${caller} requires a sourceEventId without ':', it would alias the composite side-effect key namespace`,
    );
  }
}

/** The DomainBillingEvent discriminant, owned by packages/billing/src/events.ts (the OPEN contract,
 *  re-exported by @caisson/billing), NOT by billing-orchestration, whose provider mappers only PRODUCE
 *  it. Pinned byte-for-byte against DomainBillingEventSchema's discriminated-union options in the test. */
export type DomainBillingEventType =
  | "purchase.completed"
  | "subscription.created"
  | "subscription.updated"
  | "subscription.canceled"
  | "refund.completed"
  | "chargeback.detected"
  | "invoice.paid";

/** The canonical set, in DomainBillingEventSchema declaration order. */
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
  /** Claimed event keys, most-recent first, the in-memory stand-in for billing_processed_event. */
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
 * Mirrors processEvent(tx, sourceEventId, fn): validate the key, then claim it once. A fresh claim runs
 * the grant (here: append a fulfillment row + record the gated side-effect) and reports
 * {alreadyProcessed:false}; a re-delivery of the same key finds the claim, SKIPS the grant, and reports
 * {alreadyProcessed:true}. A blank or colon-bearing key throws ValidationErrorMirror before any state
 * changes (fail closed), the real guard's exact behavior.
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

/**
 * Mirrors withIdempotentSideEffect(tx, sourceEventId, sideEffect, fn): validate the sourceEventId, reject
 * a blank sideEffect, then claim the composite `${sourceEventId}:${sideEffect}` once. Returns whether
 * THIS call performed the effect (false = already done, skipped). The composite key deliberately carries
 * a ':', the guard validates the sourceEventId INPUT, not the composite the claim is keyed on. Not wired
 * into the poke UI; kept for parity coverage of the per-effect layer.
 */
export function withIdempotentSideEffectStep(
  state: ConsoleState,
  sourceEventId: string,
  sideEffect: string,
): { state: ConsoleState; fired: boolean } {
  assertValidSourceEventId(sourceEventId, "withIdempotentSideEffect");
  if (sideEffect.length === 0) {
    throw new ValidationErrorMirror(
      "withIdempotentSideEffect requires a non-empty sideEffect",
    );
  }
  const key = `${sourceEventId}:${sideEffect}`;
  if (state.claimed.includes(key)) {
    return { state, fired: false };
  }
  return {
    state: { ...state, claimed: [key, ...state.claimed] },
    fired: true,
  };
}

/** deliveries minus unique fulfillments = the re-deliveries the claim table deduped. */
export function dedupedCount(state: ConsoleState): number {
  return state.deliveries - state.ledger.length;
}
