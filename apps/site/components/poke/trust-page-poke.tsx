"use client";

// The trust-page module's poke (ADR-0378 lock 2) — a live, deterministic run of the package's
// allowlist-based redaction gate. Every function driving this component is the pure mirror in
// `trust-page-logic.ts` (see that file's header for why the real package isn't imported directly
// into a client bundle). Nothing here fetches, persists, or measures the visitor.
import { useId, useMemo, useState } from "react";
import { Checkbox } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  ALL_FACT_KEYS,
  DEFAULT_TRUST_PAGE_ALLOWLIST,
  SAMPLE_MANIFEST,
  flattenManifestFacts,
  renderTrustPage,
} from "./trust-page-logic";
import styles from "./trust-page-poke.module.css";

const SAMPLE_FACTS = flattenManifestFacts(SAMPLE_MANIFEST);
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
    () => renderTrustPage(SAMPLE_MANIFEST, effectiveAllowlist),
    [effectiveAllowlist],
  );

  const tamperLeaked =
    tamperKeyTrim !== "" && Object.hasOwn(page.facts, tamperKeyTrim);

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
