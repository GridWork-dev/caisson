// src/evidence/crosswalk-rollup.ts — the cross-framework evidence rollup (ADR-0333/ADR-0347).
//
// The v1 delta's core move: a PURE join over the framework packs' EXISTING per-control
// `crosswalk[]` pointers (no spine, no catalog consolidation -- ADR-0333 Fork A/C) that answers
// "does evidence gathered for ONE canonical control light up every OTHER framework's requirement
// it also covers?" Input is injected (catalogs, per-control statuses, regime crosswalks) so the
// function is deterministic and free of any concrete-catalog import -- the caller (the edge that
// already ran the collectors) supplies all three.
//
// CLAIM POSTURE (ADR-0333 Fork E, binding): a cell RESTATES, never ORIGINATES. `implements` renders
// only when (a) every canonical control contributing to the requirement is `ready`, (b) every
// contributing crosswalk reference carries a `reviewed`/`expert-reviewed`, non-stale `verification`
// record, AND (c) the requirement's regime-crosswalk row (where one exists, joined by framework
// label) is already `implements`. No matching regime row -- or any gap in (a)/(b) -- default to
// `maps-to`. A canonical control this run gathered NO evidence for (absent from `controlStatuses`)
// contributes nothing: the rollup reflects what THIS pack run evidenced, not the whole catalog.
//
// CANONICAL-CONTROL-ID-JOINED VIEWS (ADR-0347 Fork G1, Option B -- the locked `canonicalControlId`
// join; generalized by the oscal-spine SPEC, ADR-0363/ADR-0364, from an ISO-only pass into a loop):
// `@caisson-sh/frameworks-pack`'s `iso27001Crosswalk` and `nist80053Crosswalk` (`RegimeCrosswalk`s, not
// framework packs) have no `crosswalk[]` pointers of their own -- instead each of their rows carries
// a `canonicalControlId` pointing at a REAL canonical control already crosswalked from the three
// shipped packs. A pass below loops every regime crosswalk registered in
// `CANONICAL_JOIN_FRAMEWORK_LABEL` and joins ITS rows into the SAME `byRef` map as an ordinary
// contribution, so one collector run lights every such view exactly like the others. The Legal gate
// (ADR-0333) caps every such cell at `maps-to` -- enforced STRUCTURALLY here, not merely by the fact
// that every authored row in these crosswalks is `maps-to`: a canonicalControlId-driven contribution
// never carries a `verification` record, so condition (b) above can never hold for a cell it fed.
import { z } from "zod";
import { parseStrict, strictObject } from "@caisson-sh/kernel";
import {
  isVerificationStale,
  type CrosswalkVerification,
  type Framework,
  type RegimeCrosswalk,
  // The browser entry, not the `.` barrel (ADR-0396): `isVerificationStale` is the one VALUE
  // import here, and the specifier is what keeps this module (and everything that imports it)
  // free of frameworks-pack's node-only half. Same module behind both specifiers.
} from "@caisson-sh/frameworks-pack/browser";
import type { CollectorResult } from "./collector.ts";

/** Per-control coverage status for a single pack run — mirrors the manifest's readiness derivation
 *  plus `unresolved` (which never reaches a manifest, but the rollup is exercised standalone too). */
export type ControlStatus = "ready" | "gap" | "unresolved";

const STATUS_RANK: Readonly<Record<ControlStatus, number>> = {
  ready: 0,
  gap: 1,
  unresolved: 2,
};

/** The more severe of two statuses (unresolved > gap > ready). */
function worstStatus(a: ControlStatus, b: ControlStatus): ControlStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

/** Map one collector result's verdict to a `ControlStatus`. */
function statusFromResult(status: CollectorResult["status"]): ControlStatus {
  if (status === "pass") return "ready";
  if (status === "flagged") return "gap";
  return "unresolved";
}

/**
 * Derive a control's rollup status from its gathered evidence (worst-of; a single unresolved item
 * makes the whole control unresolved). A convenience for callers building the `controlStatuses` map
 * `computeCrosswalkRollup` consumes — mirrors `generate.ts`'s own readiness derivation.
 */
export function controlStatusFromEvidence(
  evidence: readonly CollectorResult[],
): ControlStatus {
  let worst: ControlStatus = "ready";
  for (const result of evidence) {
    worst = worstStatus(worst, statusFromResult(result.status));
  }
  return worst;
}

const claimSchema = z.enum(["maps-to", "implements"]);
const controlStatusSchema = z.enum(["ready", "gap", "unresolved"]);

/** One rollup cell: an external requirement (framework label + reference) and what evidences it. */
export const crosswalkRollupCellSchema = strictObject({
  /** External framework label, e.g. `SOC2-TSC`, `HIPAA-Security`. */
  framework: z.string().trim().min(1).max(80),
  /** The external requirement id (mirrors `CrosswalkReference.reference`). */
  reference: z.string().trim().min(1).max(200),
  /** Every canonical control (across every catalog) that crosswalks to this requirement. */
  canonicalControlIds: z.array(z.string()).min(1),
  /** Worst-of status across the contributing canonical controls. */
  status: controlStatusSchema,
  /** Mechanically-chosen claim language (ADR-0333 Fork E) — never editorial. */
  claim: claimSchema,
  /** Where the buyer looks for the evidence backing this cell (the contributing canonical control ids). */
  evidencePointers: z.array(z.string()).min(1),
  /**
   * Attached when a contributing reference cites an OLIR seed (NIST's own subjective/incomplete
   * warning). Readiness/posture language only — never a "compliant"/"certified"/"verified" marketing
   * claim (ADR-0080 copy law; extends the `pack-format.ts` `postureCopy` guard, ADR-0333 Legal gate,
   * to the rollup's own free-text field).
   */
  note: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((s) => !/\b(compliant|certified|verified)\b/i.test(s), {
      message:
        'rollup note must use readiness language, never claim "compliant"/"certified"/"verified" (ADR-0080)',
    })
    .optional(),
});
export type CrosswalkRollupCell = z.infer<typeof crosswalkRollupCellSchema>;

/** The full rollup — a flat, sorted (framework, reference) cell list (ADR-0006 append-only body). */
export const crosswalkRollupSchema = strictObject({
  cells: z.array(crosswalkRollupCellSchema),
});
export type CrosswalkRollup = z.infer<typeof crosswalkRollupSchema>;

/**
 * Framework label -> regime id, for the labels that have a buyer-facing regime crosswalk today
 * (`@caisson-sh/frameworks-pack` `regimes.ts`). Only SOC2-TSC and ISO-27001 are mapped in v1;
 * HIPAA-Security and EU-AI-Act have no regime crosswalk, so their cells always default `maps-to`
 * (correct — Fork E condition (c) has no row to satisfy). The ISO-27001 entry matters only if a
 * framework pack ever crosswalks a reference directly at that label (none do today, `iso27001Crosswalk`
 * itself is joined via `canonicalControlId` below, not through this map).
 */
const FRAMEWORK_LABEL_TO_REGIME: Readonly<Record<string, string | undefined>> =
  {
    "SOC2-TSC": "soc2",
    "ISO-27001": "iso-27001",
  };

/** The seed id `regimes.ts`/Group C would stamp on an OLIR-derived reference (ADR-0347 Fork G2). */
const OLIR_SEED_SOURCE_ID = "nist-sp800-53r5-iso27001-2022-olir";

/**
 * Regime id -> the rendered framework label a `canonicalControlId`-joined regime crosswalk
 * contributes cells under (ADR-0347 Fork G1, widened by the oscal-spine SPEC's task 4 from a
 * single ISO-only pass into a loop over every entry here). Only regimes with NO `crosswalk[]`
 * pointers of their own — the join runs the OTHER way, from their rows' own `canonicalControlId`
 * back into a canonical control — are listed: today ISO/IEC 27001:2022 and NIST SP 800-53 rev5.
 */
const CANONICAL_JOIN_FRAMEWORK_LABEL: Readonly<Record<string, string>> = {
  "iso-27001": "ISO-27001",
  "nist-800-53": "NIST-800-53",
};
const OLIR_NOTE =
  "Seeded from the NIST OLIR SP 800-53 rev5 <-> ISO/IEC 27001:2022 mapping. OLIR's own mappings " +
  "are subjective, incomplete, and not equivalence claims.";

/** Locale-independent lexicographic comparator (determinism must not depend on locale, mirrors generate.ts). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A JSON-array key avoids any ambiguity from a separator character appearing in a label/reference. */
function refKey(framework: string, reference: string): string {
  return JSON.stringify([framework, reference]);
}

export interface ComputeCrosswalkRollupInput {
  /** The framework packs to join against — pass all shipped packs regardless of the CURRENT pack's
   *  own target framework, so evidence gathered for one framework's control still lights the OTHER
   *  frameworks' requirements it shares a canonical control or crosswalk pointer with. */
  readonly catalogs: readonly Framework[];
  /** Per-canonical-control-id coverage status for THIS run. A control absent from the map was not
   *  evidenced this run and contributes no cell. */
  readonly controlStatuses: ReadonlyMap<string, ControlStatus>;
  /** The buyer-facing regime crosswalks (soc2/pci-dss/gdpr) — the Fork E condition (c) reference. */
  readonly regimeCrosswalks: readonly RegimeCrosswalk[];
}

interface Contribution {
  readonly controlId: string;
  readonly status: ControlStatus;
  readonly verification: CrosswalkVerification | undefined;
}

/** Whether a single contributing reference's verification is reviewed-or-better and not stale. */
function isReviewedAndFresh(
  verification: CrosswalkVerification | undefined,
): boolean {
  if (verification === undefined) return false;
  if (
    verification.status !== "reviewed" &&
    verification.status !== "expert-reviewed"
  ) {
    return false;
  }
  // ponytail: v1 has no live source re-ingestion pipeline (A2) — "current" is the record's own
  // digest, so this never actually catches drift yet. A future ingestion pipeline (e.g. a Group C
  // OLIR refresh) supplies a real live digest and this same check starts enforcing it.
  return !isVerificationStale(verification, verification.sourceDigest);
}

/**
 * Compute the cross-framework evidence rollup (ADR-0333/ADR-0347). Pure: no I/O, no clock, no
 * catalog import — every input is injected. Deterministic: cells are sorted `(framework,
 * reference)` regardless of `catalogs`/`controlStatuses` iteration order (R2 mitigation).
 */
export function computeCrosswalkRollup(
  input: ComputeCrosswalkRollupInput,
): CrosswalkRollup {
  const byRef = new Map<
    string,
    { framework: string; reference: string; contributions: Contribution[] }
  >();

  for (const catalog of input.catalogs) {
    for (const control of catalog.controls) {
      const status = input.controlStatuses.get(control.id);
      if (status === undefined) continue; // not evidenced this run — contributes nothing
      for (const ref of control.crosswalk) {
        const k = refKey(ref.framework, ref.reference);
        const entry = byRef.get(k) ?? {
          framework: ref.framework,
          reference: ref.reference,
          contributions: [],
        };
        entry.contributions.push({
          controlId: control.id,
          status,
          verification: ref.verification,
        });
        byRef.set(k, entry);
      }
    }
  }

  // canonicalControlId-joined views (ADR-0347 Fork G1, Option B; generalized by the oscal-spine
  // SPEC task 4 from an ISO-only pass into a loop over every regime crosswalk registered in
  // CANONICAL_JOIN_FRAMEWORK_LABEL above): join each such crosswalk's rows through their
  // `canonicalControlId` pointer into the SAME map, as an ordinary contribution -- but one that
  // NEVER carries a `verification` record, so the Legal gate (ADR-0333) holds structurally
  // (condition (b) below can never be satisfied by a canonicalControlId-driven contribution,
  // whichever regime it came from).
  const canonicalJoinNoteByLabel = new Map<string, string | undefined>();
  for (const regimeCrosswalk of input.regimeCrosswalks) {
    const frameworkLabel =
      CANONICAL_JOIN_FRAMEWORK_LABEL[regimeCrosswalk.regime];
    if (frameworkLabel === undefined) continue;
    canonicalJoinNoteByLabel.set(
      frameworkLabel,
      regimeCrosswalk.seedProvenance?.sourceId === OLIR_SEED_SOURCE_ID
        ? OLIR_NOTE
        : undefined,
    );
    for (const row of regimeCrosswalk.rows) {
      if (row.canonicalControlId === undefined) continue;
      const status = input.controlStatuses.get(row.canonicalControlId);
      if (status === undefined) continue; // not evidenced this run — contributes nothing
      const k = refKey(frameworkLabel, row.control);
      const entry = byRef.get(k) ?? {
        framework: frameworkLabel,
        reference: row.control,
        contributions: [],
      };
      entry.contributions.push({
        controlId: row.canonicalControlId,
        status,
        verification: undefined,
      });
      byRef.set(k, entry);
    }
  }

  const cells: CrosswalkRollupCell[] = [];
  for (const { framework, reference, contributions } of byRef.values()) {
    const canonicalControlIds = [
      ...new Set(contributions.map((c) => c.controlId)),
    ].sort(cmp);
    const status = contributions.reduce<ControlStatus>(
      (acc, c) => worstStatus(acc, c.status),
      "ready",
    );

    const allReady = contributions.every((c) => c.status === "ready");
    const allReviewed = contributions.every((c) =>
      isReviewedAndFresh(c.verification),
    );
    const regimeId = FRAMEWORK_LABEL_TO_REGIME[framework];
    const regime =
      regimeId === undefined
        ? undefined
        : input.regimeCrosswalks.find((rc) => rc.regime === regimeId);
    const regimeRow = regime?.rows.find((r) => r.control === reference);
    const regimeImplements = regimeRow?.claim === "implements";

    const claim: "maps-to" | "implements" =
      allReady && allReviewed && regimeImplements ? "implements" : "maps-to";
    const note = contributions.some(
      (c) => c.verification?.sourceId === OLIR_SEED_SOURCE_ID,
    )
      ? OLIR_NOTE
      : canonicalJoinNoteByLabel.get(framework);

    cells.push(
      parseStrict(crosswalkRollupCellSchema, {
        framework,
        reference,
        canonicalControlIds,
        status,
        claim,
        evidencePointers: canonicalControlIds,
        ...(note !== undefined ? { note } : {}),
      }),
    );
  }

  cells.sort(
    (a, b) => cmp(a.framework, b.framework) || cmp(a.reference, b.reference),
  );
  return parseStrict(crosswalkRollupSchema, { cells });
}
