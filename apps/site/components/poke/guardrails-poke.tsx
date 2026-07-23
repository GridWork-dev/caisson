"use client";

// The guardrails module's poke (ADR-0378 lock 2, kimi flagship F4 "The boundary") — a live,
// deterministic run of the package's fail-closed input/output guard against real PII detection.
// Every function driving this component is the pure mirror in `guardrails-logic.ts` (see that
// file's header for why the real package isn't imported directly into a client bundle). Nothing
// here fetches, persists, or measures the visitor.
import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Checkbox, Radio, StatusChip } from "@caisson/ui/components";

import { PokeShell, Verdict } from "./poke-rig";
import {
  GUARDRAIL_BLOCKED_EVENT,
  PII_COLUMN_CONTEXT,
  PII_KINDS,
  SAMPLE_BLOCKLIST,
  detectPii,
  evaluateGuard,
  hashPii,
  maskPii,
  tokenizePreview,
} from "./guardrails-logic";
import type {
  GuardCategory,
  GuardStage,
  GuardVerdict,
  PiiKind,
  PiiMatch,
  PiiMode,
} from "./guardrails-logic";
import styles from "./guardrails-poke.module.css";

// The package's own golden fixture input (packages/guardrails/src/__golden__/pii-redact.json) —
// one real example of each detected PII class, non-overlapping. Labeled as a sample below.
const SAMPLE_TEXT =
  "Contact jane.doe@example.com or 404-555-0100. SSN 123-45-6789. Card 4111 1111 1111 1111 expires soon.";

const MODES: readonly PiiMode[] = ["mask", "hash", "tokenize"];
const MODE_LABELS: Record<PiiMode, string> = {
  mask: "Mask",
  hash: "Hash",
  tokenize: "Tokenize",
};
const KIND_LABEL: Record<PiiKind, string> = {
  email: "email",
  ssn: "ssn",
  credit_card: "credit card",
  phone: "phone",
};
const GUARD_CATEGORIES: readonly GuardCategory[] = [
  "moderation",
  "pii",
  "injection",
  "secret",
  "custom",
];

export default function GuardrailsPoke() {
  const uid = useId();
  const [text, setText] = useState(SAMPLE_TEXT);
  const [stage, setStage] = useState<GuardStage>("input");
  const [mode, setMode] = useState<PiiMode>("mask");
  const [outageOn, setOutageOn] = useState(false);
  const [hashed, setHashed] = useState<string | null>(null);

  const matches = useMemo(() => detectPii(text), [text]);
  const verdict = useMemo(
    () => evaluateGuard(text, stage, { outageOn }),
    [text, stage, outageOn],
  );

  // hashPii is the one async leg (WebCrypto digest) — every other mode/stage output is synchronous.
  useEffect(() => {
    if (mode !== "hash" || stage !== "input" || verdict.outcome !== "pass") {
      setHashed(null);
      return;
    }
    let live = true;
    void hashPii(text, matches).then((out) => {
      if (live) setHashed(out);
    });
    return () => {
      live = false;
    };
  }, [text, matches, mode, stage, verdict.outcome]);

  const guardedText = useMemo(() => {
    if (verdict.outcome !== "pass" || stage !== "input") return null;
    if (mode === "mask") return maskPii(text, matches);
    if (mode === "tokenize") return tokenizePreview(text, matches).redacted;
    return hashed; // "hash" — filled by the effect above once the digest resolves.
  }, [verdict.outcome, stage, mode, text, matches, hashed]);

  return (
    <PokeShell
      label="@caisson/guardrails"
      title="Every call crosses the same gate. Type something it should stop."
    >
      <div className={styles.layout}>
        <label className={styles.field} htmlFor={`${uid}-input`}>
          Guarded input (sample text, edit it)
        </label>
        <textarea
          id={`${uid}-input`}
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          spellCheck={false}
        />

        <p className={styles.highlight} aria-hidden="true">
          {renderHighlighted(text, matches)}
        </p>
        <p className={styles.srOnly} role="status" aria-live="polite">
          {matches.length === 0
            ? "No PII detected."
            : `${matches.length} PII span${matches.length === 1 ? "" : "s"} detected: ${matches
                .map((m) => KIND_LABEL[m.kind])
                .join(", ")}.`}
        </p>

        <div className={styles.chipsRow}>
          {PII_KINDS.map((kind) => {
            const count = matches.filter((m) => m.kind === kind).length;
            return (
              <StatusChip
                key={kind}
                label={`${KIND_LABEL[kind]} × ${count}`}
                tone={count > 0 ? "accent" : "muted"}
              />
            );
          })}
        </div>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>Redaction mode (PiiMode)</legend>
          <div className={styles.optionRow}>
            {MODES.map((m) => (
              <Radio
                key={m}
                name={`${uid}-mode`}
                label={MODE_LABELS[m]}
                checked={mode === m}
                onChange={() => setMode(m)}
                disabled={stage === "output"}
                className={styles.option}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.optionGroup}>
          <legend className={styles.legend}>Stage</legend>
          <div className={styles.optionRow}>
            <Radio
              name={`${uid}-stage`}
              label="guardInput(): moderate, then redact"
              checked={stage === "input"}
              onChange={() => setStage("input")}
              className={styles.option}
            />
            <Radio
              name={`${uid}-stage`}
              label="guardOutput(): moderate only"
              checked={stage === "output"}
              onChange={() => setStage("output")}
              className={styles.option}
            />
          </div>
        </fieldset>

        <div className={styles.option}>
          <Checkbox
            label="Simulate moderator outage (moderateWithDeadline times out)"
            checked={outageOn}
            onChange={(e) => setOutageOn(e.target.checked)}
          />
        </div>

        <p className={styles.note}>
          Sample policy blocklist (forge.config policy.blocklist):{" "}
          {SAMPLE_BLOCKLIST.map((s) => `"${s}"`).join(", ")}.
        </p>

        <div className={styles.outputPanel}>
          {verdict.outcome === "blocked" ? (
            <BlockedPanel verdict={verdict} />
          ) : (
            <>
              <Verdict state="ok">
                {stage === "output"
                  ? "guardOutput() passed. The output leg never touches PII."
                  : `guardInput() passed. ${matches.length} span${matches.length === 1 ? "" : "s"} redacted (${mode}).`}
              </Verdict>
              <p className={styles.result}>
                {stage === "output" ? text : (guardedText ?? "Hashing…")}
              </p>
              {stage === "input" && mode === "tokenize" ? (
                <p className={styles.note}>
                  Each placeholder maps to a field-crypto envelope sealed under
                  the column context &quot;{PII_COLUMN_CONTEXT}&quot;. This demo
                  shows the placeholder, not the sealed bytes (that is the
                  field-crypto poke&apos;s job).
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className={styles.chipsRow}>
          {GUARD_CATEGORIES.map((cat) => (
            <StatusChip
              key={cat}
              label={cat}
              tone={
                verdict.outcome === "blocked" && verdict.category === cat
                  ? "accent"
                  : "muted"
              }
            />
          ))}
        </div>
        <p className={styles.note}>
          GuardCategory. Reachable in this demo: secret (the unconditional
          ADR-0215 gate) and moderation (the blocklist or an outage). pii,
          injection, and custom come from a provider or custom moderator driver,
          not the local one this poke runs.
        </p>
      </div>
    </PokeShell>
  );
}

function BlockedPanel({
  verdict,
}: {
  verdict: Extract<GuardVerdict, { outcome: "blocked" }>;
}) {
  return (
    <>
      <Verdict state="fail">{blockedMessage(verdict)}</Verdict>
      <dl className={styles.register}>
        <dt>code</dt>
        <dd>{verdict.error.code}</dd>
        <dt>httpStatus</dt>
        <dd>{verdict.error.httpStatus}</dd>
        <dt>stage</dt>
        <dd>{verdict.stage}</dd>
        <dt>category</dt>
        <dd>{verdict.category}</dd>
        <dt>failClosed</dt>
        <dd>{verdict.failClosed ? "true" : "false"}</dd>
      </dl>
      <p className={styles.event}>event: {GUARDRAIL_BLOCKED_EVENT}</p>
    </>
  );
}

function blockedMessage(
  verdict: Extract<GuardVerdict, { outcome: "blocked" }>,
): string {
  if (verdict.category === "secret") {
    return "Blocked before the moderator ever ran. The credential-shape gate is unconditional (ADR-0215).";
  }
  if (verdict.failClosed) {
    return "Blocked. The moderator timed out, and a down moderator fails closed, never waves the call through.";
  }
  return "Blocked. The configured moderator flagged this input.";
}

function renderHighlighted(
  text: string,
  matches: readonly PiiMatch[],
): ReactNode {
  if (matches.length === 0) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  matches.forEach((m, i) => {
    if (m.start > last) parts.push(text.slice(last, m.start));
    parts.push(
      <mark key={i} className={styles.mark} title={KIND_LABEL[m.kind]}>
        {text.slice(m.start, m.end)}
      </mark>,
    );
    last = m.end;
  });
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
