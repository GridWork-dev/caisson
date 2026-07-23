"use client";

// "Converge two devices" (ADR-0378 lock 2). Two replica columns take fixed offline edits; converging
// them runs the real @caisson/local-sync merge (reconcileWithTombstones, local-sync-logic.ts — the
// package mirrored and golden-pinned in local-sync-logic.test.ts) through the hybrid logical clock
// (HlcStamp) into one converged state. A deletion survives as a visible tombstone, never a silent
// disappearance. The persistence toggle shows why: without carrying the tombstone into the next sync
// round, a late, clock-behind edit resurrects the row the delete removed. Nothing leaves the page.
import { useCallback, useMemo, useState } from "react";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./local-sync-poke.module.css";
import {
  A_QUEUE,
  B_QUEUE,
  B_STALE_ENTRY,
  converge,
  initialPokeState,
  REPLICA_A,
  titleOf,
  verdictFor,
  type ChangesetEntry,
  type PokeState,
} from "./local-sync-logic";

/** One line describing a queued edit, for both the queue list and the "delivered" straggler card. */
function entryLabel(entry: ChangesetEntry): string {
  if (entry.op === "delete") return `delete ${entry.pk}`;
  const title = entry.values?.title;
  return `upsert ${entry.pk} "${typeof title === "string" ? title : ""}"`;
}

export default function LocalSyncPoke() {
  const [state, setState] = useState<PokeState>(initialPokeState);

  const applyA = useCallback(() => {
    setState((s) =>
      s.appliedA >= A_QUEUE.length ? s : { ...s, appliedA: s.appliedA + 1 },
    );
  }, []);

  const applyB = useCallback(() => {
    setState((s) =>
      s.appliedB >= B_QUEUE.length ? s : { ...s, appliedB: s.appliedB + 1 },
    );
  }, []);

  const deliverStale = useCallback(() => {
    setState((s) => ({ ...s, staleDelivered: true }));
  }, []);

  const togglePersist = useCallback(() => {
    setState((s) => ({ ...s, persistTombstones: !s.persistTombstones }));
  }, []);

  const reset = useCallback(() => setState(initialPokeState), []);

  const result = useMemo(() => converge(state), [state]);
  const verdict = verdictFor(state, result);
  const final = result.round2 ?? result.round1;
  const straggerReady =
    state.appliedA >= A_QUEUE.length && state.appliedB >= B_QUEUE.length;

  return (
    <PokeShell
      label="@caisson/local-sync"
      title="Take two devices offline, edit both, then converge."
    >
      <div className={styles.replicas}>
        <div className={styles.replica}>
          <div className={styles.replicaHead}>
            <span className={styles.replicaName}>Replica A</span>
            <span className={styles.sampleTag}>sample edits</span>
          </div>
          <ol className={styles.queue}>
            {A_QUEUE.map((entry, i) => (
              <li
                key={`${entry.pk}-${entry.seq}`}
                className={styles.queueRow}
                data-applied={i < state.appliedA}
              >
                <code>{entryLabel(entry)}</code>
                <span className={styles.queueState}>
                  {i < state.appliedA ? "applied" : "pending"}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.action}
            onClick={applyA}
            disabled={state.appliedA >= A_QUEUE.length}
          >
            Apply next edit
          </button>
        </div>

        <div className={styles.replica}>
          <div className={styles.replicaHead}>
            <span className={styles.replicaName}>Replica B</span>
            <span className={styles.sampleTag}>sample edits</span>
          </div>
          <ol className={styles.queue}>
            {B_QUEUE.map((entry, i) => (
              <li
                key={`${entry.pk}-${entry.seq}`}
                className={styles.queueRow}
                data-applied={i < state.appliedB}
              >
                <code>{entryLabel(entry)}</code>
                <span className={styles.queueState}>
                  {i < state.appliedB ? "applied" : "pending"}
                </span>
              </li>
            ))}
          </ol>
          <button
            type="button"
            className={styles.action}
            onClick={applyB}
            disabled={state.appliedB >= B_QUEUE.length}
          >
            Apply next edit
          </button>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>Converged state</span>
          <span
            className={styles.orderCheck}
            data-tone={result.orderIndependent ? "ok" : "fail"}
          >
            A→B and B→A agree: {result.orderIndependent ? "yes" : "no"}
          </span>
        </div>
        {final.live.length === 0 ? (
          <p className={styles.empty}>
            No rows yet. Apply edits on both replicas.
          </p>
        ) : (
          <ul className={styles.liveList}>
            {final.live.map((row) => (
              <li key={`${row.table}.${row.pk}`} className={styles.liveRow}>
                <code>{row.pk}</code>
                <span>{titleOf(row)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.tombHead}>Tombstones</div>
        {final.tombstones.length === 0 ? (
          <p className={styles.empty}>None.</p>
        ) : (
          <ul className={styles.tombList}>
            {final.tombstones.map((t) => (
              <li key={`${t.table}.${t.pk}`} className={styles.tombRow}>
                <code>{t.pk}</code>
                <span className={styles.tombNote}>
                  deleted by{" "}
                  {t.stamp.node === REPLICA_A ? "Replica A" : "Replica B"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.straggler}>
        <div className={styles.stragglerHead}>
          <span className={styles.panelTitle}>Second sync round</span>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={state.persistTombstones}
              onChange={togglePersist}
            />
            Persist tombstones across rounds
          </label>
        </div>
        <p className={styles.stragglerLine}>
          Replica B still has one clock-behind edit queued from before the first
          sync: <code>{entryLabel(B_STALE_ENTRY)}</code>.
        </p>
        <button
          type="button"
          className={styles.action}
          onClick={deliverStale}
          disabled={!straggerReady || state.staleDelivered}
        >
          Deliver the late edit
        </button>
      </div>

      <Verdict state={verdict.state}>{verdict.text}</Verdict>

      <button type="button" className={styles.reset} onClick={reset}>
        Reset both replicas
      </button>
    </PokeShell>
  );
}
