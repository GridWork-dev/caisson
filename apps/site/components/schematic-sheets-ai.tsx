import {
  Boundary,
  ByteStrip,
  Flow,
  Sheet,
  SNode,
  TitleBlock,
} from "./schematics";
import styles from "./schematics.module.css";

// AI Production Kit blueprint sheets (ADR-0377, executing ADR-0378 lock 1). Same hairline
// blueprint-linework register as FieldCryptoSheet / AuditWormSheet in ./schematics.tsx: every
// name is verbatim from the package it depicts, sample values are declared as samples, drawn
// subsets are declared on-sheet (the bar caption), and each sheet carries exactly ONE semantic
// accent element (the Boundary — the fail-closed gate or the injection-safe render boundary).
// These sheets replace the four legacy marketplace-diagrams.tsx mechanism diagrams for the same
// packages (MeterReserveReconcile, GuardFailClosed, PromptRenderBoundary, EvalBaselineGate).

// ===== module:ai-meter — reserve/reconcile over the atomic per-tenant spend window =====
// Names from src/meter.ts + src/breaker.ts: reserve() checks assertBreakerClosed() FIRST (an open
// breaker 402s before any provider call), debits BEFORE the call, then bumps
// TENANT_SPEND_WINDOW_TABLE via an atomic `INSERT … ON CONFLICT DO UPDATE spent = spent +
// EXCLUDED.spent … RETURNING`; a crossed hard cap calls tripBreaker() so the NEXT reserve 402s.
// reconcile() trues the charge to actual usage: a `feature_grant` refund, a `feature_debit`
// shortfall, or no credit row at all when the delta is zero — the append-only `usage_event
// (account_id, call_id)` UNIQUE makes a retried reconcile settle exactly once.
export function AiMeterSheet() {
  return (
    <Sheet
      title="ai-meter: reserve debits credits before the provider is called and checks the circuit breaker first; reconcile trues the charge to actual usage over an atomic per-tenant spend window"
      bar="packages/ai-meter · reserve, spend window, reconcile"
    >
      <SNode
        x={12}
        y={14}
        w={92}
        h={26}
        head="reserve()"
        sub="breaker + debit"
      />
      <Flow x1={104} y1={27} x2={118} y2={27} />
      <SNode
        x={118}
        y={14}
        w={96}
        h={26}
        head="provider call"
        sub="sized by reserve"
      />
      <Flow x1={214} y1={27} x2={228} y2={27} />
      <SNode
        x={228}
        y={16}
        w={100}
        h={22}
        head="reconcile()"
        sub="true to actual"
      />
      <text x={170} y={54} textAnchor="middle" className={styles.noteDanger}>
        assertBreakerClosed() ⇒ 402
      </text>
      <Flow x1={58} y1={40} x2={58} y2={64} />
      <Flow x1={278} y1={38} x2={278} y2={64} />
      {/* the ONE accent element: the atomic spend-window upsert */}
      <Boundary
        x={12}
        y={64}
        w={316}
        h={50}
        label="TENANT_SPEND_WINDOW_TABLE · atomic upsert"
      />
      <SNode
        x={124}
        y={82}
        w={140}
        h={22}
        head="ON CONFLICT"
        sub="spent += Δ, RETURNING"
      />
      <text x={170} y={112} textAnchor="middle" className={styles.noteDanger}>
        hard cap ⇒ tripBreaker(), next reserve 402s
      </text>
      <ByteStrip
        x={12}
        y={124}
        h={20}
        cells={[
          { label: "Δ < 0", w: 96, measure: "feature_grant" },
          { label: "Δ = 0", w: 78, measure: "no credit row" },
          { label: "Δ > 0", w: 96, measure: "feature_debit" },
        ]}
      />
      <text x={12} y={181} className={styles.note}>
        usage_event UNIQUE(acct, call)
      </text>
      <TitleBlock x={188} y={168} w={140} text="AI-METER · 1/1" />
    </Sheet>
  );
}

// ===== module:guardrails — the fail-closed input/output chokepoint =====
// Names from src/guard.ts + src/moderator.ts (ADR-0063): moderate() runs the cheap `cheapDeny`
// regex pre-screen first (free), then the UNCONDITIONAL secret-shape gate `looksLikeSecret`
// (ADR-0215, no policy opt-out), then `moderateWithDeadline` under `timeoutMs` (default 2000ms).
// guardInput() / guardOutput() are the chokepoint every call passes through; a moderator outage or
// timeout BLOCKS unless the policy explicitly sets `failOpen: true`. A block throws
// `GuardrailError` (422) and emits a metadata-only `guardrail.blocked` event.
export function GuardrailsSheet() {
  return (
    <Sheet
      title="guardrails: a cheap regex pre-screen, then the unconditional secret-shape gate, then the configured moderator under a deadline, an outage or timeout blocks by default, fail-closed"
      bar="packages/guardrails · guardInput, guardOutput, guardrail.blocked (3 of 7 fields) · category: 2 of 5 GuardCategory drawn"
    >
      <SNode x={12} y={14} w={78} h={24} head="cheapDeny" sub="regex, free" />
      <Flow x1={90} y1={26} x2={100} y2={26} />
      <SNode
        x={100}
        y={14}
        w={96}
        h={24}
        head="looksLikeSecret"
        sub="ADR-0215, unconditional"
      />
      <Flow x1={196} y1={26} x2={206} y2={26} />
      <SNode
        x={206}
        y={14}
        w={112}
        h={24}
        head="moderateWithDeadline"
        sub="timeoutMs = 2000"
      />
      <Flow x1={262} y1={38} x2={262} y2={58} />
      {/* the ONE accent element: the fail-closed chokepoint */}
      <Boundary
        x={12}
        y={58}
        w={316}
        h={48}
        label="guardInput() / guardOutput() · fail-closed"
      />
      <SNode
        x={118}
        y={80}
        w={104}
        h={22}
        head="GuardrailError"
        sub="422 on any block"
      />
      <text x={170} y={118} textAnchor="middle" className={styles.noteDanger}>
        outage/timeout ⇒ blocked unless failOpen: true
      </text>
      <ByteStrip
        x={12}
        y={128}
        h={18}
        cells={[
          { label: "stage", w: 90, measure: "input | output" },
          { label: "category", w: 110, measure: "moderation | secret …" },
          { label: "failClosed", w: 96, measure: "boolean" },
        ]}
      />
      <text x={12} y={181} className={styles.note}>
        PII: mask · hash · tokenize
      </text>
      <TitleBlock x={188} y={168} w={140} text="GUARDRAILS · 1/1" />
    </Sheet>
  );
}

// ===== module:prompt-registry — addressing + the injection-safe render boundary =====
// Names from src/registry.ts + src/render.ts (ADR-0061): parsePromptRef resolves `name`,
// `name@<n>`, or `name@<alias>`; resolvePrompt dispatches to the current tip, a pinned version, or
// an alias pointer; setAlias mutates ONLY the alias pointer row, never a version row. renderPrompt
// is the sole entry point for untrusted input: rawVars validate against the version's `.strict()`
// buildVarSchema, then a single non-recursive `String.replace` pass fills placeholders after
// escapeValue neutralizes `{`/`}` — a value can never form or re-open a placeholder.
export function PromptRegistrySheet() {
  return (
    <Sheet
      title="prompt-registry: name@version or name@alias resolves to an immutable version, whose renderPrompt validates untrusted vars against a strict schema and escapes braces in one non-recursive pass"
      bar="packages/prompt-registry · parsePromptRef, resolvePrompt, renderPrompt"
    >
      <SNode
        x={12}
        y={14}
        w={100}
        h={24}
        head="parsePromptRef"
        sub="name@version|alias"
      />
      <Flow x1={112} y1={26} x2={124} y2={26} />
      <SNode
        x={124}
        y={14}
        w={94}
        h={24}
        head="resolvePrompt"
        sub="current · v.N · alias"
      />
      <Flow x1={218} y1={26} x2={230} y2={26} />
      <SNode x={230} y={16} w={74} h={20} head="version" sub="immutable" />
      <text x={170} y={50} textAnchor="middle" className={styles.note}>
        setAlias(): pointer only, never a version row
      </text>
      <Flow x1={267} y1={36} x2={267} y2={62} />
      <text x={12} y={80} className={styles.note}>
        rawVars
      </text>
      <Flow x1={50} y1={84} x2={98} y2={84} />
      {/* the ONE accent element: the injection-safe render boundary */}
      <Boundary
        x={100}
        y={62}
        w={204}
        h={54}
        label="renderPrompt() · injection-safe"
      />
      <SNode
        x={112}
        y={80}
        w={90}
        h={22}
        head="buildVarSchema"
        sub=".strict()"
      />
      <Flow x1={202} y1={91} x2={214} y2={91} />
      <SNode
        x={214}
        y={80}
        w={82}
        h={22}
        head="escapeValue"
        sub="escapes { }"
      />
      <text x={202} y={111} textAnchor="middle" className={styles.noteDanger}>
        unbound var ⇒ ValidationError
      </text>
      <Flow x1={202} y1={116} x2={202} y2={128} />
      <SNode
        x={158}
        y={130}
        w={88}
        h={22}
        head="RenderedMessage[]"
        sub="role + content"
      />
      <text x={12} y={181} className={styles.note}>
        content cap 100,000 chars
      </text>
      <TitleBlock x={188} y={168} w={140} text="PROMPT-REGISTRY · 1/1" />
    </Sheet>
  );
}

// ===== module:ai-evals — the committed-baseline regression gate + BLESS re-baseline =====
// Names from src/baseline.ts (ADR-0062/0072): gateAgainstBaseline runs compareToBaseline against
// the committed JSON baseline per run — a below-`threshold` score, a score/scorer regression, a
// missing baseline entry, a shrunk case count, or (opt-in) a Wilson-lower-bound floor miss all
// fail the gate. With `BLESS=1` the ONLY sanctioned rewrite path runs: every run must clear
// assertRunEligibleForBaseline() FIRST (WR-01) — a below-threshold run throws before the baseline
// file is read or written, so a failing run can never overwrite a passing baseline.
export function AiEvalsSheet() {
  return (
    <Sheet
      title="ai-evals: gateAgainstBaseline compares every run to a committed JSON baseline; BLESS=1 is the sole rewrite path, and a below-threshold run is rejected before the baseline file is touched"
      bar="packages/ai-evals · gateAgainstBaseline · 3 of 6 RegressionKind drawn"
    >
      <SNode x={12} y={14} w={100} h={26} head="eval run" sub="scored cases" />
      <Flow x1={112} y1={27} x2={126} y2={27} />
      <SNode
        x={126}
        y={14}
        w={140}
        h={26}
        head="gateAgainstBaseline"
        sub="compareToBaseline × N"
      />
      <Flow x1={196} y1={40} x2={196} y2={48} />
      <text x={12} y={46} className={styles.note}>
        RegressionKind
      </text>
      <SNode x={12} y={50} w={100} h={20} head="score-regression" />
      <SNode x={118} y={50} w={96} h={20} head="fewer-cases" />
      <SNode x={220} y={50} w={108} h={20} head="wilson-below-floor" />
      {/* the ONE accent element: the sole sanctioned re-baseline path */}
      <Boundary
        x={12}
        y={96}
        w={316}
        h={52}
        label="BLESS=1 · sole re-baseline path"
      />
      <SNode
        x={30}
        y={114}
        w={150}
        h={22}
        head="assertRunEligibleForBaseline"
        sub="score < threshold ⇒ throw"
      />
      <Flow x1={182} y1={125} x2={196} y2={125} />
      <SNode
        x={196}
        y={114}
        w={118}
        h={22}
        head="rewrite baseline"
        sub="merge, never partial"
      />
      <text x={170} y={142} textAnchor="middle" className={styles.noteDanger}>
        below-threshold run ⇒ never blessed
      </text>
      <text x={12} y={181} className={styles.note}>
        WR-01 gate: check before write
      </text>
      <TitleBlock x={188} y={168} w={140} text="AI-EVALS · 1/1" />
    </Sheet>
  );
}
