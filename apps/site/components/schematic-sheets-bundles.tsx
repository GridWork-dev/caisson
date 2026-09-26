import { Chip, HAIRLINE, Sheet } from "./schematics";
import styles from "./schematics.module.css";

// Bespoke bundle cross-section sheets (ADR-0377 locked language, executing ADR-0378 lock 1
// migrate-all): the five remaining persona/whole-catalog bundles, in the cross-section strata
// register `ComplianceCrossSection` shipped (schematics.tsx). This file owns only these five
// sheets; the shared vocabulary (Sheet, Chip, HAIRLINE) and the register's CSS classes are
// imported, never redefined.
//
// Honest-artifact floor (ADR-0082): every member chip is a real registry-pinned member of the
// bundle. Sources read for this file: each bundle's `packages/<id>/manifest.ts` (the frozen
// `members` pin map, the sole membership truth), `lib/catalog.ts` `modulesByBundle()` (which of
// those members is a priced à-la-carte SKU vs. base substrate composed at no separate price), and
// `lib/bundle-pages.ts` (the page's own member list + base-substrate framing, e.g. ai-config
// "composed in at no separate module price"). Bedrock storage claims are read from the member
// package's own source: audit-worm's `chain-store.ts`/`store.s3.ts` (Postgres + S3 Object-Lock),
// ai-meter/credits (PG-atomic), agent-trajectory's `store.pg.ts` (Postgres), and local-store's
// `store.ts` (`bun:sqlite` + `sqlite-vec` + FTS5, on-device SQLite). Kernel's base-band presence is
// verified per bundle, not asserted uniformly: AI-Production, Local-first, and Agentic-Dev pin
// `@caisson/kernel` directly in their own manifest `members` map (direct pin, no dependency-graph
// reasoning needed). Provenance never pins kernel directly, but each of its three seam members
// (field-crypto, audit-worm, signing-primitive) carries `@caisson/kernel` as a real `package.json`
// workspace dependency (verified per package), so kernel still belongs in its base band. Everything
// draws no kernel chip at all (see that sheet's own comment below for why).
//
// No legacy `marketplace-diagrams.tsx` mechanism diagram targets bundle:ai-production,
// bundle:local-first, bundle:agentic-dev, or bundle:everything (checked `DIAGRAM_TARGETS` in
// `lib/media-manifest.ts`, read-only) — nothing there to fold in. bundle:provenance is targeted by
// the shared `audit-chain` and `worm-lifecycle` mechanism diagrams (the hash chain and the WORM
// write/anchor/verify lifecycle); this sheet's audit-worm seam member plus the Postgres and S3
// Object-Lock bedrock chips cover that same claim (the chain lives on Postgres, the WORM anchor on
// S3 Object-Lock, exactly as those diagrams depict). Wiring `DIAGRAM_TARGETS`/`DIAGRAM_ORDER` stays
// the main thread's job.
//
// All five sheets draw every commercial member (no "N of M" truncation — each bundle's real
// commercial-member count is small enough to draw in full), so unlike the Compliance pilot none of
// these needs an on-sheet drawn-subset disclosure.

interface StrataChip {
  x: number;
  y: number;
  w: number;
  label: string;
}

/** Base/bedrock chips always sit on their band's one fixed row (`Strata` hardcodes the y), so
 *  their descriptor carries no y of its own. */
interface RowChip {
  x: number;
  w: number;
  label: string;
}

/** The shared cross-section scaffold: the waterline, the three fixed-geometry bands (module seam,
 *  Apache-2.0 base, bedrock), the bedrock hatch, and the depth gauge are byte-identical across
 *  every bundle sheet, matching `ComplianceCrossSection`'s shipped geometry exactly (same band
 *  y-ranges, same gauge ticks) so the whole register reads as one drawing system. Only which chips
 *  populate each band differs per bundle — that's the one thing each sheet function supplies. The
 *  module-seam band is the sheet's ONE semantic accent element (the accent-colored seam line +
 *  label); base and bedrock chips render on the neutral `onBase` chip style, same as the shipped
 *  pilot. */
function Strata({
  seam,
  base,
  bedrock,
}: {
  seam: readonly StrataChip[];
  base: readonly RowChip[];
  bedrock: readonly RowChip[];
}) {
  return (
    <>
      <text x={163} y={9} className={styles.sub}>
        your app
      </text>
      <path
        d={`M 8 13 ${Array.from({ length: 19 }, () => "q 8 -4 16 0").join(" ")}`}
        className={styles.waterline}
        {...HAIRLINE}
      />
      {/* seam band, the ONE accent element: the layer being bought */}
      <rect
        x={8}
        y={18}
        width={308}
        height={86}
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
      {seam.map((c) => (
        <Chip key={c.label} x={c.x} y={c.y} w={c.w} label={c.label} />
      ))}
      {/* base band */}
      <rect
        x={8}
        y={104}
        width={308}
        height={38}
        className={styles.bandBase}
        {...HAIRLINE}
      />
      <text x={14} y={116} className={styles.bandLabel}>
        BASE SUBSTRATE · APACHE-2.0
      </text>
      {base.map((c) => (
        <Chip key={c.label} x={c.x} y={122} w={c.w} label={c.label} onBase />
      ))}
      {/* bedrock */}
      <rect
        x={8}
        y={142}
        width={308}
        height={28}
        className={styles.bandBedrock}
        {...HAIRLINE}
      />
      <text x={14} y={159} className={styles.bandLabel}>
        BEDROCK
      </text>
      {bedrock.map((c) => (
        <Chip key={c.label} x={c.x} y={148} w={c.w} label={c.label} onBase />
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <line
          key={i}
          x1={270 + i * 10}
          y1={166}
          x2={280 + i * 10}
          y2={146}
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
        { y: 104, label: "-1" },
        { y: 142, label: "-2" },
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
    </>
  );
}

// ===== bundle:ai-production =====
// Seam = modulesByBundle("ai-production"): field-crypto, ai-meter, guardrails, prompt-registry,
// ai-evals, credits (catalog.ts). Base = the manifest's remaining pinned members (kernel,
// tenancy-rls, ai-config) — bundle-pages.ts calls ai-config out by name as "base substrate,
// composed in at no separate module price". Bedrock = Postgres: ai-meter's reserve/reconcile spend
// window is a PG-atomic upsert and credits is a PG-atomic ledger (both already-shipped mechanism
// diagram captions, meter-reserve-reconcile / credits-ledger).
export function AiProductionCrossSection() {
  return (
    <Sheet
      title="The AI-Production bundle in cross-section: six commercial members at the module seam, composing onto the kernel, tenancy-rls, and ai-config base, on a Postgres bedrock"
      bar="bundle: ai-production · cross-section · 6 members drawn"
    >
      <Strata
        seam={[
          { x: 14, y: 36, w: 140, label: "field-crypto" },
          { x: 162, y: 36, w: 140, label: "ai-meter" },
          { x: 14, y: 58, w: 140, label: "guardrails" },
          { x: 162, y: 58, w: 140, label: "prompt-registry" },
          { x: 14, y: 80, w: 140, label: "ai-evals" },
          { x: 162, y: 80, w: 140, label: "credits" },
        ]}
        base={[
          { x: 14, w: 60, label: "kernel" },
          { x: 82, w: 110, label: "tenancy-rls" },
          { x: 200, w: 108, label: "ai-config" },
        ]}
        bedrock={[{ x: 129, w: 66, label: "Postgres" }]}
      />
    </Sheet>
  );
}

// ===== bundle:local-first =====
// Seam = modulesByBundle("local-first"): local-store, local-sync, local-inference,
// local-privacy, field-crypto. Base = the manifest's kernel + license-verify (both Apache-2.0 base
// packages). Bedrock = SQLite: local-store's store.ts runs raw bun:sqlite plus the sqlite-vec
// vec0 extension and FTS5, on disk, one file per tenant (the catalog.ts blurb) — never Postgres.
export function LocalFirstCrossSection() {
  return (
    <Sheet
      title="The Local-first bundle in cross-section: five commercial members at the module seam, composing onto the kernel and license-verify base, on an on-device SQLite bedrock"
      bar="bundle: local-first · cross-section · 5 members drawn"
    >
      <Strata
        seam={[
          { x: 14, y: 36, w: 140, label: "local-store" },
          { x: 162, y: 36, w: 140, label: "local-sync" },
          { x: 14, y: 58, w: 140, label: "local-inference" },
          { x: 162, y: 58, w: 140, label: "local-privacy" },
          { x: 88, y: 80, w: 140, label: "field-crypto" },
        ]}
        base={[
          { x: 14, w: 90, label: "kernel" },
          { x: 112, w: 140, label: "license-verify" },
        ]}
        bedrock={[{ x: 112, w: 100, label: "SQLite" }]}
      />
    </Sheet>
  );
}

// ===== bundle:agentic-dev =====
// Seam = modulesByBundle("agentic-dev"): agent-kernel, agent-runner, agent-trajectory,
// local-store, tool-exec. Base = the manifest's kernel + ai-config. Bedrock = Postgres (agent-
// trajectory's store.pg.ts is the append-only PG-backed TrajectoryStore) plus SQLite (local-store,
// the same on-device store the Local-first sheet draws) — the bundle's two real member stores.
export function AgenticDevCrossSection() {
  return (
    <Sheet
      title="The Agentic-Dev bundle in cross-section: five commercial members at the module seam, composing onto the kernel and ai-config base, on Postgres and on-device SQLite bedrock"
      bar="bundle: agentic-dev · cross-section · 5 members drawn"
    >
      <Strata
        seam={[
          { x: 14, y: 36, w: 140, label: "agent-kernel" },
          { x: 162, y: 36, w: 140, label: "agent-runner" },
          { x: 14, y: 58, w: 140, label: "agent-trajectory" },
          { x: 162, y: 58, w: 140, label: "local-store" },
          { x: 88, y: 80, w: 140, label: "tool-exec" },
        ]}
        base={[
          { x: 14, w: 90, label: "kernel" },
          { x: 112, w: 100, label: "ai-config" },
        ]}
        bedrock={[
          { x: 92, w: 66, label: "Postgres" },
          { x: 166, w: 66, label: "SQLite" },
        ]}
      />
    </Sheet>
  );
}

// ===== bundle:provenance =====
// Seam = the manifest's three pinned members: field-crypto, audit-worm, signing-primitive (a
// strict member-subset of Compliance, per the manifest comment). Base = kernel: not a top-level
// manifest pin for this bundle, but a real `package.json` workspace dependency of all three seam
// members (verified). Bedrock = Postgres + S3 Object-Lock — identical to Compliance's, since
// audit-worm's chain-store.ts (Postgres) and store.s3.ts (S3 Object-Lock WORM) are the same module
// this bundle composes; covers the audit-chain/worm-lifecycle mechanism diagrams' bundle:provenance
// target (the hash-chain and WORM-anchor claims those diagrams make).
export function ProvenanceCrossSection() {
  return (
    <Sheet
      title="The Provenance bundle in cross-section: three commercial members at the module seam, composing onto the kernel base, on Postgres and S3 Object-Lock bedrock"
      bar="bundle: provenance · cross-section · 3 members drawn"
    >
      <Strata
        seam={[
          { x: 14, y: 58, w: 86, label: "field-crypto" },
          { x: 108, y: 58, w: 76, label: "audit-worm" },
          { x: 192, y: 58, w: 118, label: "signing-primitive" },
        ]}
        base={[{ x: 117, w: 90, label: "kernel" }]}
        bedrock={[
          { x: 94, w: 66, label: "Postgres" },
          { x: 166, w: 98, label: "S3 Object-Lock" },
        ]}
      />
    </Sheet>
  );
}

// ===== bundle:everything =====
// Seam = the everything manifest's own explicit full-catalog framing (its top comment: "the five
// sibling persona-bundle metas are themselves sellable SKUs and are IN"), drawn at bundle
// granularity rather than per-module: the five persona bundles (compliance, ai-production,
// local-first, agentic-dev, provenance) plus the three standalone platform SKUs no persona bundle
// grants (org-controls, billing-orchestration, ui-pro — catalog.ts's `bundles: []` modules). All
// eight drawn, matching the manifest description verbatim ("every bundle ... plus every standalone
// module (org-controls, billing-orchestration, ui-pro)"). Base = one chip, quoting the manifest's
// own base framing ("the open Apache base ships free") rather than itemized packages, since
// Everything's own manifest doesn't pin kernel/tenancy-rls as top-level members the way the
// persona bundles do. Bedrock = the union of every real storage substrate the catalog composes:
// Postgres (audit-worm, ai-meter, credits, agent-trajectory), S3 Object-Lock (audit-worm WORM),
// and on-device SQLite (local-store).
export function EverythingCrossSection() {
  return (
    <Sheet
      title="The Everything bundle in cross-section: five persona bundles plus three platform modules at the module seam, composing onto the Apache-2.0 base, on Postgres, S3 Object-Lock, and on-device SQLite bedrock"
      bar="bundle: everything · cross-section · 5 bundles + 3 platform modules drawn"
    >
      <Strata
        seam={[
          { x: 14, y: 36, w: 80, label: "compliance" },
          { x: 102, y: 36, w: 98, label: "ai-production" },
          { x: 208, y: 36, w: 92, label: "local-first" },
          { x: 14, y: 58, w: 90, label: "agentic-dev" },
          { x: 112, y: 58, w: 84, label: "provenance" },
          { x: 204, y: 58, w: 96, label: "org-controls" },
          { x: 14, y: 80, w: 180, label: "billing-orchestration" },
          { x: 202, y: 80, w: 100, label: "ui-pro" },
        ]}
        base={[{ x: 14, w: 290, label: "apache-2.0 base · ships free" }]}
        bedrock={[
          { x: 16, w: 62, label: "Postgres" },
          { x: 86, w: 96, label: "S3 Object-Lock" },
          { x: 190, w: 62, label: "SQLite" },
        ]}
      />
    </Sheet>
  );
}
