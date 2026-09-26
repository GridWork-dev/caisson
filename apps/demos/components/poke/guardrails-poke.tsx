"use client";

// The guardrails module's poke (ADR-0378 lock 2, kimi flagship F4 "The boundary") — a live,
// deterministic run of the package's REAL browser entry: one detector, the WebCrypto redaction /
// tokenization path, and the shared fail-closed guard. Demo fixtures and presentation stay local.
// Nothing here fetches, persists, or measures the visitor.
import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Checkbox, Radio, StatusChip } from "@caisson-sh/ui/components";
import {
  PII_COLUMN_CONTEXT,
  PII_KINDS,
  detectPii,
  guardInputAsync,
  guardOutput,
  localModerator,
} from "@caisson-sh/guardrails/browser";
import type {
  BrowserGuardPolicy,
  BrowserPiiCryptoContext,
  GuardCategory,
  GuardRuntime,
  PiiKind,
  PiiMatch,
  PiiMode,
} from "@caisson-sh/guardrails/browser";

import { PokeShell, Verdict } from "./poke-rig";
import styles from "./guardrails-poke.module.css";

// The package's own golden fixture input (packages/guardrails/src/__golden__/pii-redact.json) —
// one real example of each detected PII class, non-overlapping. Labeled as a sample below.
const SAMPLE_TEXT =
  "Contact jane.doe@example.com or 404-555-0100. SSN 123-45-6789. Card 4111 1111 1111 1111 expires soon.";

// Poke-local fixtures, never package defaults. These are the field-crypto KAT vectors, labeled and
// non-secret; a production browser integration must inject caller-held material at runtime and must
// never compile a deployment master key into an end-user bundle.
const DEMO_CRYPTO_CONTEXT: BrowserPiiCryptoContext = {
  tenantId: "poke-tenant",
  masterKey: new Uint8Array(32).fill(0x11),
  salt: new Uint8Array(32).fill(0x22),
  currentVersion: 1,
};
const SAMPLE_BLOCKLIST: readonly string[] = [
  "ignore (all|previous) instructions",
  "reveal (your|the) system prompt",
];
const GUARDRAIL_BLOCKED_EVENT = "guardrail.blocked";

export type GuardStage = "input" | "output";

interface GuardrailErrorLike {
  readonly code: "guardrail_blocked";
  readonly httpStatus: 422;
  readonly message: string;
  readonly details: {
    readonly stage: GuardStage;
    readonly category: GuardCategory;
  };
}

export type GuardVerdict =
  | { readonly outcome: "pass"; readonly text: string }
  | {
      readonly outcome: "blocked";
      readonly stage: GuardStage;
      readonly category: GuardCategory;
      readonly failClosed: boolean;
      readonly error: GuardrailErrorLike;
    };

type GuardRun =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly verdict: GuardVerdict }
  | { readonly status: "error" };

function isGuardrailErrorLike(error: unknown): error is GuardrailErrorLike {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as Partial<GuardrailErrorLike>;
  return (
    candidate.code === "guardrail_blocked" &&
    candidate.httpStatus === 422 &&
    candidate.details !== undefined &&
    (candidate.details.stage === "input" ||
      candidate.details.stage === "output")
  );
}

/** Poke-local presentation adapter over the real package guard. */
export async function evaluateGuard(
  text: string,
  stage: GuardStage,
  options: { readonly outageOn: boolean; readonly mode: PiiMode },
): Promise<GuardVerdict> {
  const emitted: Array<Record<string, unknown>> = [];
  const runtime: GuardRuntime = {
    tenantId: DEMO_CRYPTO_CONTEXT.tenantId,
    sink: {
      emit(event) {
        emitted.push(event.attributes);
      },
    },
    now: () => new Date("2026-08-02T12:00:00.000Z"),
    newId: () => "00000000-0000-4000-8000-000000000000",
  };
  const policy: BrowserGuardPolicy = {
    policyName: "poke-sample",
    moderator: options.outageOn
      ? {
          moderate() {
            return new Promise<never>(() => {});
          },
        }
      : localModerator(SAMPLE_BLOCKLIST),
    ...(options.outageOn ? { timeoutMs: 25 } : {}),
    pii:
      stage === "input"
        ? options.mode === "tokenize"
          ? { mode: "tokenize", ctx: DEMO_CRYPTO_CONTEXT }
          : { mode: options.mode }
        : null,
  };

  try {
    if (stage === "output") {
      await guardOutput(text, policy, runtime);
      return { outcome: "pass", text };
    }
    const result = await guardInputAsync(text, policy, runtime);
    return { outcome: "pass", text: result.text };
  } catch (error) {
    if (!isGuardrailErrorLike(error)) throw error;
    return {
      outcome: "blocked",
      stage: error.details.stage,
      category: error.details.category,
      failClosed: emitted.at(-1)?.failClosed === true,
      error,
    };
  }
}

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
  const [run, setRun] = useState<GuardRun>({ status: "loading" });

  const matches = useMemo(() => detectPii(text), [text]);
  const verdict = run.status === "success" ? run.verdict : null;

  // WebCrypto hash/tokenization and the moderator port are async. Ignore stale completions when a
  // visitor edits again before the previous run settles.
  useEffect(() => {
    let live = true;
    setRun({ status: "loading" });
    void evaluateGuard(text, stage, { outageOn, mode }).then(
      (next) => {
        if (live) setRun({ status: "success", verdict: next });
      },
      () => {
        if (live) setRun({ status: "error" });
      },
    );
    return () => {
      live = false;
    };
  }, [text, mode, stage, outageOn]);

  return (
    <PokeShell
      label="@caisson-sh/guardrails"
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
              label="guardInputAsync(): moderate, then redact"
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
          {run.status === "loading" ? (
            <p className={styles.result}>Guarding…</p>
          ) : run.status === "error" ? (
            <Verdict state="fail">
              Guard unavailable. Edit the sample or settings to retry.
            </Verdict>
          ) : run.verdict.outcome === "blocked" ? (
            <BlockedPanel verdict={run.verdict} />
          ) : (
            <>
              <Verdict state="ok">
                {stage === "output"
                  ? "guardOutput() passed. The output leg never touches PII."
                  : `guardInputAsync() passed. ${matches.length} span${matches.length === 1 ? "" : "s"} redacted (${mode}).`}
              </Verdict>
              <p className={styles.result}>{run.verdict.text}</p>
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
                verdict?.outcome === "blocked" && verdict.category === cat
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
