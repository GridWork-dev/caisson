"use client";

// The standalone OSCAL module's deterministic proof: select one of the three shipped framework
// identities and generate the matching OSCAL v1.2.2 Assessment Plan, or break the injected clock
// and watch the REAL fail-closed validation the package ships (kernel's ValidationError, not a
// mirror of it). This component drives the real `toOscalAssessmentPlan` through
// `@caisson-sh/oscal-spine/browser` (ADR-0396) — the hand-ported mirror (oscal-spine-logic.ts) is
// deleted, and the framework identities are derived from the real shipped packs, never copied.
// Browser-safety is proven by the package's own static source-graph walk, not by a build.
import { useId, useMemo, useState } from "react";
import { CodeBlock, Radio, Select } from "@caisson-sh/ui/components";
import type { SelectOption } from "@caisson-sh/ui/components";
import {
  euAiAct,
  hipaaSecurity,
  soc2Tsc,
} from "@caisson-sh/frameworks-pack/browser";
import {
  OSCAL_VERSION,
  toOscalAssessmentPlan,
} from "@caisson-sh/oscal-spine/browser";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./frameworks-pack-poke.module.css";

// The three shipped packs' identities, derived (not copied) — exactly the
// OscalEvidencePackFramework triple the real function takes. Exported for the poke test.
export const SAMPLE_FRAMEWORKS = [soc2Tsc, hipaaSecurity, euAiAct].map(
  ({ id, title, version }) => ({ id, title, version }),
);

/** A fixed sample instant -- never `Date.now()` / an argless `new Date()` in a rendered path. */
export const SAMPLE_NOW = new Date("2026-07-25T12:00:00.000Z");

/** A deterministic UUID sequence, so the rendered document is stable across renders. */
export function makeCounterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

const OPTIONS: SelectOption[] = SAMPLE_FRAMEWORKS.map((framework) => ({
  value: framework.id,
  label: `${framework.title} (${framework.version})`,
}));

export default function OscalSpinePoke() {
  const uid = useId();
  const [frameworkId, setFrameworkId] = useState(
    SAMPLE_FRAMEWORKS[0]?.id ?? "soc2-tsc",
  );
  const [clockState, setClockState] = useState<"valid" | "invalid">("valid");
  const framework =
    SAMPLE_FRAMEWORKS.find((candidate) => candidate.id === frameworkId) ??
    SAMPLE_FRAMEWORKS[0];

  const outcome = useMemo(() => {
    if (framework === undefined) {
      return { document: null, error: "No framework selected." };
    }
    try {
      return {
        document: toOscalAssessmentPlan(framework, {
          now: clockState === "valid" ? SAMPLE_NOW : new Date(Number.NaN),
          newId: makeCounterIds(),
        }),
        error: null,
      };
    } catch (error) {
      return {
        document: null,
        error:
          error instanceof Error ? error.message : "Assessment Plan failed.",
      };
    }
  }, [clockState, framework]);

  return (
    <PokeShell
      label="@caisson-sh/oscal-spine"
      title="Choose a framework. Generate its Assessment Plan, or break the clock."
    >
      <div className={styles.layout}>
        <label className={styles.field} htmlFor={`${uid}-framework`}>
          Framework template
        </label>
        <div className={styles.selectWrap}>
          <Select
            id={`${uid}-framework`}
            options={OPTIONS}
            value={frameworkId}
            onChange={(event) => setFrameworkId(event.target.value)}
          />
        </div>

        <fieldset className={styles.customPanel}>
          <legend className={styles.legend}>Injected export clock</legend>
          <div className={styles.optionRow}>
            <Radio
              name={`${uid}-clock`}
              label="Fixed valid clock"
              checked={clockState === "valid"}
              onChange={() => setClockState("valid")}
              className={styles.option}
            />
            <Radio
              name={`${uid}-clock`}
              label="Invalid clock"
              checked={clockState === "invalid"}
              onChange={() => setClockState("invalid")}
              className={styles.option}
            />
          </div>
        </fieldset>

        <div className={styles.outputPanel}>
          {outcome.document === null ? (
            <Verdict state="fail">{outcome.error}</Verdict>
          ) : (
            <>
              <Verdict state="ok">
                Deterministic OSCAL v{OSCAL_VERSION} Assessment Plan generated
                for {framework?.title}.
              </Verdict>
              <CodeBlock
                label="toOscalAssessmentPlan output"
                code={JSON.stringify(outcome.document, null, 2)}
              />
            </>
          )}
        </div>

        <p className={styles.note}>
          The sample clock and UUID sequence are fixed, so the same selection
          produces the same document every time.
        </p>
      </div>
    </PokeShell>
  );
}
