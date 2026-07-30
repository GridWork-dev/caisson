"use client";

// The trust-page module's poke (ADR-0378 lock 2) — a live, deterministic run of the package's
// allowlist-based redaction gate. This component drives the REAL `@caisson/trust-page` and
// `@caisson/artifact-render` code, not a mirror: the kernel `.` barrel is browser-safe (the node-only
// half moved to "@caisson/kernel/node"), so both packages now bundle into a client component and the
// hand-ported `trust-page-logic.ts` mirror this file used to import is deleted. Nothing here fetches,
// persists, or measures the visitor; `generateTrustPage` is pure (no I/O, no clock, no id minting).
import { useId, useMemo, useState } from "react";
import { Checkbox } from "@caisson/ui/components";
import { redactToAllowlist } from "@caisson/artifact-render";
import type { EvidencePackManifest } from "@caisson/compliance-core";
import {
  DEFAULT_TRUST_PAGE_ALLOWLIST,
  flattenManifestFacts,
  generateTrustPage,
} from "@caisson/trust-page";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./trust-page-poke.module.css";

/**
 * The fixed sample evidence pack, visibly labeled as a sample in the UI — the exact fixture
 * `packages/trust-page/src/render.test.ts` golden-pins its output against, so what renders below is
 * byte-identical to the committed golden fixture on the default allowlist. The `DO-NOT-LEAK` markers
 * are the point: they are real captured facts that the default allowlist refuses to release. No
 * Date.now(), no Math.random(), no argless `new Date()` — the same toggles always render the same
 * bytes.
 */
const SAMPLE_MANIFEST: EvidencePackManifest = {
  formatVersion: "2",
  tenantId: "tenant-DO-NOT-LEAK-9f3a2c",
  framework: {
    id: "soc2-tsc",
    title: "SOC 2 — Trust Services Criteria",
    version: "2024.1",
  },
  chainAnchor: {
    length: 3,
    tipHash: "f".repeat(64),
    genesisHash: "e".repeat(64),
  },
  crosswalkRollup: {
    cells: [
      {
        framework: "SOC2-TSC",
        reference: "CC7.2",
        canonicalControlIds: ["AUDIT.IMMUTABLE-LOG"],
        status: "ready",
        claim: "maps-to",
        evidencePointers: ["AUDIT.IMMUTABLE-LOG"],
      },
    ],
  },
  controls: [
    {
      controlId: "AUDIT.IMMUTABLE-LOG",
      title: "DO-NOT-LEAK-CONTROL-TITLE-8b21",
      family: "Audit",
      statement: "append-only hash-chained log anchored in WORM",
      crosswalk: [],
      evidence: [
        {
          collectorId: "substrate.chain-verify",
          title: "Audit chain verifies",
          summary: "the chain verifies against its anchor",
          status: "pass",
          facts: { valid: true },
          manualSlots: [],
        },
      ],
      readiness: "ready",
    },
  ],
  summary: {
    totalControls: 1,
    controlsReady: 1,
    controlsWithGaps: 0,
    totalEvidenceItems: 1,
    posture: "1 of 1 controls evidence-ready; no gaps recorded.",
  },
};

/** The full universe of facts this sample pack can produce — the ceiling the allowlist filters down
 *  from, straight off the package's own `flattenManifestFacts`. */
const SAMPLE_FACTS = flattenManifestFacts(SAMPLE_MANIFEST);
const ALL_FACT_KEYS = Object.keys(SAMPLE_FACTS);
const TAMPER_SUGGESTION = "internal.debugDump";

export default function TrustPagePoke() {
  const uid = useId();
  const [allowlist, setAllowlist] = useState<ReadonlySet<string>>(
    () => new Set(DEFAULT_TRUST_PAGE_ALLOWLIST),
  );
  const [tamperKey, setTamperKey] = useState("");

  function toggle(key: string) {
    setAllowlist((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const tamperKeyTrim = tamperKey.trim();
  const effectiveAllowlist = useMemo(() => {
    const set = new Set(allowlist);
    if (tamperKeyTrim !== "") set.add(tamperKeyTrim);
    return [...set];
  }, [allowlist, tamperKeyTrim]);

  const page = useMemo(
    () => generateTrustPage(SAMPLE_MANIFEST, { allowlist: effectiveAllowlist }),
    [effectiveAllowlist],
  );

  // The same gate the generator runs internally, surfaced so the tamper verdict below reports what
  // actually survived redaction rather than re-deriving the rule.
  const releasedFacts = useMemo(
    () => redactToAllowlist(SAMPLE_FACTS, effectiveAllowlist),
    [effectiveAllowlist],
  );
  const tamperLeaked =
    tamperKeyTrim !== "" && Object.hasOwn(releasedFacts, tamperKeyTrim);

  return (
    <PokeShell
      label="@caisson/trust-page"
      title="Toggle a fact into the allowlist. Watch it, and only it, reach the page."
    >
      <div className={styles.layout}>
        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Evidence-pack facts (sample, tenant-scoped)
          </legend>
          <div className={styles.checkGrid}>
            {ALL_FACT_KEYS.map((key) => (
              <Checkbox
                key={key}
                label={`${key}: ${String(SAMPLE_FACTS[key])}`}
                checked={allowlist.has(key)}
                onChange={() => {
                  toggle(key);
                }}
                className={styles.checkItem}
              />
            ))}
          </div>
        </fieldset>

        <p className={styles.note}>
          {allowlist.size} of {ALL_FACT_KEYS.length} facts allowlisted. Default
          allowlist (DEFAULT_TRUST_PAGE_ALLOWLIST):{" "}
          {DEFAULT_TRUST_PAGE_ALLOWLIST.join(", ")}.
        </p>

        <div className={styles.outputGrid}>
          <div className={styles.outputPanel}>
            <p className={styles.panelLabel}>HTML output (page source)</p>
            <pre className={styles.pre}>{page.html}</pre>
          </div>
          <div className={styles.outputPanel}>
            <p className={styles.panelLabel}>JSON output</p>
            <pre className={styles.pre}>{page.json}</pre>
          </div>
        </div>

        <label className={styles.field} htmlFor={`${uid}-tamper`}>
          Tamper: type any field name, try to force it into the allowlist
        </label>
        <input
          id={`${uid}-tamper`}
          className={styles.input}
          type="text"
          value={tamperKey}
          onChange={(e) => {
            setTamperKey(e.target.value);
          }}
          placeholder={TAMPER_SUGGESTION}
          spellCheck={false}
        />

        {tamperKeyTrim === "" ? (
          <Verdict state="neutral">
            Type a field name above, try &quot;{TAMPER_SUGGESTION}&quot;, and
            see if it reaches the page.
          </Verdict>
        ) : tamperLeaked ? (
          <Verdict state="ok">
            &quot;{tamperKeyTrim}&quot; is a real captured fact. It reached the
            page because you allowlisted it, not because the gate failed.
          </Verdict>
        ) : (
          <Verdict state="fail">
            Refused. &quot;{tamperKeyTrim}&quot; was never captured in the
            evidence pack. redactToAllowlist can only release a fact that
            exists, no matter what the allowlist says.
          </Verdict>
        )}
      </div>
    </PokeShell>
  );
}
