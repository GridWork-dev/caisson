/**
 * Break-the-chain — the "chain" beat (ADR-0102), shown mid-tamper as a STATIC still (the site
 * animates OK→FAIL once on scroll; reduced-motion gets exactly this frame). Block 03 is edited, so
 * its hash recomputes and the stored prev-hash in every block after it no longer matches — the chain
 * breaks at 02→03 and verifyChain() reads FAIL. The break uses the reserved `danger` token only
 * (never a new accent), per the craft floor.
 */
interface Block {
  n: string;
  hash: string;
  state: "intact" | "edited" | "broken";
}

const BLOCKS: Block[] = [
  { n: "01", hash: "9f2a…", state: "intact" },
  { n: "02", hash: "c4e1…", state: "intact" },
  { n: "03", hash: "7b08…", state: "edited" },
  { n: "04", hash: "a013…", state: "broken" },
  { n: "05", hash: "5d9c…", state: "broken" },
  { n: "06", hash: "e6f4…", state: "broken" },
];

const W = 60;
const GAP = 14;
const X0 = 14;
const Y = 46;
const H = 48;
const x = (i: number) => X0 + i * (W + GAP);

const STROKE: Record<Block["state"], string> = {
  intact: "var(--cs-border-strong)",
  edited: "var(--cs-accent)",
  broken: "var(--cs-danger)",
};

export function BreakTheChain() {
  return (
    <svg
      viewBox="0 0 468 188"
      width="100%"
      role="img"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", height: "auto" }}
    >
      <title>
        An append-only audit hash-chain: block 03 is edited, breaking every link
        after it so verifyChain returns FAIL.
      </title>

      {/* Connectors between blocks. The 02→03 boundary is the break. */}
      <g strokeWidth="2" fill="none">
        {BLOCKS.slice(0, -1).map((_, i) => {
          const cx = x(i) + W;
          const cy = Y + H / 2;
          const broken = i >= 2; // links from 03 onward are invalid
          if (i === 2) {
            // the break point — a split link with a gap
            return (
              <g key={i} stroke="var(--cs-danger)">
                <path d={`M${cx} ${cy} l5 -4`} />
                <path d={`M${cx} ${cy} l5 4`} />
                <path d={`M${cx + GAP} ${cy} l-5 -4`} />
                <path d={`M${cx + GAP} ${cy} l-5 4`} />
              </g>
            );
          }
          return (
            <path
              key={i}
              d={`M${cx} ${cy} L${cx + GAP} ${cy}`}
              stroke={broken ? "var(--cs-danger)" : "var(--cs-border-strong)"}
              strokeDasharray={broken ? "3 3" : undefined}
            />
          );
        })}
      </g>

      {/* Blocks. */}
      {BLOCKS.map((b, i) => (
        <g key={b.n}>
          {b.state === "broken" && (
            <rect
              x={x(i)}
              y={Y}
              width={W}
              height={H}
              rx="5"
              fill="var(--cs-danger)"
              opacity="0.1"
            />
          )}
          <rect
            x={x(i)}
            y={Y}
            width={W}
            height={H}
            rx="5"
            fill="var(--cs-surface-1)"
            stroke={STROKE[b.state]}
            strokeWidth={b.state === "intact" ? 1.5 : 2}
          />
          <text
            x={x(i) + 8}
            y={Y + 17}
            fill="var(--cs-fg-muted)"
            fontFamily="var(--cs-font-mono)"
            fontSize="11"
          >
            #{b.n}
          </text>
          <text
            x={x(i) + W / 2}
            y={Y + 36}
            textAnchor="middle"
            fontFamily="var(--cs-font-mono)"
            fontSize="13"
            fill={
              b.state === "broken"
                ? "var(--cs-danger)"
                : b.state === "edited"
                  ? "var(--cs-accent)"
                  : "var(--cs-fg)"
            }
          >
            {b.hash}
          </text>
        </g>
      ))}

      {/* "edited" tag over block 03. */}
      <text
        x={x(2) + W / 2}
        y={Y - 8}
        textAnchor="middle"
        fill="var(--cs-accent)"
        fontFamily="var(--cs-font-mono)"
        fontSize="10"
      >
        ✎ edited
      </text>

      {/* verifyChain verdict. */}
      <g fontFamily="var(--cs-font-mono)" fontSize="12">
        <text x="14" y="132" fill="var(--cs-fg-muted)">
          verifyChain()
        </text>
        {/* alert glyph */}
        <path
          d="M120 124 l8 14 h-16 z"
          fill="none"
          stroke="var(--cs-danger)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line
          x1="120"
          y1="129"
          x2="120"
          y2="133"
          stroke="var(--cs-danger)"
          strokeWidth="1.5"
        />
        <circle cx="120" cy="136" r="0.8" fill="var(--cs-danger)" />
        <text x="136" y="132" fill="var(--cs-danger)" fontWeight="600">
          FAIL
        </text>
        <text x="184" y="132" fill="var(--cs-fg-muted)">
          01–02 intact · 03–06 broken
        </text>
      </g>
    </svg>
  );
}
