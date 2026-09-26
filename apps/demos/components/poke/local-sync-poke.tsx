"use client";

// "Converge two devices" (ADR-0378 lock 2). Two replica columns take fixed offline edits; converging
// them runs the REAL @caisson-sh/local-sync merge — `reconcileWithTombstones` imported straight from
// the package, whose single `.` entry is browser-safe (ADR-0396, pinned by the package's own
// src/browser-safety.test.ts). The hand-ported mirror this poke used to drive is deleted.
//
// Poke-local below the imports: the baked sample scenario and the click state over it. No merge
// rule, no clock comparison, and no tombstone semantic is restated here — a divergence the real
// reconcile would not compute cannot be shown. Nothing fetches, persists, or measures.
import { useCallback, useMemo, useState } from "react";
import {
  reconcileWithTombstones,
  type Changeset,
  type ChangesetEntry,
  type ReconciledRow,
  type Tombstone,
  type TombstoneReconcileResult,
} from "@caisson-sh/local-sync";

import { PokeShell, Verdict, type VerdictState } from "./poke-rig";
import styles from "./local-sync-poke.module.css";

// --- The sample scenario (poke-local fixture data) ---
//
// The exact two-replica "docs" divergence packages/local-sync/src/reconcile.test.ts pins as its
// tombstone golden (__golden__/tombstone-resolve.json), extended with one straggler entry (B's
// clock-behind third edit) to exercise the ACROSS-ROUNDS tombstone persistence tombstone.test.ts
// pins — the part a single-batch merge cannot show, because a delete already wins within one batch
// regardless of whether tombstones persist.

/** Sample tenant id for this poke (labeled "sample" in the UI — not a real tenant). */
export const TENANT_ID = "tenant-demo";
export const REPLICA_A = "replica-a";
export const REPLICA_B = "replica-b";

/** Replica A's fixed offline queue: create e1, create e3, then delete e1. */
export const A_QUEUE: readonly ChangesetEntry[] = [
  {
    table: "docs",
    pk: "e1",
    op: "upsert",
    values: { title: "e1-A" },
    updatedAt: 3000,
    seq: 1,
  },
  {
    table: "docs",
    pk: "e3",
    op: "upsert",
    values: { title: "e3-A" },
    updatedAt: 3001,
    seq: 2,
  },
  {
    table: "docs",
    pk: "e1",
    op: "delete",
    values: null,
    updatedAt: 3010,
    seq: 3,
  },
];

/** Replica B's fixed offline queue: create e1 (concurrently), create e2. */
export const B_QUEUE: readonly ChangesetEntry[] = [
  {
    table: "docs",
    pk: "e1",
    op: "upsert",
    values: { title: "e1-B" },
    updatedAt: 3005,
    seq: 1,
  },
  {
    table: "docs",
    pk: "e2",
    op: "upsert",
    values: { title: "e2-B" },
    updatedAt: 3006,
    seq: 2,
  },
];

/**
 * A late, clock-behind edit Replica B still had queued from before the first sync (physical 3002 is
 * older than A's delete at 3010, but its `seq` — 3 — is newer than anything already delivered).
 */
export const B_STALE_ENTRY: ChangesetEntry = {
  table: "docs",
  pk: "e1",
  op: "upsert",
  values: { title: "e1-B-stale" },
  updatedAt: 3002,
  seq: 3,
};

export interface PokeState {
  /** How many of A_QUEUE have been applied, 0..A_QUEUE.length. */
  readonly appliedA: number;
  /** How many of B_QUEUE have been applied, 0..B_QUEUE.length. */
  readonly appliedB: number;
  /** Whether Replica B's straggler edit has been delivered (a second sync round). */
  readonly staleDelivered: boolean;
  /** Whether the straggler round carries forward the first round's persisted tombstones. */
  readonly persistTombstones: boolean;
}

export const initialPokeState: PokeState = {
  appliedA: 0,
  appliedB: 0,
  staleDelivered: false,
  persistTombstones: true,
};

function changesetFor(
  replicaId: string,
  entries: readonly ChangesetEntry[],
): Changeset {
  let until = 0;
  for (const e of entries) until = Math.max(until, e.seq);
  return { tenantId: TENANT_ID, replicaId, until, entries };
}

export interface ConvergeResult {
  /** The first-round merge: A's + B's applied edits, no prior tombstones. */
  readonly round1: TombstoneReconcileResult;
  /** round1 recomputed with the replicas merged in the opposite order — must match. */
  readonly orderIndependent: boolean;
  /** The second round (only Replica B's straggler edit), once delivered; else null. */
  readonly round2: TombstoneReconcileResult | null;
}

function rowsEqual(
  a: readonly ReconciledRow[],
  b: readonly ReconciledRow[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function tombstonesEqual(
  a: readonly Tombstone[],
  b: readonly Tombstone[],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Run the REAL merge for the current poke state. Pure — same state always converges the same way.
 * Order independence is measured by re-running the package on the swapped replica order, never
 * asserted as copy.
 */
export function converge(state: PokeState): ConvergeResult {
  const csA = changesetFor(REPLICA_A, A_QUEUE.slice(0, state.appliedA));
  const csB = changesetFor(REPLICA_B, B_QUEUE.slice(0, state.appliedB));
  const round1 = reconcileWithTombstones([], [csA, csB]);
  const round1Reversed = reconcileWithTombstones([], [csB, csA]);
  const orderIndependent =
    rowsEqual(round1.live, round1Reversed.live) &&
    tombstonesEqual(round1.tombstones, round1Reversed.tombstones);

  let round2: TombstoneReconcileResult | null = null;
  if (state.staleDelivered) {
    const csB2 = changesetFor(REPLICA_B, [B_STALE_ENTRY]);
    const prior = state.persistTombstones ? round1.tombstones : [];
    round2 = reconcileWithTombstones(prior, [csB2]);
  }
  return { round1, orderIndependent, round2 };
}

export interface PokeVerdict {
  readonly state: VerdictState;
  readonly text: string;
}

/** The value shown for a converged row's title field, or a placeholder if the row has none. */
export function titleOf(row: ReconciledRow): string {
  const value = row.values.title;
  return typeof value === "string" ? value : "(no title)";
}

/**
 * The headline verdict: computed from the merge, never asserted copy. No em dashes (ADR-0375).
 */
export function verdictFor(
  state: PokeState,
  result: ConvergeResult,
): PokeVerdict {
  if (state.appliedA === 0 && state.appliedB === 0) {
    return {
      state: "neutral",
      text: "Apply offline edits on both replicas, then converge.",
    };
  }
  if (!result.orderIndependent) {
    return {
      state: "fail",
      text: "Merge order changed the result. Convergence broke.",
    };
  }
  if (result.round2 !== null) {
    const e1 = result.round2.live.find((r) => r.pk === "e1");
    if (e1 !== undefined) {
      return {
        state: "fail",
        text: `Resurrection. e1 came back as "${titleOf(e1)}". The delete was forgotten.`,
      };
    }
    return {
      state: "ok",
      text: "Converged. The persisted tombstone held; the stale edit lost.",
    };
  }
  return {
    state: "ok",
    text: "Converged. Both replicas agree on one state.",
  };
}

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
      label="@caisson-sh/local-sync"
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
