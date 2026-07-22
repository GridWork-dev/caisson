import { MediaFrame } from "./media-frame";
import styles from "./schematics.module.css";

// Bespoke module/bundle schematics (ADR-0377, executing the ADR-0376 lock-2 kickoff): the hybrid
// direction — blueprint linework sheets for module pages, cross-section strata for bundle pages —
// built as a shared primitive vocabulary this file owns. Server components, no interactivity.
//
// Honest-artifact floor (ADR-0082/0237, SPEC §3): every sheet depicts the real package
// architecture — seam, port, and function names verbatim from the code the sheet cites; sample
// values (a key version) are visibly samples; drawn subsets are declared on-sheet. A diagram is
// a claim.
//
// Craft rules (the ADR-0377 reference synthesis): stroke-first with minimal fill; hairline
// linework pinned in device px (vector-effect: non-scaling-stroke) so the sheets keep the
// engineering-drawing register at every render size; mono labels 8–10px, never scaled up to fill
// space; ONE semantic accent element per sheet (the gate / the seam — ADR-0375 restraint);
// static, framed, one sheet to one claim.

const VIEW_W = 340;
const VIEW_H = 190;

/** Approximate mono advance width (em) — same margin convention as marketplace-diagrams.tsx. */
const CHAR_W = 0.72;

/** SVG `textLength` clamp: squeeze a label that would paint past its box instead of overflowing. */
function fit(
  text: string,
  fontPx: number,
  maxW: number,
): { textLength: number; lengthAdjust: "spacingAndGlyphs" } | undefined {
  return text.length * fontPx * CHAR_W > maxW
    ? { textLength: maxW, lengthAdjust: "spacingAndGlyphs" }
    : undefined;
}

/** Pin stroke width in device px — the hairline-linework signature of the schematic register. */
const HAIRLINE = { vectorEffect: "non-scaling-stroke" } as const;

function Sheet({
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
      <div className={styles.sheetFrame}>
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

/** One sharp-cornered blueprint node (rx 2 — drawing register, not UI chrome). */
function SNode({
  x,
  y,
  w,
  h,
  head,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  head: string;
  sub?: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        className={styles.node}
        {...HAIRLINE}
      />
      <text
        x={x + w / 2}
        y={sub ? y + h / 2 - 2 : y + h / 2 + 3.5}
        className={styles.head}
        {...fit(head, 10, w - 8)}
      >
        {head}
      </text>
      {sub ? (
        <text
          x={x + w / 2}
          y={y + h / 2 + 9}
          className={styles.sub}
          {...fit(sub, 8, w - 6)}
        >
          {sub}
        </text>
      ) : null}
    </g>
  );
}

/** A flow line with an explicit arrowhead (no marker refs — markers break under `<use>` cloning
 *  and can't ride vector-effect; a drawn head inherits both). Horizontal or vertical. */
function Flow({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  const horizontal = y1 === y2;
  // Direction-aware head: the apex sits at (x2, y2), the base trails back along the travel axis.
  const s = horizontal ? Math.sign(x2 - x1) : Math.sign(y2 - y1);
  const head = horizontal
    ? `M ${x2} ${y2} l ${-5 * s} -3 v 6 z`
    : `M ${x2} ${y2} l -3 ${-5 * s} h 6 z`;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={horizontal ? x2 - 4 * s : x2}
        y2={horizontal ? y2 : y2 - 4 * s}
        className={styles.flow}
        {...HAIRLINE}
      />
      <path d={head} className={styles.flowHead} />
    </g>
  );
}

/** The sheet's ONE accent element: a dashed semantic boundary with its label. */
function Boundary({
  x,
  y,
  w,
  h,
  label,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={3}
        className={styles.boundary}
        {...HAIRLINE}
      />
      <text
        x={x + 8}
        y={y + 12}
        className={styles.boundaryLabel}
        {...fit(label, 9, w - 16)}
      >
        {label}
      </text>
    </g>
  );
}

/** A dimensioned strip: cells with widths, a dimension line beneath, per-cell measure labels. */
function ByteStrip({
  x,
  y,
  h,
  cells,
}: {
  x: number;
  y: number;
  h: number;
  cells: readonly { label: string; w: number; measure: string }[];
}) {
  let cx = x;
  const xs: number[] = [];
  const rendered = cells.map((c) => {
    const at = cx;
    xs.push(at);
    cx += c.w;
    return { ...c, at };
  });
  const end = cx;
  const dimY = y + h + 7;
  return (
    <g>
      {rendered.map((c) => (
        <g key={c.label}>
          <rect
            x={c.at}
            y={y}
            width={c.w}
            height={h}
            className={styles.cell}
            {...HAIRLINE}
          />
          <text
            x={c.at + c.w / 2}
            y={y + h / 2 + 3}
            className={styles.cellLabel}
            {...fit(c.label, 8.5, c.w - 4)}
          >
            {c.label}
          </text>
          <text
            x={c.at + c.w / 2}
            y={dimY + 9}
            className={styles.dimLabel}
            {...fit(c.measure, 8, c.w - 2)}
          >
            {c.measure}
          </text>
        </g>
      ))}
      <line
        x1={x}
        y1={dimY}
        x2={end}
        y2={dimY}
        className={styles.dim}
        {...HAIRLINE}
      />
      {[...xs, end].map((tx) => (
        <line
          key={tx}
          x1={tx}
          y1={dimY - 3}
          x2={tx}
          y2={dimY + 3}
          className={styles.dim}
          {...HAIRLINE}
        />
      ))}
    </g>
  );
}

/** The engineering title block, bottom-right corner. */
function TitleBlock({
  x,
  y,
  w,
  text,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={16}
        className={styles.titleBlock}
        {...HAIRLINE}
      />
      <text
        x={x + 6}
        y={y + 11}
        className={styles.titleBlockText}
        {...fit(text, 8, w - 12)}
      >
        {text}
      </text>
    </g>
  );
}

/** A strata chip (cross-section vocabulary). */
function Chip({
  x,
  y,
  w,
  label,
  onBase,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  onBase?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={16}
        rx={3}
        className={onBase ? styles.chipOnBase : styles.chip}
        {...HAIRLINE}
      />
      <text
        x={x + w / 2}
        y={y + 11}
        className={styles.chipLabel}
        {...fit(label, 8.5, w - 6)}
      >
        {label}
      </text>
    </g>
  );
}

// ===== Pilot 1 — field-crypto blueprint sheet =====
// Every name from the package (SPEC §3): derive.ts info-string format, cipher.ts AeadCipher port,
// provider.ts FieldKeyProvider.keyFor + the NO-REMIGRATION invariant, envelope.ts binary layout
// (format 1B | alg 1B | key_version uint16 BE | nonce 12B | ciphertext | tag 16B). v3 is a sample.
export function FieldCryptoSheet() {
  return (
    <Sheet
      title="field-crypto: HKDF per-tenant derivation into the AEAD gate, and the self-describing envelope byte layout"
      bar="packages/field-crypto · derivation, gate, envelope"
    >
      {/* derivation flow */}
      <SNode x={12} y={14} w={92} h={22} head="MASTER_FIELD_KEY" />
      <Flow x1={104} y1={25} x2={122} y2={25} />
      <SNode x={122} y={14} w={74} h={22} head="HKDF-SHA256" />
      <Flow x1={196} y1={25} x2={214} y2={25} />
      <SNode x={214} y={14} w={82} h={22} head="tenant key · v3" />
      <text
        x={122}
        y={48}
        className={styles.note}
        {...fit("info: caisson-field-crypto:v3:<tenant>", 8, 176)}
      >
        info: caisson-field-crypto:v3:&lt;tenant&gt;
      </text>
      <circle cx={306} cy={25} r={3} className={styles.port} {...HAIRLINE} />
      <text x={310} y={10} className={styles.portLabel} textAnchor="end">
        keyFor(tenant, v)
      </text>
      {/* the key drops into the gate */}
      <Flow x1={255} y1={36} x2={255} y2={62} />
      {/* the ONE accent element: the AEAD isolation gate */}
      <Boundary
        x={100}
        y={62}
        w={204}
        h={54}
        label="AeadCipher · the isolation gate"
      />
      <SNode x={158} y={78} w={86} h={20} head="AES-256-GCM" />
      <text
        x={252}
        y={106}
        className={styles.subDanger}
        {...fit("wrong tenant / column: throws", 8, 100)}
      >
        wrong tenant / column: throws
      </text>
      <text x={12} y={78} className={styles.note}>
        plaintext
      </text>
      <Flow x1={54} y1={82} x2={98} y2={82} />
      <text x={12} y={96} className={styles.note}>
        AAD: tenant ‖
      </text>
      <text
        x={12}
        y={106}
        className={styles.note}
        {...fit("key_ver ‖ column", 8, 82)}
      >
        key_ver ‖ column
      </text>
      <Flow x1={78} y1={101} x2={98} y2={101} />
      {/* ciphertext drops to the envelope */}
      <Flow x1={202} y1={116} x2={202} y2={130} />
      {/* the envelope byte layout, dimensioned */}
      <ByteStrip
        x={12}
        y={132}
        h={20}
        cells={[
          { label: "ver", w: 26, measure: "1 B" },
          { label: "alg", w: 26, measure: "1 B" },
          { label: "key_ver", w: 42, measure: "2 B" },
          { label: "nonce", w: 50, measure: "12 B" },
          { label: "ciphertext", w: 116, measure: "n B" },
          { label: "tag", w: 42, measure: "16 B" },
        ]}
      />
      <text
        x={12}
        y={182}
        className={styles.note}
        {...fit("self-describing · old key versions decrypt forever", 8, 192)}
      >
        self-describing · old key versions decrypt forever
      </text>
      <TitleBlock x={212} y={170} w={116} text="field-crypto · sheet 1/1" />
    </Sheet>
  );
}

// ===== Pilot 2 — audit-worm blueprint sheet =====
// The append→chain→anchor→WORM path and the truncation guard, names from chain-store.ts /
// store.s3.ts (SPEC §3): kernel's chainEntry/canonicalize/anchorChain, the length-keyed anchor,
// the IfNoneMatch:* write-once put, verify()'s length-oracle check, and the SELECT+INSERT-only
// privilege grant.
export function AuditWormSheet() {
  return (
    <Sheet
      title="audit-worm: each append mints a length-keyed anchor into write-once storage; verify uses the WORM store as the trusted length oracle"
      bar="packages/audit-worm · chain, anchor, truncation guard"
    >
      <SNode x={12} y={14} w={78} h={22} head="append(entry)" />
      <Flow x1={90} y1={25} x2={108} y2={25} />
      <SNode
        x={108}
        y={14}
        w={92}
        h={22}
        head="chainEntry"
        sub="canonicalize · kernel"
      />
      <Flow x1={200} y1={25} x2={218} y2={25} />
      <SNode x={218} y={14} w={92} h={22} head="anchorChain · N" />
      {/* the anchor crosses the write-once boundary */}
      <Flow x1={264} y1={36} x2={264} y2={56} />
      {/* the ONE accent element: the write-once boundary */}
      <Boundary
        x={178}
        y={56}
        w={150}
        h={52}
        label="S3 Object-Lock · write-once"
      />
      <SNode
        x={192}
        y={74}
        w={122}
        h={26}
        head="anchor · key(acct, N)"
        sub="IfNoneMatch:* → 412"
      />
      {/* verify reads the oracle */}
      <SNode x={12} y={68} w={70} h={22} head="verify()" />
      <Flow x1={176} y1={90} x2={84} y2={90} />
      <text
        x={88}
        y={104}
        className={styles.note}
        {...fit("the trusted length oracle", 8, 100)}
      >
        the trusted length oracle
      </text>
      {/* the chain rows + the truncation case */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={12 + i * 44}
            y={120}
            width={36}
            height={18}
            rx={2}
            className={styles.cell}
            {...HAIRLINE}
          />
          <text x={30 + i * 44} y={132} className={styles.cellLabel}>
            {`e${i + 1}`}
          </text>
          {i < 3 ? (
            <text x={52 + i * 44} y={132} className={styles.sub}>
              →
            </text>
          ) : null}
        </g>
      ))}
      <text
        x={192}
        y={132}
        className={styles.noteDanger}
        {...fit("anchor for N+1 ⇒ tail was cut", 8, 136)}
      >
        anchor for N+1 ⇒ tail was cut
      </text>
      <text
        x={12}
        y={156}
        className={styles.noteDanger}
        {...fit("a clean-hashing prefix still fails verify", 8, 190)}
      >
        a clean-hashing prefix still fails verify
      </text>
      <text
        x={12}
        y={170}
        className={styles.note}
        {...fit("table grants SELECT + INSERT only", 8, 190)}
      >
        table grants SELECT + INSERT only
      </text>
      <TitleBlock x={212} y={170} w={116} text="audit-worm · sheet 1/1" />
    </Sheet>
  );
}

// ===== Pilot 3 — Compliance bundle cross-section =====
// The literal caisson: strata below the waterline. Members from the bundle's pinned manifest
// (SPEC §3); kernel + tenancy-rls sit in the Apache-2.0 base band per the ADR-0094 open-core
// split; Postgres + S3 Object-Lock are the real bedrock. 9 of 13 members drawn — the entry
// package and the three 2026-07 SKU members are declared, not drawn.
export function ComplianceCrossSection() {
  return (
    <Sheet
      title="The Compliance bundle in cross-section: commercial members at the module seam, composing onto the Apache-2.0 base, on Postgres and S3 Object-Lock"
      bar="bundle: compliance · cross-section · 9 of 13 members drawn"
    >
      <text x={163} y={9} className={styles.sub}>
        your app
      </text>
      <path
        d={`M 8 13 ${Array.from({ length: 19 }, () => "q 8 -4 16 0").join(" ")}`}
        className={styles.waterline}
        {...HAIRLINE}
      />
      {/* seam band — the ONE accent element (line + label): the layer being bought */}
      <rect
        x={8}
        y={18}
        width={308}
        height={78}
        className={styles.bandSeam}
        {...HAIRLINE}
      />
      <line
        x1={8}
        y1={18}
        x2={316}
        y2={18}
        className={styles.seamLine}
        {...HAIRLINE}
      />
      <text x={14} y={30} className={styles.bandLabelAccent}>
        MODULE SEAM · THE BUNDLE
      </text>
      <Chip x={14} y={36} w={88} label="compliance-core" />
      <Chip x={108} y={36} w={94} label="signing-primitive" />
      <Chip x={208} y={36} w={90} label="frameworks-pack" />
      <Chip x={14} y={58} w={54} label="alerting" />
      <Chip x={72} y={58} w={84} label="retention-runner" />
      <Chip x={160} y={58} w={60} label="audit-worm" />
      <Chip x={224} y={58} w={70} label="field-crypto" />
      <text
        x={14}
        y={90}
        className={styles.note}
        {...fit(
          "evidence engine · Ed25519 signer · SOC2-TSC / HIPAA catalogs",
          8,
          294,
        )}
      >
        evidence engine · Ed25519 signer · SOC2-TSC / HIPAA catalogs
      </text>
      {/* base band */}
      <rect
        x={8}
        y={96}
        width={308}
        height={42}
        className={styles.bandBase}
        {...HAIRLINE}
      />
      <text x={14} y={108} className={styles.bandLabel}>
        BASE SUBSTRATE · APACHE-2.0
      </text>
      <Chip x={14} y={114} w={140} label="kernel · the chain algebra" onBase />
      <Chip x={162} y={114} w={136} label="tenancy-rls · FORCE RLS" onBase />
      {/* bedrock */}
      <rect
        x={8}
        y={138}
        width={308}
        height={32}
        className={styles.bandBedrock}
        {...HAIRLINE}
      />
      <text x={14} y={150} className={styles.bandLabel}>
        BEDROCK
      </text>
      <Chip x={70} y={152} w={60} label="Postgres" onBase />
      <Chip x={138} y={152} w={96} label="S3 Object-Lock" onBase />
      {Array.from({ length: 6 }, (_, i) => (
        <line
          key={i}
          x1={244 + i * 12}
          y1={168}
          x2={256 + i * 12}
          y2={144}
          className={styles.hatch}
          {...HAIRLINE}
        />
      ))}
      {/* depth gauge */}
      <line
        x1={326}
        y1={13}
        x2={326}
        y2={170}
        className={styles.gauge}
        {...HAIRLINE}
      />
      {[
        { y: 13, label: "0" },
        { y: 96, label: "-1" },
        { y: 138, label: "-2" },
        { y: 170, label: "-3" },
      ].map((t) => (
        <g key={t.label}>
          <line
            x1={323}
            y1={t.y}
            x2={329}
            y2={t.y}
            className={styles.gauge}
            {...HAIRLINE}
          />
          <text x={322} y={t.y + 3} className={styles.gaugeLabel}>
            {t.label}
          </text>
        </g>
      ))}
      {/* The member-subset disclosure lives in the MediaFrame bar (always visible) — the
          carousel's caption overlay covers this sheet's bottom rows in the card-viewer context. */}
    </Sheet>
  );
}
