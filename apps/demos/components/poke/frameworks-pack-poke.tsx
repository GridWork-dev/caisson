"use client";

// The frameworks-pack module's poke (ADR-0378 lock 2, kimi CANDIDATES.md section B build
// baseline) -- a live, deterministic clause-to-control mapper. Pick a real crosswalk reference
// from the shipped SOC 2 pack (or type your own) and watch it resolve to the canonical control(s)
// that cite it, exported as a real OSCAL v1.2.2 catalog document.
//
// This component drives the REAL packages through their browser-safe entries
// (`@caisson-sh/frameworks-pack/browser` + `@caisson-sh/oscal-spine/browser`, ADR-0396) -- the
// hand-ported mirror (frameworks-pack-logic.ts) is deleted, and SAMPLE_FRAMEWORK is a SELECTION
// over the real `soc2Tsc` pack, never a copy of it. Browser-safety is proven by each package's
// own static source-graph walk (browser-safety.test.ts), NOT by a build -- a bundler substitutes
// node builtins instead of failing on them. The real toOscalCatalog throws kernel's
// ValidationError on an invalid clock; this poke never renders that path (SAMPLE_NOW is a fixed
// valid instant). Nothing here fetches, persists, or measures the visitor.
import { useId, useMemo, useState } from "react";
import { CodeBlock, Radio, Select } from "@caisson-sh/ui/components";
import type { SelectOption } from "@caisson-sh/ui/components";
import { soc2Tsc } from "@caisson-sh/frameworks-pack/browser";
import type {
  CanonicalControl,
  Framework,
} from "@caisson-sh/frameworks-pack/browser";
import { OSCAL_VERSION, toOscalCatalog } from "@caisson-sh/oscal-spine/browser";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./frameworks-pack-poke.module.css";

// ---- Sample data: six of the SOC2-TSC pack's seventeen own-authored controls, SELECTED from the
// real `soc2Tsc` export (same object references -- the poke test pins reference identity, so
// nothing here can drift from the package). Labeled as a sample in the UI. ----------------------

export const SAMPLE_CONTROL_IDS = new Set<string>([
  "GOVERNANCE.SECURITY-RESPONSIBILITY",
  "ACCESS-CONTROL.LOGICAL",
  "ACCESS-CONTROL.MFA",
  "DATA-PROTECTION.ENCRYPTION",
  "DATA-PROTECTION.DISPOSAL",
  "AUDIT.IMMUTABLE-LOG",
]);

export const SAMPLE_FRAMEWORK: Framework = {
  ...soc2Tsc,
  controls: soc2Tsc.controls.filter((c) => SAMPLE_CONTROL_IDS.has(c.id)),
};

// ---- Clause-to-control lookup (composition over the real model -- original to this poke, not a
// mirror of any single package function). Exported for the poke test. ---------------------------

/** Sentinel Select value for "type your own clause" -- never a real (framework, reference) pair. */
export const CUSTOM_CLAUSE_KEY = "__custom__";

/** Encode a (framework, reference) pair as one opaque Select option value. */
export function clauseKey(framework: string, reference: string): string {
  return `${framework}::${reference}`;
}

export interface ClauseOption {
  readonly key: string;
  readonly framework: string;
  readonly reference: string;
  readonly controlCount: number;
}

/**
 * Every distinct (framework, reference) crosswalk pair cited anywhere in `framework`'s controls,
 * with how many controls cite it. Sorted by reference then framework for a stable render order.
 */
export function listClauses(framework: Framework): ClauseOption[] {
  const counts = new Map<
    string,
    { framework: string; reference: string; count: number }
  >();
  for (const control of framework.controls) {
    for (const x of control.crosswalk) {
      const key = clauseKey(x.framework, x.reference);
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          framework: x.framework,
          reference: x.reference,
          count: 1,
        });
      }
    }
  }
  return [...counts.entries()]
    .map(([key, v]) => ({
      key,
      framework: v.framework,
      reference: v.reference,
      controlCount: v.count,
    }))
    .sort(
      (a, b) =>
        a.reference.localeCompare(b.reference) ||
        a.framework.localeCompare(b.framework),
    );
}

export interface ClauseLookupResult {
  readonly clauseFramework: string;
  readonly clauseReference: string;
  readonly matches: readonly CanonicalControl[];
}

/** Every control in `framework` whose crosswalk cites `(clauseFramework, clauseReference)` exactly. */
export function findControlsByClause(
  framework: Framework,
  clauseFramework: string,
  clauseReference: string,
): ClauseLookupResult {
  const fw = clauseFramework.trim();
  const ref = clauseReference.trim();
  const matches = framework.controls.filter((c) =>
    c.crosswalk.some((x) => x.framework === fw && x.reference === ref),
  );
  return { clauseFramework: fw, clauseReference: ref, matches };
}

// ---- Deterministic sample clock/id seam for the poke's rendered output -------------------------

/** A fixed sample instant -- never `Date.now()` / an argless `new Date()` in a rendered path. */
export const SAMPLE_NOW = new Date("2026-07-18T00:00:00.000Z");

/**
 * A deterministic UUID sequence -- mirrors the real test suite's own `counterIds()` helper
 * (oscal-spine/src/evidence/oscal-catalog-export.test.ts) so the rendered catalog is
 * reproducible across renders instead of drawing a fresh UUID on every keystroke.
 */
export function makeCounterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

// Every real (framework, reference) crosswalk pair the sample pack ships, plus the "type your own"
// escape hatch -- computed once from SAMPLE_FRAMEWORK (a constant), never per render.
const CLAUSE_OPTIONS = listClauses(SAMPLE_FRAMEWORK);
const SELECT_OPTIONS: SelectOption[] = [
  ...CLAUSE_OPTIONS.map((o) => ({
    value: o.key,
    label: `${o.framework} ${o.reference} (${o.controlCount} control${o.controlCount === 1 ? "" : "s"})`,
  })),
  { value: CUSTOM_CLAUSE_KEY, label: "Custom clause (type your own)" },
];

const DEFAULT_KEY = clauseKey("SOC2-TSC", "CC6.1");
const CATALOG_TITLE = "Caisson Canonical Control Catalog";

export default function FrameworksPackPoke() {
  const uid = useId();
  const [selectedKey, setSelectedKey] = useState<string>(DEFAULT_KEY);
  const [customFramework, setCustomFramework] = useState<
    "SOC2-TSC" | "HIPAA-Security"
  >("SOC2-TSC");
  const [customReference, setCustomReference] = useState("CC9.9");

  const isCustom = selectedKey === CUSTOM_CLAUSE_KEY;
  const picked = CLAUSE_OPTIONS.find((o) => o.key === selectedKey);
  const activeFramework = isCustom
    ? customFramework
    : (picked?.framework ?? "SOC2-TSC");
  const activeReference = isCustom
    ? customReference
    : (picked?.reference ?? "CC6.1");

  const lookup = useMemo(
    () =>
      findControlsByClause(SAMPLE_FRAMEWORK, activeFramework, activeReference),
    [activeFramework, activeReference],
  );

  const oscalDoc = useMemo(() => {
    if (lookup.matches.length === 0) return null;
    const synthetic: Framework = {
      ...SAMPLE_FRAMEWORK,
      controls: [...lookup.matches],
    };
    return toOscalCatalog([synthetic], {
      now: SAMPLE_NOW,
      newId: makeCounterIds(),
      title: CATALOG_TITLE,
      version: SAMPLE_FRAMEWORK.version,
    });
  }, [lookup]);

  return (
    <PokeShell
      label="@caisson-sh/frameworks-pack"
      title="Pick a framework clause. See which control it maps to, if any."
    >
      <div className={styles.layout}>
        <label className={styles.field} htmlFor={`${uid}-select`}>
          Crosswalk clause (framework, requirement reference)
        </label>
        <div className={styles.selectWrap}>
          <Select
            id={`${uid}-select`}
            options={SELECT_OPTIONS}
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
          />
        </div>

        {isCustom ? (
          <fieldset className={styles.customPanel}>
            <legend className={styles.legend}>Custom clause</legend>
            <div className={styles.optionRow}>
              <Radio
                name={`${uid}-fw`}
                label="SOC2-TSC"
                checked={customFramework === "SOC2-TSC"}
                onChange={() => setCustomFramework("SOC2-TSC")}
                className={styles.option}
              />
              <Radio
                name={`${uid}-fw`}
                label="HIPAA-Security"
                checked={customFramework === "HIPAA-Security"}
                onChange={() => setCustomFramework("HIPAA-Security")}
                className={styles.option}
              />
            </div>
            <label className={styles.field} htmlFor={`${uid}-ref`}>
              Requirement reference
            </label>
            <input
              id={`${uid}-ref`}
              className={styles.input}
              type="text"
              value={customReference}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setCustomReference(e.target.value)}
            />
          </fieldset>
        ) : (
          <p className={styles.clauseCount}>
            {CLAUSE_OPTIONS.length} real crosswalk references ship in this
            sample; pick &quot;Custom clause&quot; to type one that is not among
            them.
          </p>
        )}

        <div className={styles.outputPanel}>
          {lookup.matches.length === 0 ? (
            <Verdict state="fail">
              No canonical control in this sample maps to{" "}
              {lookup.clauseFramework || "(empty)"}{" "}
              {lookup.clauseReference || "(empty)"}.
            </Verdict>
          ) : (
            <Verdict state="ok">
              {lookup.matches.length} control
              {lookup.matches.length === 1 ? "" : "s"} map to{" "}
              {lookup.clauseFramework} {lookup.clauseReference}, exported below
              as an OSCAL v{OSCAL_VERSION} catalog.
            </Verdict>
          )}

          {lookup.matches.length > 0 ? (
            <ul className={styles.controlList}>
              {lookup.matches.map((c) => (
                <li key={c.id} className={styles.controlCard}>
                  <p className={styles.controlId}>{c.id}</p>
                  <p className={styles.controlTitle}>
                    {c.title}{" "}
                    <span className={styles.controlFamily}>({c.family})</span>
                  </p>
                  <p className={styles.controlStatement}>{c.statement}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              Try SOC2-TSC CC6.1 from the list above, it maps to three controls
              at once.
            </p>
          )}

          {oscalDoc ? (
            <CodeBlock
              label="toOscalCatalog output"
              code={JSON.stringify(oscalDoc, null, 2)}
            />
          ) : null}
        </div>

        <p className={styles.note}>
          Six of the SOC 2 pack&apos;s seventeen own-authored controls, used
          here as a sample crosswalk index. The clock and document id are fixed
          sample values, not a live export timestamp.
        </p>
      </div>
    </PokeShell>
  );
}
