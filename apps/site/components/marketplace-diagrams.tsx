import type { DiagramKey } from "@/lib/media-manifest";

import styles from "./marketplace-diagrams.module.css";

// Authored media-carousel diagrams (ADR-0285 §3) — the homepage's diagram language (per-tenant RLS
// deny-flow, audit-chain hash flow, WORM anchor lifecycle) rebuilt with more character: real SVG,
// token color accents, and layered depth, all inside the brand floor (every color is a --cs-* token,
// no raw hex). Server components (static, no interactivity). Each depicts SHIPPED behaviour only
// (copy law ADR-0080): the fail-closed RLS boundary, the SHA-256 chain, and the WORM lifecycle. The
// <MediaCarousel> wraps each in a labelled figure, so these carry only a decorative <title>.

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
    <div className={styles.frame}>
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

const DIAGRAMS: Record<DiagramKey, () => React.ReactElement> = {
  "rls-deny": RlsDeny,
  "audit-chain": AuditChain,
  "worm-lifecycle": WormLifecycle,
};

export function MarketplaceDiagram({ name }: { name: DiagramKey }) {
  const D = DIAGRAMS[name];
  return <D />;
}
