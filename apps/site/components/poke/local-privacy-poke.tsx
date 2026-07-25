"use client";

// The local-privacy module's poke (ADR-0378 lock 2) — a live, deterministic run of the package's
// fail-closed egress decision (`EgressGuard.assertAllowed`) against the two real policy shapes the
// module ships: the air-gap default (`ZERO_EGRESS_POLICY`) and a policy with the real on-device
// model-fetch host allowlisted. Every function driving this component is the pure mirror in
// `local-privacy-logic.ts` (see that file's header for why the real package isn't imported directly
// into a client bundle). Nothing here fetches, persists, or measures the visitor.
import { Fragment, useId, useMemo, useState } from "react";
import { Radio, StatusChip } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  MODEL_FETCH_HOST,
  MODEL_FETCH_POLICY,
  SANCTIONED_SINK_KINDS,
  ZERO_EGRESS_POLICY,
  evaluateEgress,
} from "./local-privacy-logic";
import type { PrivacyPolicy } from "./local-privacy-logic";
import styles from "./local-privacy-poke.module.css";

// A real host from the module's own test suite (egress-guard.test.ts), labeled as a sample below —
// the external host the allowlist is meant to keep out.
const SAMPLE_BLOCKED_HOST = "evil.example.com";

type PolicyKey = "zero" | "model-fetch";
type Scheme = "https" | "http";

const POLICIES: Record<PolicyKey, PrivacyPolicy> = {
  zero: ZERO_EGRESS_POLICY,
  "model-fetch": MODEL_FETCH_POLICY,
};
const POLICY_LABELS: Record<PolicyKey, string> = {
  zero: "ZERO_EGRESS_POLICY (allowlist empty)",
  "model-fetch": `localOnlyPolicy([{ host: "${MODEL_FETCH_HOST}", kind: "model-fetch" }])`,
};

export default function LocalPrivacyPoke() {
  const uid = useId();
  const [host, setHost] = useState(MODEL_FETCH_HOST);
  const [scheme, setScheme] = useState<Scheme>("https");
  const [policyKey, setPolicyKey] = useState<PolicyKey>("zero");

  const testedUrl = `${scheme}://${host.trim()}/model.onnx`;
  const verdict = useMemo(
    () => evaluateEgress(testedUrl, POLICIES[policyKey]),
    [testedUrl, policyKey],
  );

  return (
    <PokeShell
      label="@caisson/local-privacy"
      title="Nothing egresses unless the allowlist names it. Try a host."
    >
      <div className={styles.layout}>
        <label className={styles.field} htmlFor={`${uid}-host`}>
          Host to test (sample, edit it)
        </label>
        <div className={styles.urlRow}>
          <input
            id={`${uid}-host`}
            className={styles.input}
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.sampleButton}
            onClick={() => setHost(SAMPLE_BLOCKED_HOST)}
          >
            try {SAMPLE_BLOCKED_HOST}
          </button>
        </div>
        <p className={styles.tested}>
          assertAllowed(<code>{testedUrl}</code>)
        </p>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Scheme (tamper: force http on an allowlisted host)
          </legend>
          <div className={styles.optionRow}>
            <Radio
              name={`${uid}-scheme`}
              label="https"
              checked={scheme === "https"}
              onChange={() => setScheme("https")}
              className={styles.option}
            />
            <Radio
              name={`${uid}-scheme`}
              label="http (non-https egress is always blocked)"
              checked={scheme === "http"}
              onChange={() => setScheme("http")}
              className={styles.option}
            />
          </div>
        </fieldset>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>
            Privacy policy (PrivacyPolicy)
          </legend>
          <div className={styles.optionRow}>
            {(Object.keys(POLICIES) as PolicyKey[]).map((key) => (
              <Radio
                key={key}
                name={`${uid}-policy`}
                label={POLICY_LABELS[key]}
                checked={policyKey === key}
                onChange={() => setPolicyKey(key)}
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <div className={styles.outputPanel}>
          {verdict.outcome === "allowed" ? (
            <>
              <Verdict state="ok">
                assertAllowed() returned. &quot;{verdict.host}&quot; is
                sanctioned for &quot;{verdict.kind}&quot;.
              </Verdict>
              <dl className={styles.register}>
                <dt>host</dt>
                <dd>{verdict.host}</dd>
                <dt>kind</dt>
                <dd>{verdict.kind}</dd>
                <dt>url</dt>
                <dd>{verdict.url}</dd>
              </dl>
            </>
          ) : (
            <>
              <Verdict state="fail">{verdict.error.message}</Verdict>
              <dl className={styles.register}>
                <dt>code</dt>
                <dd>{verdict.error.code}</dd>
                <dt>httpStatus</dt>
                <dd>{verdict.error.httpStatus}</dd>
                {verdict.error.details
                  ? Object.entries(verdict.error.details).map(([k, v]) => (
                      <Fragment key={k}>
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </Fragment>
                    ))
                  : null}
              </dl>
            </>
          )}
        </div>

        <div className={styles.chipsRow}>
          {SANCTIONED_SINK_KINDS.map((kind) => (
            <StatusChip
              key={kind}
              label={kind}
              tone={
                verdict.outcome === "allowed" && verdict.kind === kind
                  ? "success"
                  : "muted"
              }
            />
          ))}
        </div>
        <p className={styles.note}>
          SanctionedSinkKind, the closed set of reasons a host can ever be
          allowlisted for. No other reason is expressible, and an empty
          allowlist means every host above is unreachable.
        </p>
      </div>
    </PokeShell>
  );
}
