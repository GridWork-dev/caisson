"use client";

// The frameworks-pack module's poke (ADR-0378 lock 2, kimi CANDIDATES.md section B build
// baseline) -- a live, deterministic clause-to-control mapper. Pick a real crosswalk reference
// from the shipped SOC 2 pack (or type your own) and watch it resolve to the canonical control(s)
// that cite it, exported as a real OSCAL v1.2.2 catalog document. Every function driving this
// component is the pure mirror in `frameworks-pack-logic.ts` (see that file's header for why the
// real packages aren't imported directly into a client bundle). Nothing here fetches, persists, or
// measures the visitor.
import { useId, useMemo, useState } from "react";
import { CodeBlock, Radio, Select } from "@caisson/ui/components";
import type { SelectOption } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  CUSTOM_CLAUSE_KEY,
  OSCAL_VERSION,
  SAMPLE_FRAMEWORK,
  SAMPLE_NOW,
  clauseKey,
  findControlsByClause,
  listClauses,
  makeCounterIds,
  toOscalCatalog,
} from "./frameworks-pack-logic";
import type { Framework } from "./frameworks-pack-logic";
import styles from "./frameworks-pack-poke.module.css";

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
      controls: lookup.matches,
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
      label="@caisson/frameworks-pack"
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
