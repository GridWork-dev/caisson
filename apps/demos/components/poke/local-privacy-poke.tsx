"use client";

// The local-privacy module's poke (ADR-0378 lock 2) — a live, deterministic run of the package's
// fail-closed egress decision against the two real policy shapes the module ships: the air-gap
// default (`ZERO_EGRESS_POLICY`) and a policy with the on-device model-fetch host allowlisted.
//
// This component drives the REAL @caisson-sh/local-privacy (ADR-0396): the hand-ported mirror
// (local-privacy-logic.ts) is deleted, and `EgressGuard.assertAllowed` / `sinkKindFor` make every
// decision rendered below. The mirror's justifying header — that the package's `@caisson-sh/kernel`
// import drags node builtins into a client bundle — is retracted: that barrel has been browser-safe
// since the ./node split, so the package's whole `.` barrel walks clean and needs no `./browser`
// entry. Proven by the STATIC SOURCE-GRAPH WALK in local-privacy-poke.test.ts, never by a build —
// a bundler does not fail on a node builtin, it substitutes a polyfill and exits 0.
//
// What stays poke-local: the sample hosts, the two policy choices, and the render-shape adapter
// around a THROWING guard. Nothing here fetches, persists, or measures the visitor.
import { Fragment, useId, useMemo, useState } from "react";
import { Radio, StatusChip } from "@caisson-sh/ui/components";
import { InternalError, isCaissonError } from "@caisson-sh/kernel";
import { DEFAULT_ONNX_MODEL } from "@caisson-sh/local-inference/browser";
import {
  SANCTIONED_SINK_KINDS,
  ZERO_EGRESS_POLICY,
  createEgressGuard,
  localOnlyPolicy,
} from "@caisson-sh/local-privacy";
import type {
  EgressGuard,
  SanctionedSinkKind,
} from "@caisson-sh/local-privacy";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./local-privacy-poke.module.css";

/**
 * The real sanctioned model-fetch host (@caisson-sh/local-inference's `DEFAULT_ONNX_MODEL.modelHost`)
 * — the actual first-run download host the on-device backend allowlists, not a fabricated example.
 * Imported through the narrow browser entry so product config has one owner without admitting the
 * inference package's node-bound main barrel.
 */
export const MODEL_FETCH_HOST = DEFAULT_ONNX_MODEL.modelHost;

/** A real host from the module's own test suite — the external host the allowlist keeps out. */
export const SAMPLE_BLOCKED_HOST = "evil.example.com";

export type PolicyKey = "zero" | "model-fetch";

/** The two sample policies, each behind a REAL guard (constructed once; it re-parses the policy). */
export const POKE_GUARDS: Readonly<Record<PolicyKey, EgressGuard>> = {
  zero: createEgressGuard(ZERO_EGRESS_POLICY),
  "model-fetch": createEgressGuard(
    localOnlyPolicy([{ host: MODEL_FETCH_HOST, kind: "model-fetch" }]),
  ),
};

const POLICY_LABELS: Record<PolicyKey, string> = {
  zero: "ZERO_EGRESS_POLICY (allowlist empty)",
  "model-fetch": `localOnlyPolicy([{ host: "${MODEL_FETCH_HOST}", kind: "model-fetch" }])`,
};

export type EgressVerdict =
  | {
      readonly outcome: "allowed";
      readonly url: string;
      readonly host: string;
      readonly kind: SanctionedSinkKind;
    }
  | {
      readonly outcome: "blocked";
      readonly error: {
        readonly code: string;
        readonly httpStatus: number;
        readonly message: string;
        readonly details?: Record<string, unknown>;
      };
    };

/**
 * Presentation adapter only: `assertAllowed` THROWS a fail-closed `CaissonError`, and React renders
 * values. Every decision below belongs to the guard — the scheme check, the allowlist lookup, and
 * the sanctioned-kind naming (`sinkKindFor`). A non-Caisson throw is re-raised rather than rendered
 * as a block, so a real bug can never masquerade as the fail-closed path.
 */
export function egressVerdict(
  guard: EgressGuard,
  input: string,
): EgressVerdict {
  let url: URL;
  try {
    url = guard.assertAllowed(input);
  } catch (err) {
    if (!isCaissonError(err)) throw err;
    return {
      outcome: "blocked",
      error: {
        code: err.code,
        httpStatus: err.httpStatus,
        message: err.message,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    };
  }
  const host = url.hostname.toLowerCase();
  const kind = guard.sinkKindFor(host);
  if (kind === undefined) {
    // Unreachable: assertAllowed only returns for a host already on the guard's map. Fail loud
    // rather than render an allowed verdict with no sanctioned reason attached.
    throw new InternalError(
      "egress guard allowed a host with no sanctioned kind",
    );
  }
  return { outcome: "allowed", url: url.href, host, kind };
}

export default function LocalPrivacyPoke() {
  const uid = useId();
  const [host, setHost] = useState<string>(MODEL_FETCH_HOST);
  const [scheme, setScheme] = useState<"https" | "http">("https");
  const [policyKey, setPolicyKey] = useState<PolicyKey>("zero");

  const testedUrl = `${scheme}://${host.trim()}/model.onnx`;
  const verdict = useMemo(
    () => egressVerdict(POKE_GUARDS[policyKey], testedUrl),
    [testedUrl, policyKey],
  );

  return (
    <PokeShell
      label="@caisson-sh/local-privacy"
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
            {(Object.keys(POKE_GUARDS) as PolicyKey[]).map((key) => (
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
