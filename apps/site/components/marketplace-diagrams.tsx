import type { DiagramKey } from "@/lib/media-manifest";

import { MediaFrame } from "./media-frame";
import styles from "./marketplace-diagrams.module.css";

// Authored media-carousel diagrams (ADR-0285 §3, restyled onto the ADR-0290 standardized template) —
// the homepage's diagram language (per-tenant RLS deny-flow, audit-chain hash flow, WORM anchor
// lifecycle, plus eight new single-target mechanism diagrams closing the media gap), rebuilt with
// more character: real SVG, token color accents, and layered depth, all inside the brand floor
// (every color is a --cs-* token, no raw hex). Server components (static, no interactivity). Each
// depicts SHIPPED behaviour only (copy law ADR-0080). The <MediaFrame> makes the whole thing one
// `role="img"` (the <MediaCarousel> caption narrates the slide already), so the inner SVG's own
// <title>/aria-label are decorative detail, not the accessible name.

const VIEW_W = 340;
const VIEW_H = 190;

/** Approximate mono advance width (em) — 0.72 leaves margin over the measured ~0.69 render
 *  (and over JetBrains Mono's nominal 0.6) so a fallback-font paint never overflows. */
const CHAR_W = 0.72;

/** SVG `textLength` clamp: squeeze a label that would paint past its box instead of overflowing
 *  it (the retention-runner audit finding — sub text spilling out of its node). A label that fits
 *  renders untouched. */
function fit(
  text: string,
  fontPx: number,
  maxW: number,
): { textLength: number; lengthAdjust: "spacingAndGlyphs" } | undefined {
  return text.length * fontPx * CHAR_W > maxW
    ? { textLength: maxW, lengthAdjust: "spacingAndGlyphs" }
    : undefined;
}

/** Footnote text pinned inside the viewBox — clamps instead of painting past the right edge. */
function Note({
  x,
  y,
  danger,
  children,
}: {
  x: number;
  y: number;
  danger?: boolean;
  children: string;
}) {
  return (
    <text
      x={x}
      y={y}
      className={danger ? styles.noteDanger : styles.note}
      {...fit(children, 8.5, VIEW_W - x - 8)}
    >
      {children}
    </text>
  );
}

function Frame({
  title,
  bar,
  children,
}: {
  title: string;
  bar: string;
  children: React.ReactNode;
}) {
  return (
    <MediaFrame label={bar} ariaLabel={title} decorative>
      <div className={styles.svgFrame}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={title}
          preserveAspectRatio="xMidYMid meet"
        >
          <title>{title}</title>
          {children}
        </svg>
      </div>
    </MediaFrame>
  );
}

/** One rounded node with a heading + sub line. */
function Node({
  x,
  y,
  w,
  h,
  head,
  sub,
  tone = "base",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  head: string;
  sub?: string;
  tone?: "base" | "accent" | "danger" | "success";
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={8}
        className={`${styles.node} ${styles[tone]}`}
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 4 : y + h / 2 + 3}
        className={`${styles.head} ${styles[`${tone}Text`]}`}
        {...fit(head, 11, w - 10)}
      >
        {head}
      </text>
      {sub ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 10}
          className={styles.sub}
          {...fit(sub, 8.5, w - 8)}
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

/** Shared arrowhead marker defs (accent + danger). */
function Arrowheads() {
  return (
    <defs>
      <marker
        id="cs-arrow"
        viewBox="0 0 10 10"
        refX={8}
        refY={5}
        markerWidth={6}
        markerHeight={6}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowFill} />
      </marker>
      <marker
        id="cs-arrow-danger"
        viewBox="0 0 10 10"
        refX={8}
        refY={5}
        markerWidth={6}
        markerHeight={6}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowFillDanger} />
      </marker>
    </defs>
  );
}

/** Per-tenant RLS isolation, fail-closed — three query lanes cross the FORCE boundary; the
 *  no-context lane returns zero rows. */
function RlsDeny() {
  const lanes = [
    { x: 12, head: "tenant A", sub: "context set" },
    { x: 122, head: "tenant B", sub: "context set" },
    { x: 232, head: "no context", sub: "never set" },
  ];
  const results: {
    head: string;
    sub: string;
    tone: "success" | "danger";
  }[] = [
    { head: "A's rows", sub: "only A", tone: "success" },
    { head: "B's rows", sub: "only B", tone: "success" },
    { head: "0 rows", sub: "denied", tone: "danger" },
  ];
  return (
    <Frame
      title="Per-tenant RLS isolation, fail-closed: with tenant context set a query returns only that tenant's rows; with no context set it returns zero rows."
      bar="rls-deny.svg"
    >
      {lanes.map((l, i) => (
        <g key={l.head}>
          <Node x={l.x} y={10} w={96} h={34} head={l.head} sub={l.sub} />
          <path
            d={`M ${l.x + 48} 46 L ${l.x + 48} 62`}
            className={styles.arrow}
            markerEnd="url(#cs-arrow)"
          />
          <path
            d={`M ${l.x + 48} 100 L ${l.x + 48} 116`}
            className={i === 2 ? styles.arrowDanger : styles.arrow}
            markerEnd={i === 2 ? "url(#cs-arrow-danger)" : "url(#cs-arrow)"}
          />
        </g>
      ))}
      <Arrowheads />
      {/* FORCE boundary band — accent, the load-bearing gate every lane crosses. */}
      <rect
        x={12}
        y={64}
        width={316}
        height={34}
        rx={8}
        className={styles.boundary}
      />
      <text x={VIEW_W / 2} y={78} className={styles.boundaryHead}>
        FORCE ROW LEVEL SECURITY
      </text>
      <text x={VIEW_W / 2} y={90} className={styles.boundarySub}>
        USING (account_id = current_setting)
      </text>
      {results.map((r, i) => (
        <Node
          key={r.head}
          x={lanes[i]!.x}
          y={118}
          w={96}
          h={34}
          head={r.head}
          sub={r.sub}
          tone={r.tone}
        />
      ))}
    </Frame>
  );
}

/** Append-only hash chain — four chained blocks; a tampered block breaks every link after it. */
function AuditChain() {
  const blocks = [
    { x: 8, n: "#41", tampered: false },
    { x: 92, n: "#42", tampered: true },
    { x: 176, n: "#43", tampered: false },
    { x: 260, n: "#44", tampered: false },
  ];
  return (
    <Frame
      title="Append-only hash chain: each entry commits SHA-256 over the previous hash plus its payload — editing one row breaks every link after it."
      bar="audit-chain.svg"
    >
      <Arrowheads />
      {/* Chain links: the link INTO and AFTER the tampered block read as broken. */}
      {blocks.slice(0, -1).map((b, i) => {
        const broken = blocks[i + 1]!.tampered || b.tampered;
        return (
          <path
            key={b.n}
            d={`M ${b.x + 72} 70 L ${b.x + 84} 70`}
            className={broken ? styles.arrowDanger : styles.chainLink}
            markerEnd={broken ? "url(#cs-arrow-danger)" : "url(#cs-arrow)"}
          />
        );
      })}
      {blocks.map((b) => (
        <g key={b.n}>
          <Node
            x={b.x}
            y={52}
            w={72}
            h={38}
            head={b.n}
            sub={b.tampered ? "edited" : "sha256"}
            tone={b.tampered ? "danger" : "base"}
          />
        </g>
      ))}
      <text x={8} y={120} className={styles.note}>
        sha256(prev ‖ payload)
      </text>
      <text
        x={92}
        y={140}
        className={styles.noteDanger}
        {...fit(
          "one edit → every link after it fails to recompute",
          8.5,
          VIEW_W - 100,
        )}
      >
        one edit → every link after it fails to recompute
      </text>
    </Frame>
  );
}

/** Evidence lifecycle — write, chain, WORM anchor, verify + export. */
function WormLifecycle() {
  const stages: {
    x: number;
    head: string;
    sub: string;
    tone: "base" | "accent" | "success";
  }[] = [
    { x: 8, head: "1 · write", sub: "audit row", tone: "base" },
    { x: 92, head: "2 · chain", sub: "append-only", tone: "base" },
    { x: 176, head: "3 · anchor", sub: "S3 Object-Lock", tone: "accent" },
    { x: 260, head: "4 · verify", sub: "→ export", tone: "success" },
  ];
  return (
    <Frame
      title="Evidence lifecycle: a privileged write joins the append-only chain, anchors to WORM under S3 Object-Lock, then verifies and exports as an evidence pack."
      bar="worm-lifecycle.svg"
    >
      <Arrowheads />
      {stages.slice(0, -1).map((s) => (
        <path
          key={s.head}
          d={`M ${s.x + 72} 72 L ${s.x + 84} 72`}
          className={styles.arrow}
          markerEnd="url(#cs-arrow)"
        />
      ))}
      {stages.map((s) => (
        <Node
          key={s.head}
          x={s.x}
          y={54}
          w={72}
          h={40}
          head={s.head}
          sub={s.sub}
          tone={s.tone}
        />
      ))}
      {/* The WORM lock glyph over stage 3 — the write-once guarantee. */}
      <g className={styles.lock}>
        <rect x={200} y={112} width={24} height={18} rx={3} />
        <path d="M 205 112 v -5 a 7 7 0 0 1 14 0 v 5" />
      </g>
      <text x={8} y={150} className={styles.note}>
        write-once, retained, verifiable
      </text>
    </Frame>
  );
}

interface Stage {
  head: string;
  sub: string;
  tone?: "base" | "accent" | "danger" | "success";
}

/** Generic N-stage horizontal flow (ADR-0290) — the shared shape behind every new mechanism diagram
 *  below: evenly spaced nodes left to right, connected by arrows (danger-styled into/out of a
 *  danger-toned stage), with an optional footnote. Reuses the same Node/Arrowheads/Frame primitives
 *  the three original diagrams hand-built, generalized so a new mechanism diagram is one stage array
 *  instead of a bespoke layout. */
function StageFlow({
  title,
  bar,
  stages,
  note,
}: {
  title: string;
  bar: string;
  stages: readonly Stage[];
  note?: string;
}) {
  const n = stages.length;
  const gap = 12;
  const w = (VIEW_W - gap * (n + 1)) / n;
  const y = 76;
  const h = 40;
  const xs = stages.map((_s, i) => gap + i * (w + gap));
  return (
    <Frame title={title} bar={bar}>
      <Arrowheads />
      {xs.slice(0, -1).map((x, i) => {
        const danger =
          stages[i]!.tone === "danger" || stages[i + 1]!.tone === "danger";
        return (
          <path
            key={`link-${stages[i]!.head}`}
            d={`M ${x + w} ${y + h / 2} L ${x + w + gap} ${y + h / 2}`}
            className={danger ? styles.arrowDanger : styles.arrow}
            markerEnd={danger ? "url(#cs-arrow-danger)" : "url(#cs-arrow)"}
          />
        );
      })}
      {stages.map((s, i) => (
        <Node
          key={s.head}
          x={xs[i]!}
          y={y}
          w={w}
          h={h}
          head={s.head}
          sub={s.sub}
          tone={s.tone ?? "base"}
        />
      ))}
      {note ? (
        <text
          x={gap}
          y={148}
          className={styles.note}
          {...fit(note, 8.5, VIEW_W - gap * 2)}
        >
          {note}
        </text>
      ) : null}
    </Frame>
  );
}

function CreditsLedger() {
  return (
    <StageFlow
      title="Credit ledger: grant, then FIFO-spend, fail-closed at zero — a PG-atomic mutation, one integer denomination, never a float."
      bar="credits-ledger.svg"
      stages={[
        { head: "grant", sub: "credit added" },
        { head: "spend", sub: "FIFO debit" },
        { head: "zero", sub: "402, fail-closed", tone: "danger" },
      ]}
      note="atomic Postgres mutation — credits are integers, never a float"
    />
  );
}

function LocalSyncMerge() {
  return (
    <StageFlow
      title="Two-way offline sync: each device's changesets reconcile through a logical clock to one converged state, no server round-trip."
      bar="local-sync-merge.svg"
      stages={[
        { head: "device A", sub: "changeset" },
        { head: "reconcile", sub: "logical clock", tone: "accent" },
        { head: "converged", sub: "device B", tone: "success" },
      ]}
      note="tombstones + a convergence test — offline-first by default"
    />
  );
}

function LocalInferenceEgress() {
  return (
    <StageFlow
      title="A prompt runs against an on-device ONNX model — inference stays on the box unless a hosted provider is opted into."
      bar="local-inference-egress.svg"
      stages={[
        { head: "prompt", sub: "on-device" },
        { head: "ONNX model", sub: "transformers.js", tone: "accent" },
        { head: "response", sub: "zero egress", tone: "success" },
      ]}
      note="SHA-256 hash-verified model — hosted inference only by opt-in"
    />
  );
}

function PrivacyGate() {
  return (
    <StageFlow
      title="Every outbound payload crosses a default-deny egress gate: no host is reachable unless a typed allowlist names it."
      bar="privacy-gate.svg"
      stages={[
        { head: "payload", sub: "outbound" },
        { head: "egress gate", sub: "default-deny", tone: "accent" },
        { head: "0 hosts", sub: "empty allowlist", tone: "danger" },
      ]}
      note="leave the allowlist empty and egress is zero, by construction"
    />
  );
}

function ToolExecGate() {
  return (
    <StageFlow
      title="An agent's command crosses a default-deny allowlist over Zod-strict argv before execFile runs it — never a shell."
      bar="tool-exec-gate.svg"
      stages={[
        { head: "agent call", sub: "argv request" },
        { head: "allowlist", sub: "zod-strict argv", tone: "accent" },
        { head: "execFile", sub: "no shell", tone: "success" },
      ]}
      note="a command outside the allowlist is denied, not sanitized"
    />
  );
}

function OrgControlsMutation() {
  return (
    <StageFlow
      title="An owner-gated mutation crosses the admin-write RLS layer and lands two log rows: the mutation and its audit entry."
      bar="org-controls-mutation.svg"
      stages={[
        { head: "owner action", sub: "scoped write" },
        { head: "admin-write RLS", sub: "owner-gated", tone: "accent" },
        { head: "dual log", sub: "mutation + audit", tone: "success" },
      ]}
      note="WorkOS SSO + the owner-gated multi-user surface"
    />
  );
}

function BillingProviderPort() {
  return (
    <StageFlow
      title="Four billing providers behind one port: a webhook fulfills exactly once, however many times it's redelivered."
      bar="billing-provider-port.svg"
      stages={[
        { head: "webhook in", sub: "4 providers" },
        { head: "one port", sub: "BillingProvider", tone: "accent" },
        { head: "fulfill once", sub: "idempotent", tone: "success" },
      ]}
      note="Paddle · Stripe · LemonSqueezy · Polar behind one port"
    />
  );
}

function FrameworksOscal() {
  return (
    <StageFlow
      title="Named framework clauses map to controls, then export as an OSCAL v1.2.2 catalog the evidence packs render against."
      bar="frameworks-oscal.svg"
      stages={[
        { head: "frameworks", sub: "SOC 2 · HIPAA" },
        { head: "mapping", sub: "clause → control", tone: "accent" },
        { head: "OSCAL v1.2.2", sub: "export", tone: "success" },
      ]}
      note="SOC 2 · HIPAA · EU AI Act — the evidence-pack catalog"
    />
  );
}

/** @caisson/alerting — the five-stage pipeline (src/orchestrator.ts): dedup → rate-cap/digest →
 *  tz-aware quiet hours → multi-channel delivery, short-circuiting at the first non-deliver
 *  outcome, with an audit row written for EVERY outcome. */
function AlertPipeline() {
  const gates: {
    x: number;
    head: string;
    sub: string;
    tone?: "success";
  }[] = [
    { x: 6, head: "dedup", sub: "suppress repeat" },
    { x: 90, head: "rate-cap", sub: "digest at cap" },
    { x: 174, head: "quiet hours", sub: "hold · tz-aware" },
    { x: 258, head: "deliver", sub: "4 channel ports", tone: "success" },
  ];
  return (
    <Frame
      title="Five-stage alert pipeline: dedup, rate-cap with digest fallback, timezone-aware quiet hours, then multi-channel delivery — every outcome writes an audit row."
      bar="alert-pipeline.svg"
    >
      <Arrowheads />
      {gates.slice(0, -1).map((g) => (
        <path
          key={g.head}
          d={`M ${g.x + 76} 49 L ${g.x + 82} 49`}
          className={styles.arrow}
          markerEnd="url(#cs-arrow)"
        />
      ))}
      {gates.map((g) => (
        <g key={g.head}>
          <Node
            x={g.x}
            y={30}
            w={76}
            h={38}
            head={g.head}
            sub={g.sub}
            tone={g.tone ?? "base"}
          />
          <path
            d={`M ${g.x + 38} 70 L ${g.x + 38} 86`}
            className={styles.arrow}
            markerEnd="url(#cs-arrow)"
          />
        </g>
      ))}
      <rect
        x={6}
        y={88}
        width={328}
        height={34}
        rx={8}
        className={styles.boundary}
      />
      <text x={VIEW_W / 2} y={102} className={styles.boundaryHead}>
        alert audit log — one row per outcome
      </text>
      <text x={VIEW_W / 2} y={114} className={styles.boundarySub}>
        delivered · suppressed · digested · held
      </text>
      <Note x={6} y={150}>
        a critical event always overrides quiet hours
      </Note>
    </Frame>
  );
}

/** @caisson/ai-meter — reserve → provider call → reconcile over the atomic per-tenant spend
 *  window (src/meter.ts): credits debit BEFORE the provider is called, then true to reported
 *  usage; a crossed hard cap trips the breaker so the next reserve 402s. */
function MeterReserveReconcile() {
  return (
    <Frame
      title="Estimate, reserve, reconcile: credits debit before the provider call and true up to the provider's actual usage — a crossed hard cap trips the breaker, fail-closed."
      bar="meter-reserve-reconcile.svg"
    >
      <Arrowheads />
      <path
        d={`M 108 47 L 120 47`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 218 47 L 230 47`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <Node
        x={12}
        y={28}
        w={96}
        h={38}
        head="reserve"
        sub="debit up front"
        tone="accent"
      />
      <Node
        x={122}
        y={28}
        w={96}
        h={38}
        head="provider call"
        sub="sized by reserve"
      />
      <Node
        x={232}
        y={28}
        w={96}
        h={38}
        head="reconcile"
        sub="refund or charge"
        tone="success"
      />
      <path
        d={`M 60 68 L 60 84`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 280 68 L 280 84`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <rect
        x={12}
        y={86}
        width={316}
        height={34}
        rx={8}
        className={styles.boundary}
      />
      <text x={VIEW_W / 2} y={100} className={styles.boundaryHead}>
        per-tenant spend window — atomic upsert
      </text>
      <text x={VIEW_W / 2} y={112} className={styles.boundarySub}>
        idempotent on callId · soft cap warns · hard cap trips
      </text>
      <Note x={12} y={150}>
        an open breaker or short wallet 402s — no spend, no call
      </Note>
    </Frame>
  );
}

/** @caisson/ai-evals — the committed-baseline regression gate (src/baseline.ts): a fresh run
 *  compares to the committed JSON baseline; a drop past tolerance fails the build. */
function EvalBaselineGate() {
  return (
    <StageFlow
      title="Every eval run gates against a committed JSON baseline: a score drop past tolerance fails the build — re-blessing is a deliberate act, never a silent pass."
      bar="eval-baseline-gate.svg"
      stages={[
        { head: "eval run", sub: "scored cases" },
        { head: "compare", sub: "vs baseline", tone: "accent" },
        { head: "regression", sub: "build fails", tone: "danger" },
      ]}
      note="a shrunk dataset flags too — BLESS=1 is the only re-bless"
    />
  );
}

/** @caisson/guardrails — the fail-closed check gate (src/guard.ts): three inputs cross the
 *  guardInput/guardOutput boundary; a flagged text, a credential shape, or a moderator outage
 *  all block — only clean text reaches the model. */
function GuardFailClosed() {
  const lanes = [
    { x: 12, head: "clean text", sub: "input" },
    { x: 122, head: "flagged", sub: "denylist hit" },
    { x: 232, head: "outage", sub: "moderator down" },
  ];
  const results: {
    head: string;
    sub: string;
    tone: "success" | "danger";
  }[] = [
    { head: "model call", sub: "proceeds", tone: "success" },
    { head: "blocked", sub: "422 thrown", tone: "danger" },
    { head: "blocked", sub: "fail-closed", tone: "danger" },
  ];
  return (
    <Frame
      title="A flagged input, a credential-shaped string, or a moderator outage blocks the call — fail-closed by default, a typed 422, never a silent pass-through."
      bar="guard-fail-closed.svg"
    >
      <Arrowheads />
      {lanes.map((l, i) => (
        <g key={l.head}>
          <Node x={l.x} y={10} w={96} h={34} head={l.head} sub={l.sub} />
          <path
            d={`M ${l.x + 48} 46 L ${l.x + 48} 62`}
            className={styles.arrow}
            markerEnd="url(#cs-arrow)"
          />
          <path
            d={`M ${l.x + 48} 100 L ${l.x + 48} 116`}
            className={i === 0 ? styles.arrow : styles.arrowDanger}
            markerEnd={i === 0 ? "url(#cs-arrow)" : "url(#cs-arrow-danger)"}
          />
        </g>
      ))}
      <rect
        x={12}
        y={64}
        width={316}
        height={34}
        rx={8}
        className={styles.boundary}
      />
      <text x={VIEW_W / 2} y={78} className={styles.boundaryHead}>
        guardInput / guardOutput
      </text>
      <text x={VIEW_W / 2} y={90} className={styles.boundarySub}>
        secret pre-screen · moderator under a deadline
      </text>
      {results.map((r, i) => (
        <Node
          key={`${r.head}-${i}`}
          x={lanes[i]!.x}
          y={118}
          w={96}
          h={34}
          head={r.head}
          sub={r.sub}
          tone={r.tone}
        />
      ))}
    </Frame>
  );
}

/** @caisson/prompt-registry — the injection-safe render boundary (src/render.ts): vars validate
 *  against the version's strict schema, then fill placeholders in ONE escaped pass. */
function PromptRenderBoundary() {
  return (
    <StageFlow
      title="Injection-safe rendering: variables validate against the version's strict schema, then fill placeholders in one escaped pass — a value can never forge a role."
      bar="prompt-render-boundary.svg"
      stages={[
        { head: "name@prod", sub: "alias resolve" },
        { head: "strict schema", sub: "vars validated", tone: "accent" },
        { head: "single pass", sub: "values escaped", tone: "success" },
      ]}
      note="braces escaped — a value can never form a placeholder"
    />
  );
}

/** @caisson/local-store — hybrid retrieval (src/store.ts): a vec0 vector leg and an FTS5
 *  keyword leg rank independently, then fuse by Reciprocal Rank Fusion (RRF_K = 60). */
function LocalHybridRrf() {
  return (
    <Frame
      title="Hybrid retrieval: a vec0 vector leg and an FTS5 keyword leg rank independently, then fuse by Reciprocal Rank Fusion — with no query vector it degrades to keyword-only."
      bar="local-hybrid-rrf.svg"
    >
      <Arrowheads />
      <Node x={10} y={28} w={88} h={36} head="vec0 KNN" sub="vector leg" />
      <Node x={10} y={108} w={88} h={36} head="FTS5" sub="keyword leg" />
      <path
        d={`M 100 50 L 132 78`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 100 122 L 132 94`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <Node
        x={136}
        y={68}
        w={88}
        h={36}
        head="RRF fuse"
        sub="k = 60"
        tone="accent"
      />
      <path
        d={`M 226 86 L 248 86`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <Node
        x={252}
        y={68}
        w={80}
        h={36}
        head="top hits"
        sub="one ranking"
        tone="success"
      />
      <Note x={10} y={168}>
        no query vector → FTS5-only, still returns
      </Note>
    </Frame>
  );
}

/** @caisson/agent-kernel — the 7-act lifecycle FSM (src/lifecycle.ts): the canonical chain plus
 *  the real verify→plan branch edge; an illegal skip throws, never a silent pass. */
function AgentLifecycleFsm() {
  const acts = ["spec", "plan", "execute", "verify", "sweep", "eval", "ship"];
  const w = 45;
  const step = 47;
  const y = 62;
  return (
    <Frame
      title="The seven-act lifecycle FSM: only legal transitions advance — a failed verify re-opens plan, and an illegal skip throws a typed error, never a silent pass."
      bar="agent-lifecycle-fsm.svg"
    >
      <Arrowheads />
      {acts.map((a, i) => {
        const x = 6 + i * step;
        return (
          <g key={a}>
            {i < acts.length - 1 ? (
              <path
                d={`M ${x + w} ${y + 15} L ${x + step} ${y + 15}`}
                className={styles.chainLink}
              />
            ) : null}
            <rect
              x={x}
              y={y}
              width={w}
              height={30}
              rx={6}
              className={styles.node}
            />
            <text
              x={x + w / 2}
              y={y + 19}
              className={styles.actHead}
              {...fit(a, 9, w - 8)}
            >
              {a}
            </text>
          </g>
        );
      })}
      {/* verify → plan: the real branch edge — a failed goal-backward verify re-opens PLAN. */}
      <path
        d={`M 170 ${y - 4} Q 124 ${y - 34} 78 ${y - 4}`}
        className={styles.chainLink}
        markerEnd="url(#cs-arrow)"
      />
      <Note x={92} y={y - 32}>
        verify fails → re-plan
      </Note>
      {/* spec → execute: an illegal skip — transition() throws. */}
      <path
        d={`M 28 ${y + 34} Q 76 ${y + 64} 124 ${y + 34}`}
        className={styles.arrowDanger}
        markerEnd="url(#cs-arrow-danger)"
      />
      <Note danger x={40} y={y + 74}>
        illegal skip → throws
      </Note>
      <Note x={6} y={176}>
        runLifecycle validates every consecutive pair
      </Note>
    </Frame>
  );
}

/** @caisson/agent-runner — the scrubbed-env sandbox (src/agent-runner.ts): the child env is
 *  built from scratch (never spread from process.env) — a fixed non-secret allowlist plus only
 *  the target provider's key — and the run streams to an auditable .jsonl transcript. */
function RunnerEnvScrub() {
  return (
    <Frame
      title="The child env is built from scratch: a fixed non-secret allowlist plus only the target provider's key crosses — the run streams to an auditable .jsonl transcript."
      bar="runner-env-scrub.svg"
    >
      <Arrowheads />
      <path
        d={`M 104 55 L 118 55`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 216 55 L 230 55`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <Node x={12} y={36} w={92} h={38} head="parent env" sub="holds secrets" />
      <Node
        x={124}
        y={36}
        w={92}
        h={38}
        head="buildEngineEnv"
        sub="allowlist only"
        tone="accent"
      />
      <Node
        x={236}
        y={36}
        w={92}
        h={38}
        head="agent CLI"
        sub="isolated worktree"
        tone="success"
      />
      <path
        d={`M 58 76 L 58 106`}
        className={styles.arrowDanger}
        markerEnd="url(#cs-arrow-danger)"
      />
      <Note danger x={12} y={124}>
        secrets dropped — never spread from process.env
      </Note>
      <Note x={12} y={160}>
        only the provider key crosses — transcript to .jsonl
      </Note>
    </Frame>
  );
}

/** @caisson/retention-runner — `runErasure` (src/run-erasure.ts): every registered target runs
 *  with per-target error isolation (the allSettled shape ADR-0152 locks), then the injected sink
 *  writes exactly one reason-tagged audit row. */
function RetentionErasure() {
  return (
    <Frame
      title="One validated erasure request fans out to every registered target with per-target error isolation — a failing store lands in its own result, never aborting the others — then exactly one reason-tagged audit row is written."
      bar="retention-erasure.svg"
    >
      <Arrowheads />
      <Node
        x={10}
        y={64}
        w={88}
        h={36}
        head="runErasure"
        sub="strict request"
        tone="accent"
      />
      <path
        d={`M 98 82 L 132 30`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 98 82 L 132 82`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 98 82 L 132 134`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <Node x={136} y={16} w={96} h={28} head="object storage" />
      <Node
        x={136}
        y={68}
        w={96}
        h={28}
        head="cascade DB"
        sub="throws — caught"
        tone="danger"
      />
      <Node x={136} y={120} w={96} h={28} head="orphan sweep" />
      <path
        d={`M 232 30 L 248 76`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 232 82 L 248 82`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <path
        d={`M 232 134 L 248 88`}
        className={styles.arrow}
        markerEnd="url(#cs-arrow)"
      />
      <Node
        x={252}
        y={64}
        w={80}
        h={36}
        head="audit row"
        sub="reason-tagged"
        tone="success"
      />
      <Note danger x={10} y={166}>
        a throw lands in its own result — the run continues
      </Note>
      <Note x={10} y={180}>
        reasons: auto_90d · ccpa_request · operator_manual
      </Note>
    </Frame>
  );
}

const DIAGRAMS: Record<DiagramKey, () => React.ReactElement> = {
  "rls-deny": RlsDeny,
  "audit-chain": AuditChain,
  "worm-lifecycle": WormLifecycle,
  "credits-ledger": CreditsLedger,
  "local-sync-merge": LocalSyncMerge,
  "local-inference-egress": LocalInferenceEgress,
  "privacy-gate": PrivacyGate,
  "tool-exec-gate": ToolExecGate,
  "org-controls-mutation": OrgControlsMutation,
  "billing-provider-port": BillingProviderPort,
  "frameworks-oscal": FrameworksOscal,
  "alert-pipeline": AlertPipeline,
  "meter-reserve-reconcile": MeterReserveReconcile,
  "eval-baseline-gate": EvalBaselineGate,
  "guard-fail-closed": GuardFailClosed,
  "prompt-render-boundary": PromptRenderBoundary,
  "local-hybrid-rrf": LocalHybridRrf,
  "agent-lifecycle-fsm": AgentLifecycleFsm,
  "runner-env-scrub": RunnerEnvScrub,
  "retention-erasure": RetentionErasure,
};

export function MarketplaceDiagram({ name }: { name: DiagramKey }) {
  const D = DIAGRAMS[name];
  return <D />;
}
