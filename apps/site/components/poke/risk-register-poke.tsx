"use client";

// The risk-register module's poke (ADR-0378 lock 2, kimi CANDIDATES-KIMI.md section B). Move the
// likelihood x impact sliders and watch the residual come out of computeResidual(), never typed
// in directly. Recording an override never edits that computed value: it appends a separate,
// accountable exception record (kind "risk.residual-overridden") that governs effectiveResidual
// going forward, exactly like a real register does. Every function driving this component is the
// pure mirror in `risk-register-logic.ts` (see that file's header for why the real package isn't
// imported directly into a client bundle). Nothing here fetches, persists, or measures the
// visitor.
import { useId, useMemo, useState } from "react";
import { Button, StatusChip } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  IMPACTS,
  LIKELIHOODS,
  SAMPLE_IMPACT,
  SAMPLE_LIKELIHOOD,
  SAMPLE_NOW,
  SAMPLE_OWNER,
  SAMPLE_RISK_ID,
  SAMPLE_SUBJECT,
  computeResidual,
  deriveEffectiveResidual,
  recordResidualOverride,
  residualMatrix,
} from "./risk-register-logic";
import type {
  Impact,
  Likelihood,
  RecordOverrideOutcome,
  RiskResidualOverrideRecord,
} from "./risk-register-logic";
import styles from "./risk-register-poke.module.css";

const LIKELIHOOD_LABEL: Record<Likelihood, string> = {
  rare: "Rare",
  unlikely: "Unlikely",
  possible: "Possible",
  likely: "Likely",
  "almost-certain": "Almost certain",
};
const IMPACT_LABEL: Record<Impact, string> = {
  negligible: "Negligible",
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  severe: "Severe",
};

const MATRIX = residualMatrix();

export default function RiskRegisterPoke() {
  const uid = useId();
  const [likelihoodIdx, setLikelihoodIdx] = useState(
    LIKELIHOODS.indexOf(SAMPLE_LIKELIHOOD),
  );
  const [impactIdx, setImpactIdx] = useState(IMPACTS.indexOf(SAMPLE_IMPACT));
  const likelihood = LIKELIHOODS[likelihoodIdx] ?? SAMPLE_LIKELIHOOD;
  const impact = IMPACTS[impactIdx] ?? SAMPLE_IMPACT;
  const computed = useMemo(
    () => computeResidual(likelihood, impact),
    [likelihood, impact],
  );

  const [overrideLikelihoodIdx, setOverrideLikelihoodIdx] = useState(
    LIKELIHOODS.indexOf("unlikely"),
  );
  const [overrideImpactIdx, setOverrideImpactIdx] = useState(
    IMPACTS.indexOf("minor"),
  );
  const overrideLikelihood = LIKELIHOODS[overrideLikelihoodIdx] ?? "unlikely";
  const overrideImpact = IMPACTS[overrideImpactIdx] ?? "minor";
  const [who, setWho] = useState("");
  const [why, setWhy] = useState("");

  const [chain, setChain] = useState<readonly RiskResidualOverrideRecord[]>([]);
  const [lastOutcome, setLastOutcome] = useState<RecordOverrideOutcome | null>(
    null,
  );

  const latestOverride =
    chain.length === 0 ? null : (chain[chain.length - 1] ?? null);
  const effective = deriveEffectiveResidual(computed, latestOverride);

  function onRecord(): void {
    const outcome = recordResidualOverride({
      riskId: SAMPLE_RISK_ID,
      computed,
      overrideLikelihood,
      overrideImpact,
      who,
      why,
      now: SAMPLE_NOW,
    });
    setLastOutcome(outcome);
    if (outcome.outcome === "recorded") {
      setChain((prev) => [...prev, outcome.record]);
    }
  }

  return (
    <PokeShell
      label="@caisson/risk-register"
      title="Move the sliders. The residual is computed, never typed in."
    >
      <div className={styles.layout}>
        <p className={styles.field}>
          Sample register row {SAMPLE_RISK_ID}, {SAMPLE_SUBJECT}, owner{" "}
          {SAMPLE_OWNER}.
        </p>

        <div className={styles.sliders}>
          <label className={styles.sliderField} htmlFor={`${uid}-likelihood`}>
            <span className={styles.sliderLabel}>
              Likelihood, {LIKELIHOOD_LABEL[likelihood]} (ordinal{" "}
              {likelihoodIdx + 1})
            </span>
            <input
              id={`${uid}-likelihood`}
              className={styles.range}
              type="range"
              min={0}
              max={LIKELIHOODS.length - 1}
              step={1}
              value={likelihoodIdx}
              onChange={(e) => setLikelihoodIdx(Number(e.target.value))}
            />
          </label>
          <label className={styles.sliderField} htmlFor={`${uid}-impact`}>
            <span className={styles.sliderLabel}>
              Impact, {IMPACT_LABEL[impact]} (ordinal {impactIdx + 1})
            </span>
            <input
              id={`${uid}-impact`}
              className={styles.range}
              type="range"
              min={0}
              max={IMPACTS.length - 1}
              step={1}
              value={impactIdx}
              onChange={(e) => setImpactIdx(Number(e.target.value))}
            />
          </label>
        </div>

        <div className={styles.residualRow}>
          <div className={styles.residualStat}>
            <span className={styles.residualLabel}>computeResidual()</span>
            <span className={styles.residualValue}>{computed}</span>
          </div>
          <div className={styles.residualStat}>
            <span className={styles.residualLabel}>effectiveResidual</span>
            <span
              className={styles.residualValue}
              data-overridden={latestOverride === null ? undefined : ""}
            >
              {effective}
            </span>
          </div>
        </div>
        <p className={styles.srOnly} role="status" aria-live="polite">
          Computed residual {computed} of 25.
          {latestOverride === null
            ? ""
            : ` An operator override governs the effective residual, ${effective}.`}
        </p>

        <div className={styles.matrix} aria-hidden="true">
          {MATRIX.map((cell) => {
            const active =
              cell.likelihood === likelihood && cell.impact === impact;
            return (
              <span
                key={`${cell.likelihood}-${cell.impact}`}
                className={styles.cell}
                data-active={active ? "" : undefined}
              >
                {cell.residual}
              </span>
            );
          })}
        </div>
        <p className={styles.note}>
          The full LIKELIHOOD_ORDINAL x IMPACT_ORDINAL grid, 1-25. Current cell
          highlighted.
        </p>

        <fieldset className={styles.overridePanel}>
          <legend className={styles.legend}>
            recordResidualOverride(): a chained exception, never a silent
            overwrite
          </legend>

          <div className={styles.sliders}>
            <label
              className={styles.sliderField}
              htmlFor={`${uid}-override-likelihood`}
            >
              <span className={styles.sliderLabel}>
                Override likelihood, {LIKELIHOOD_LABEL[overrideLikelihood]}
              </span>
              <input
                id={`${uid}-override-likelihood`}
                className={styles.range}
                type="range"
                min={0}
                max={LIKELIHOODS.length - 1}
                step={1}
                value={overrideLikelihoodIdx}
                onChange={(e) =>
                  setOverrideLikelihoodIdx(Number(e.target.value))
                }
              />
            </label>
            <label
              className={styles.sliderField}
              htmlFor={`${uid}-override-impact`}
            >
              <span className={styles.sliderLabel}>
                Override impact, {IMPACT_LABEL[overrideImpact]}
              </span>
              <input
                id={`${uid}-override-impact`}
                className={styles.range}
                type="range"
                min={0}
                max={IMPACTS.length - 1}
                step={1}
                value={overrideImpactIdx}
                onChange={(e) => setOverrideImpactIdx(Number(e.target.value))}
              />
            </label>
          </div>

          <label className={styles.textField} htmlFor={`${uid}-who`}>
            who
            <input
              id={`${uid}-who`}
              className={styles.textInput}
              type="text"
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder="Leave blank to watch it get refused"
            />
          </label>
          <label className={styles.textField} htmlFor={`${uid}-why`}>
            why
            <textarea
              id={`${uid}-why`}
              className={styles.textarea}
              rows={2}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="Leave blank to watch it get refused"
            />
          </label>

          <Button type="button" onClick={onRecord}>
            Record override
          </Button>
        </fieldset>

        {lastOutcome === null ? null : lastOutcome.outcome === "rejected" ? (
          <div className={styles.outputPanel}>
            <Verdict state="fail">Refused. {lastOutcome.error.message}</Verdict>
            <dl className={styles.register}>
              <dt>code</dt>
              <dd>{lastOutcome.error.code}</dd>
              <dt>httpStatus</dt>
              <dd>{lastOutcome.error.httpStatus}</dd>
            </dl>
            <p className={styles.note}>
              {SAMPLE_RISK_ID}&apos;s residual stays exactly what
              computeResidual derived. No risk.residual-overridden record is
              appended.
            </p>
          </div>
        ) : (
          <div className={styles.outputPanel}>
            <Verdict state="ok">
              Recorded. {SAMPLE_RISK_ID}&apos;s computed residual is untouched,
              a chained exception now governs the effective residual.
            </Verdict>
            <dl className={styles.register}>
              <dt>kind</dt>
              <dd>{lastOutcome.record.kind}</dd>
              <dt>computed</dt>
              <dd>{lastOutcome.record.computed}</dd>
              <dt>override</dt>
              <dd>{lastOutcome.record.override}</dd>
              <dt>who</dt>
              <dd>{lastOutcome.record.who}</dd>
              <dt>why</dt>
              <dd>{lastOutcome.record.why}</dd>
              <dt>at</dt>
              <dd>{lastOutcome.record.at}</dd>
            </dl>
          </div>
        )}

        {chain.length === 0 ? null : (
          <div className={styles.chainBlock}>
            <p className={styles.field}>
              {chain.length} chained exception{chain.length === 1 ? "" : "s"} on
              record for {SAMPLE_RISK_ID}, oldest first.
            </p>
            <ul className={styles.chainList}>
              {chain.map((record, i) => (
                <li key={i} className={styles.chainRow}>
                  <StatusChip
                    label={`computed ${record.computed}`}
                    tone="muted"
                  />
                  <StatusChip
                    label={`override ${record.override}`}
                    tone="accent"
                  />
                  <span className={styles.chainWho}>{record.who}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PokeShell>
  );
}
