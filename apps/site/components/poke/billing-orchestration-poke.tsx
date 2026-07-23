"use client";

// The billing-orchestration module's flagship "poke" (ADR-0378 lock 2). A deterministic in-browser
// replay of the OUTER webhook-event idempotency claim (packages/billing-orchestration/src/idempotency.ts
// processEvent), running on the package's real claim-once semantics (mirrored in
// ./billing-orchestration-logic.ts, parity-pinned against the real package + a PGlite RLS harness in
// ./billing-orchestration-logic.test.ts, see that file's header for why the mirror exists instead of a
// direct import). Deliver a provider webhook, then redeliver the same event id: it fulfills exactly once.
// Editing the event id is the tamper control, a blank or colon-bearing key fails closed with the typed
// ValidationError. Nothing here fetches, persists, or measures the visitor.
import { useCallback, useState } from "react";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import {
  PROVIDERS,
  ValidationErrorMirror,
  dedupedCount,
  initConsole,
  processEventStep,
  type ConsoleState,
  type Delivery,
  type DomainBillingEventType,
  type Provider,
  type ProviderId,
} from "./billing-orchestration-logic";
import styles from "./billing-orchestration-poke.module.css";

const DEFAULT_PROVIDER = PROVIDERS[0] as Provider;

function providerById(id: ProviderId): Provider {
  return PROVIDERS.find((p) => p.id === id) ?? DEFAULT_PROVIDER;
}

interface VerdictLine {
  state: VerdictState;
  message: string;
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
        if (err instanceof ValidationErrorMirror) {
          setVerdict({
            state: "fail",
            message: `${err.name} (${err.code}, ${err.httpStatus}). ${err.message}`,
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
      label="@caisson/billing-orchestration · billing_processed_event"
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
