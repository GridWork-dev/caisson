"use client";

// The risk-register module's poke (ADR-0378 lock 2, kimi CANDIDATES-KIMI.md section B). Move the
// likelihood x impact sliders and watch the residual come out of computeResidual(), never typed
// in directly. Recording an override never edits that computed value: it appends a separate,
// accountable exception record (kind "risk.residual-overridden") that governs effectiveResidual
// going forward, exactly like a real register does.
//
// This component drives the REAL @caisson-sh/risk-register — the hand-ported mirror
// (risk-register-logic.ts) is deleted. The package's `.` barrel is browser-safe (its only
// audit-worm imports are statement-level `import type`, erased at emit; @caisson-sh/kernel's `.`
// barrel has been browser-safe since the ./node split), so the real defineRiskEntry /
// buildRiskTreatmentPlan / computeResidual run in the client bundle, and the real ASYNC
// recordResidualOverride runs against an injected in-memory chain port (its only I/O is the
// caller-injected `chain.append`; all validation is synchronous and runs before the first await).
// Proven by a static source-graph walk in risk-register-poke.test.ts — NOT by a build; a bundler
// substitutes node builtins instead of failing on them. Nothing here fetches, persists, or
// measures the visitor; the clock is the fixed SAMPLE_NOW (no Date.now(), no argless new Date()).
import { useId, useMemo, useRef, useState } from "react";
import { Button, StatusChip } from "@caisson-sh/ui/components";
import { ValidationError } from "@caisson-sh/kernel";
import type { AuditChainEntry, JsonValue } from "@caisson-sh/kernel";
import type { AppendResult, AuditChainStore } from "@caisson-sh/audit-worm";
import {
  Impact,
  Likelihood,
  buildRiskTreatmentPlan,
  computeResidual,
  defineRiskEntry,
  recordResidualOverride,
} from "@caisson-sh/risk-register";
import type {
  Residual,
  RiskResidualOverrideRecord,
} from "@caisson-sh/risk-register";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./risk-register-poke.module.css";

// ---- Sample register row (the golden fixture's own R-1 risk: possible x major) -----------------
// Pinned to packages/risk-register/src/__golden__/risk-treatment-plan.txt so the poke's fixture
// IS the package's fixture — risk-register-poke.test.ts asserts the exact golden match.

export const SAMPLE_RISK_ID = "R-1";
export const SAMPLE_SUBJECT = "R-1 lane";
export const SAMPLE_OWNER = "safety@example.com";
export const SAMPLE_LIKELIHOOD: Likelihood = "possible";
export const SAMPLE_IMPACT: Impact = "major";
export const SAMPLE_TREATMENT_PLAN = "plan";
export const SAMPLE_EVIDENCE_DIGEST = "a".repeat(64);
export const SAMPLE_TENANT_ID = "tenant-acme";
export const SAMPLE_ACCOUNT_ID = "acct-sample";
/** Fixed sample instant, no Date.now() / argless new Date() in any rendered path. */
export const SAMPLE_NOW = new Date("2026-07-22T00:00:00.000Z");

export const LIKELIHOODS = Likelihood.options;
export const IMPACTS = Impact.options;

/** Not a hash, and deliberately not hash-shaped. Real chain hashing is `chainEntry` in
 *  @caisson-sh/kernel/node (node:crypto) and cannot run in a browser, so this double never mints
 *  one and the UI never renders these fields — only the returned `record` and the append count.
 *  It implements nothing the package implements; it only satisfies the injected
 *  `Pick<AuditChainStore, "append">` port so the REAL recordResidualOverride runs unmodified. */
export const NOT_A_CHAIN_HASH = "not-a-real-chain-hash-browser-poke";

export function browserChainDouble(): Pick<AuditChainStore, "append"> {
  const entries: AuditChainEntry[] = [];
  return {
    append: (_accountId: string, payload: JsonValue): Promise<AppendResult> => {
      const entry: AuditChainEntry = {
        seq: entries.length,
        prevHash: entries.at(-1)?.hash ?? null,
        payload,
        hash: NOT_A_CHAIN_HASH,
      };
      entries.push(entry);
      return Promise.resolve({
        entry,
        anchor: { length: entries.length, tipHash: NOT_A_CHAIN_HASH },
      });
    },
  };
}

/** One cell of the full likelihood x impact grid — a rendering enumeration over the real
 *  primitive (the ordinal tables live in the package's model.ts, nowhere here). */
export interface ResidualCell {
  readonly likelihood: Likelihood;
  readonly impact: Impact;
  readonly residual: Residual;
}

/** Every likelihood x impact combination the real ordinal product can produce (25 cells). */
export function residualMatrix(): readonly ResidualCell[] {
  const cells: ResidualCell[] = [];
  for (const likelihood of LIKELIHOODS) {
    for (const impact of IMPACTS) {
      cells.push({
        likelihood,
        impact,
        residual: computeResidual(likelihood, impact),
      });
    }
  }
  return cells;
}

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

interface Rejection {
  readonly code: string;
  readonly httpStatus: number;
  readonly message: string;
}

export default function RiskRegisterPoke() {
  const uid = useId();
  const [likelihoodIdx, setLikelihoodIdx] = useState(
    LIKELIHOODS.indexOf(SAMPLE_LIKELIHOOD),
  );
  const [impactIdx, setImpactIdx] = useState(IMPACTS.indexOf(SAMPLE_IMPACT));
  const likelihood = LIKELIHOODS[likelihoodIdx] ?? SAMPLE_LIKELIHOOD;
  const impact = IMPACTS[impactIdx] ?? SAMPLE_IMPACT;

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

  const chainRef = useRef(browserChainDouble());
  const [chain, setChain] = useState<readonly RiskResidualOverrideRecord[]>([]);
  const [rejection, setRejection] = useState<Rejection | null>(null);

  const latestOverride =
    chain.length === 0 ? null : (chain[chain.length - 1] ?? null);

  // The real authoring path: the entry's residual is derived by the package, never typed in.
  const entry = useMemo(
    () =>
      defineRiskEntry({
        riskId: SAMPLE_RISK_ID,
        subject: SAMPLE_SUBJECT,
        likelihood,
        impact,
        treatmentPlan: SAMPLE_TREATMENT_PLAN,
        owner: SAMPLE_OWNER,
        evidenceDigest: SAMPLE_EVIDENCE_DIGEST,
        crosswalk: [],
      }),
    [likelihood, impact],
  );

  // effectiveResidual comes off the real artifact builder's row — the treatment-plan invariant
  // lives in exactly one place: the package. (Conditional key spread, never an explicit
  // `undefined` — exactOptionalPropertyTypes, matching treatment-plan.ts's own convention.)
  const { plan } = useMemo(
    () =>
      buildRiskTreatmentPlan({
        tenantId: SAMPLE_TENANT_ID,
        risks: [entry],
        ...(latestOverride === null
          ? {}
          : { overridesByRiskId: new Map([[SAMPLE_RISK_ID, latestOverride]]) }),
      }),
    [entry, latestOverride],
  );
  const row = plan.risks[0];
  const computed = row?.computedResidual ?? computeResidual(likelihood, impact);
  const effective = row?.effectiveResidual ?? computed;

  function onRecord(): void {
    void (async () => {
      try {
        const { record } = await recordResidualOverride({
          chain: chainRef.current,
          accountId: SAMPLE_ACCOUNT_ID,
          riskId: SAMPLE_RISK_ID,
          computed: entry.residual,
          overrideLikelihood,
          overrideImpact,
          who,
          why,
          now: SAMPLE_NOW,
        });
        setRejection(null);
        setChain((prev) => [...prev, record]);
      } catch (err) {
        if (!(err instanceof ValidationError)) throw err;
        setRejection({
          code: err.code,
          httpStatus: err.httpStatus,
          message: err.message,
        });
      }
    })();
  }

  return (
    <PokeShell
      label="@caisson-sh/risk-register"
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

        {rejection !== null ? (
          <div className={styles.outputPanel}>
            <Verdict state="fail">Refused. {rejection.message}</Verdict>
            <dl className={styles.register}>
              <dt>code</dt>
              <dd>{rejection.code}</dd>
              <dt>httpStatus</dt>
              <dd>{rejection.httpStatus}</dd>
            </dl>
            <p className={styles.note}>
              {SAMPLE_RISK_ID}&apos;s residual stays exactly what
              computeResidual derived. No risk.residual-overridden record is
              appended.
            </p>
          </div>
        ) : latestOverride === null ? null : (
          <div className={styles.outputPanel}>
            <Verdict state="ok">
              Recorded. {SAMPLE_RISK_ID}&apos;s computed residual is untouched,
              a chained exception now governs the effective residual.
            </Verdict>
            <dl className={styles.register}>
              <dt>kind</dt>
              <dd>{latestOverride.kind}</dd>
              <dt>computed</dt>
              <dd>{latestOverride.computed}</dd>
              <dt>override</dt>
              <dd>{latestOverride.override}</dd>
              <dt>who</dt>
              <dd>{latestOverride.who}</dd>
              <dt>why</dt>
              <dd>{latestOverride.why}</dd>
              <dt>at</dt>
              <dd>{latestOverride.at}</dd>
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
