"use client";

// The retention-runner module's poke (ADR-0378 lock 2, kimi CANDIDATES §B "Guard & gate" row) — a
// live, deterministic run of the package's erasure fan-out against a fixed sample subject. Every
// function driving this component is the pure mirror in `retention-runner-logic.ts` (see that
// file's header for why the real package isn't imported directly into a client bundle). Nothing
// here fetches, persists, or measures the visitor.
import { useId, useMemo, useState } from "react";
import { Button, Checkbox, Radio } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  ERASURE_CRYPTO_SHRED,
  ERASURE_REASONS,
  REFERENCE_TARGET_NAMES,
  createCaptureAuditSink,
  createSampleTarget,
  runErasure,
} from "./retention-runner-logic";
import type {
  ErasureReason,
  ReferenceTargetName,
  RetentionRunResult,
} from "./retention-runner-logic";
import styles from "./retention-runner-poke.module.css";

// Fixed sample data-subject identifiers (retention-runner's types.ts assumes no shape for these).
// Labeled as a sample below, never generated per visit.
const SAMPLE_SUBJECT_ID = "sub_9f21";
const SAMPLE_TENANT_ID = "ten_launchco";

const REASON_LABELS: Record<ErasureReason, string> = {
  auto_90d: "auto_90d, the recurring scheduled sweep",
  ccpa_request: "ccpa_request, a subject's erasure request",
  operator_manual: "operator_manual, an operator-triggered erasure",
};

type FailingState = Record<ReferenceTargetName, boolean>;

const NO_FAILURES: FailingState = {
  "object-storage-purge": false,
  "cascade-db-delete": false,
  "orphan-record-sweep": false,
};

export default function RetentionRunnerPoke() {
  const uid = useId();
  const [reason, setReason] = useState<ErasureReason>("ccpa_request");
  const [failing, setFailing] = useState<FailingState>(NO_FAILURES);
  const [tick, setTick] = useState(0);
  const [latest, setLatest] = useState<RetentionRunResult | null>(null);
  const [rowsWritten, setRowsWritten] = useState(0);

  const failingCount = useMemo(
    () => REFERENCE_TARGET_NAMES.filter((name) => failing[name]).length,
    [failing],
  );

  function run() {
    const sink = createCaptureAuditSink();
    const targets = REFERENCE_TARGET_NAMES.map((name) =>
      createSampleTarget(name, failing[name]),
    );
    const nextTick = tick + 1;
    void runErasure(
      { subjectId: SAMPLE_SUBJECT_ID, tenantId: SAMPLE_TENANT_ID, reason },
      targets,
      sink,
      () => nextTick * 1_000,
    ).then((row) => {
      setTick(nextTick);
      setLatest(row);
      setRowsWritten((n) => n + sink.rows.length);
    });
  }

  const okCount = latest?.results.filter((r) => r.ok).length ?? 0;
  const totalCount = latest?.results.length ?? 0;

  return (
    <PokeShell
      label="@caisson/retention-runner"
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
            {REFERENCE_TARGET_NAMES.map((name) => (
              <Checkbox
                key={name}
                label={`Simulate ${name} failure`}
                checked={failing[name]}
                onChange={(e) =>
                  setFailing((prev) => ({
                    ...prev,
                    [name]: e.target.checked,
                  }))
                }
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <Button onClick={run} className={styles.runButton}>
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
          {ERASURE_CRYPTO_SHRED}&quot;, the event @caisson/field-crypto mints
          into the WORM chain when a crypto-shred runs instead.
        </p>
      </div>
    </PokeShell>
  );
}
