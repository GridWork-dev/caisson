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

function Frame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <MediaFrame label={title} decorative>
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
      >
        {head}
      </text>
      {sub ? (
        <text x={x + w / 2} y={y + h / 2 + 10} className={styles.sub}>
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
    <Frame title="Per-tenant RLS isolation, fail-closed: with tenant context set a query returns only that tenant's rows; with no context set it returns zero rows.">
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
    <Frame title="Append-only hash chain: each entry commits SHA-256 over the previous hash plus its payload — editing one row breaks every link after it.">
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
      <text x={92} y={140} className={styles.noteDanger}>
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
    <Frame title="Evidence lifecycle: a privileged write joins the append-only chain, anchors to WORM under S3 Object-Lock, then verifies and exports as an evidence pack.">
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
      <text x={176} y={150} className={styles.note}>
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
  stages,
  note,
}: {
  title: string;
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
    <Frame title={title}>
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
        <text x={gap} y={148} className={styles.note}>
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
      stages={[
        { head: "4 providers", sub: "Paddle · Stripe · LS · Polar" },
        { head: "BillingProvider", sub: "one port", tone: "accent" },
        { head: "webhook", sub: "idempotent", tone: "success" },
      ]}
      note="a domain event stream on top — never a per-provider fork"
    />
  );
}

function FrameworksOscal() {
  return (
    <StageFlow
      title="Named framework clauses map to controls, then export as an OSCAL v1.2.2 catalog the evidence packs render against."
      stages={[
        { head: "frameworks", sub: "SOC 2 · HIPAA · EU AI Act" },
        { head: "clause → control", sub: "the mapping", tone: "accent" },
        { head: "OSCAL v1.2.2", sub: "export", tone: "success" },
      ]}
      note="the catalog the evidence-pack generator renders against"
    />
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
};

export function MarketplaceDiagram({ name }: { name: DiagramKey }) {
  const D = DIAGRAMS[name];
  return <D />;
}
