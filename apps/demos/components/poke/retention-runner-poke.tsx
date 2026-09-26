"use client";

// The retention-runner module's poke (ADR-0378 lock 2) — a live, deterministic run of the REAL
// `@caisson-sh/retention-runner` erasure fan-out against a fixed sample subject. The hand-ported
// mirror this used to drive is deleted (ADR-0396): `runErasure`, the three reference target
// factories, the capture audit sink, and the reason vocabulary all come from
// `@caisson-sh/retention-runner/browser`, the package's browser-safe entry (`.` minus the
// `@caisson-sh/jobs` scheduling half). Only the sample identifiers, the reason labels, and the
// break-a-store controls are poke-local. Nothing here fetches, persists, or measures the visitor,
// and the clock is injected — `runErasure` never reaches for `Date.now` on a rendered path.
import { useId, useMemo, useState } from "react";
import { Button, Checkbox, Radio } from "@caisson-sh/ui/components";
import {
  ERASURE_REASONS,
  createCascadeDbTarget,
  createCaptureAuditSink,
  createObjectStorageTarget,
  createOrphanSweepTarget,
  runErasure,
} from "@caisson-sh/retention-runner/browser";
import type {
  ErasureReason,
  ErasureTarget,
  RetentionRunResult,
} from "@caisson-sh/retention-runner/browser";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./retention-runner-poke.module.css";

// Fixed sample data-subject identifiers (retention-runner's types.ts assumes no shape for these).
// Labeled as a sample below, never generated per visit.
export const SAMPLE_SUBJECT_ID = "sub_9f21";
export const SAMPLE_TENANT_ID = "ten_launchco";

const REASON_LABELS: Record<ErasureReason, string> = {
  auto_90d: "auto_90d, the recurring scheduled sweep",
  ccpa_request: "ccpa_request, a subject's erasure request",
  operator_manual: "operator_manual, an operator-triggered erasure",
};

/**
 * Cited-only vocabulary: `@caisson-sh/field-crypto`'s `ERASURE_CRYPTO_SHRED`, the audit event minted
 * into the WORM chain when field-encrypted PII is erased by destroying its KEK instead of by a
 * target delete. Restated here rather than imported because field-crypto is irreducibly node-only
 * (its cipher/KMS/derive modules all reach `node:crypto`) and offers no browser entry — retiring
 * that is a different package's job. The poke test pins this string against the real constant, so
 * a drift fails a gate rather than shipping a stale quote.
 */
export const ERASURE_CRYPTO_SHRED = "erasure.crypto-shred";

/** The poke's control keys for the three reference targets — poke-local, because the visitor picks
 * a STORE to break, while the target's own name is the package's to supply. */
export const TARGET_KINDS = [
  "objectStorage",
  "cascadeDb",
  "orphanSweep",
] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

export type FailingState = Readonly<Record<TargetKind, boolean>>;

export const NO_FAILURES: FailingState = {
  objectStorage: false,
  cascadeDb: false,
  orphanSweep: false,
};

const healthy = (): Promise<void> => Promise.resolve();
const unreachable = (): Promise<void> =>
  Promise.reject(new Error("store unreachable"));
const client = (fail: boolean): (() => Promise<void>) =>
  fail ? unreachable : healthy;

/**
 * The three REAL reference targets, each built by the package's own factory over an in-memory
 * injected client that either resolves or rejects. Every `name` below is the factory's hardcoded
 * one — this poke never restates them — and `erase` is the package's own seam, so breaking a store
 * here is exactly what breaking it in production looks like to `runErasure`.
 */
export function referenceTargets(
  failing: FailingState,
): readonly { kind: TargetKind; target: ErasureTarget }[] {
  return [
    {
      kind: "objectStorage",
      target: createObjectStorageTarget({
        client: { purge: client(failing.objectStorage) },
      }),
    },
    {
      kind: "cascadeDb",
      target: createCascadeDbTarget({
        client: { cascadeDelete: client(failing.cascadeDb) },
      }),
    },
    {
      kind: "orphanSweep",
      target: createOrphanSweepTarget({
        client: { sweep: client(failing.orphanSweep) },
      }),
    },
  ];
}

export default function RetentionRunnerPoke() {
  const uid = useId();
  const [reason, setReason] = useState<ErasureReason>("ccpa_request");
  const [failing, setFailing] = useState<FailingState>(NO_FAILURES);
  const [tick, setTick] = useState(0);
  const [latest, setLatest] = useState<RetentionRunResult | null>(null);
  const [rowsWritten, setRowsWritten] = useState(0);
  // runErasure is async, so its outcome lands in a .then() continuation
  // outside the click event. `busy` blocks a second click from reading the
  // same stale `tick` closure while a run is still in flight.
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => referenceTargets(failing), [failing]);
  const failingCount = TARGET_KINDS.filter((kind) => failing[kind]).length;

  function run() {
    if (busy) return;
    setBusy(true);
    const sink = createCaptureAuditSink();
    const nextTick = tick + 1;
    void runErasure(
      { subjectId: SAMPLE_SUBJECT_ID, tenantId: SAMPLE_TENANT_ID, reason },
      rows.map((r) => r.target),
      sink,
      () => nextTick * 1_000,
    ).then((row) => {
      setTick(nextTick);
      setLatest(row);
      setRowsWritten((n) => n + sink.rows.length);
      setBusy(false);
    });
  }

  const okCount = latest?.results.filter((r) => r.ok).length ?? 0;
  const totalCount = latest?.results.length ?? 0;

  return (
    <PokeShell
      label="@caisson-sh/retention-runner"
      title="Erase a subject everywhere it lives. Break one target, watch isolation hold."
    >
      <div className={styles.layout}>
        <p className={styles.sample}>
          Sample subject {SAMPLE_SUBJECT_ID}, tenant {SAMPLE_TENANT_ID}
        </p>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Erasure reason (ErasureReason)
          </legend>
          <div className={styles.optionColumn}>
            {ERASURE_REASONS.map((r) => (
              <Radio
                key={r}
                name={`${uid}-reason`}
                label={REASON_LABELS[r]}
                checked={reason === r}
                onChange={() => setReason(r)}
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Targets (ErasureTarget), break one to watch isolation hold
          </legend>
          <div className={styles.optionColumn}>
            {rows.map(({ kind, target }) => (
              <Checkbox
                key={kind}
                label={`Simulate ${target.name} failure`}
                checked={failing[kind]}
                onChange={(e) =>
                  setFailing((prev) => ({
                    ...prev,
                    [kind]: e.target.checked,
                  }))
                }
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <Button onClick={run} disabled={busy} className={styles.runButton}>
          Run erasure{failingCount > 0 ? ` (${failingCount} set to fail)` : ""}
        </Button>

        <div className={styles.outputPanel}>
          {latest === null ? (
            <Verdict state="neutral">
              Nothing erased yet. Run the erasure above.
            </Verdict>
          ) : (
            <>
              <Verdict state="ok">
                {okCount === totalCount
                  ? `All ${totalCount} targets erased ${latest.subjectId}. One row landed.`
                  : `${okCount} of ${totalCount} targets erased ${latest.subjectId}; the rest failed and were captured, never thrown. One row still landed.`}
              </Verdict>

              <ul className={styles.targetList}>
                {latest.results.map((r) => (
                  <li
                    key={r.target}
                    className={styles.targetRow}
                    data-ok={r.ok}
                  >
                    <span className={styles.targetDot} aria-hidden="true" />
                    <span className={styles.targetName}>{r.target}</span>
                    <span className={styles.targetOutcome}>
                      {r.ok ? "ok" : (r.error ?? "failed")}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className={styles.register}>
                <dt>reason</dt>
                <dd>{latest.reason}</dd>
                <dt>at</dt>
                <dd>
                  {latest.at} (injected clock tick, runErasure never calls
                  Date.now() inline)
                </dd>
                <dt>audit rows written this session</dt>
                <dd>{rowsWritten}</dd>
              </dl>
            </>
          )}
        </div>

        <p className={styles.note}>
          Field-encrypted columns are not erased by these targets. They are
          erased by destroying the key: ERASURE_CRYPTO_SHRED = &quot;
          {ERASURE_CRYPTO_SHRED}&quot;, the event @caisson-sh/field-crypto mints
          into the WORM chain when a crypto-shred runs instead.
        </p>
      </div>
    </PokeShell>
  );
}
