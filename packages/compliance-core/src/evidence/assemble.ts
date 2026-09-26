// src/evidence/assemble.ts — the PURE half of the evidence-pack generator (ADR-0058, ADR-0396).
//
// Phases 1 and 2 of `generateEvidencePack`, extracted verbatim so there is exactly ONE
// implementation of the two rules that make a pack honest:
//
//   1. FLAG-NEVER-GUESS. Every control is scanned for an `unresolved` collector result BEFORE any
//      assembly runs. If any exists, `EvidencePackBlockedError` is thrown carrying the validated
//      BLOCKED-case report, and no partial body is produced.
//   2. DERIVED READINESS. A control is `gap` iff any of its evidence items is flagged — never
//      asserted by the caller — and the summary counts + posture line are derived from the
//      assembled controls, then re-validated through `parseEvidencePackManifest`.
//
// WHY IT IS ITS OWN MODULE: `generate.ts` phase 3 (the deterministic ZIP + SHA-256 digest) needs
// `node:zlib` and `node:crypto`, which taints its whole module graph for a bundler. These two
// phases need neither, so they live here and ride the browser-safe `./browser` entry (ADR-0396) —
// the site's compliance poke runs this REAL assembly instead of a hand-ported copy of it. Every
// name below is also on the `.` barrel; `generate.ts` composes this module rather than duplicating
// it, so a rule fixed here is fixed for both callers.
import {
  CaissonError,
  ValidationError,
  type JsonValue,
} from "@caisson-sh/kernel";
import type { z } from "zod";
import type { CrosswalkReference } from "@caisson-sh/frameworks-pack/browser";
import type { CollectorResult } from "./collector.ts";
import type { CrosswalkRollup } from "./crosswalk-rollup.ts";
import {
  EVIDENCE_PACK_FORMAT_VERSION,
  parseEvidencePackBlocked,
  parseEvidencePackManifest,
  type evidencePackManifestSchema,
  type EvidencePackBlocked,
  type EvidencePackChainAnchor,
  type EvidencePackFramework,
  type EvidencePackManifest,
} from "./pack-format.ts";

// The Zod INPUT shapes of the canonical body — assembly builds into these and lets
// `parseEvidencePackManifest` validate + normalize (key order follows the schema, not construction).
type ManifestInput = z.input<typeof evidencePackManifestSchema>;
type ControlInput = ManifestInput["controls"][number];
type ItemInput = ControlInput["evidence"][number];

/**
 * One control's assembly plan: its registry metadata (from `defineControl`) plus the
 * collector results gathered for it at the edge (each `EvidenceCollector.collect(fact)`). Readiness,
 * summary counts, and posture are derived from these — none is asserted by the caller.
 */
export interface EvidenceControlPlan {
  /** The canonical control id (registry namespace). */
  readonly controlId: string;
  readonly title: string;
  readonly family: string;
  readonly statement: string;
  readonly crosswalk: readonly CrosswalkReference[];
  /** The collector results for this control. At least one (a control with none fails closed). */
  readonly evidence: readonly CollectorResult[];
  /** Manual-attachment slot ids that have been filled out-of-band (default: none filled). */
  readonly filledSlotIds?: readonly string[];
}

/** The canonical-body half of the generator input: everything phases 1 + 2 read. No clock. */
export interface AssembleEvidenceManifestInput {
  readonly tenantId: string;
  readonly framework: EvidencePackFramework;
  readonly chainAnchor: EvidencePackChainAnchor;
  readonly controls: readonly EvidenceControlPlan[];
  /**
   * The cross-framework evidence rollup (ADR-0333/ADR-0347, v2) — CALLER-computed via
   * `computeCrosswalkRollup`. Keeps assembly pure and free of any concrete-catalog import
   * (the "facts injected at the edge" ethos `collector.ts` already follows); assembled into the
   * manifest unchanged, like `summary`.
   */
  readonly crosswalkRollup: CrosswalkRollup;
}

/**
 * Thrown when any control's evidence is `unresolved` — the pack is refused with the BLOCKED-case
 * report and nothing is produced (flag-never-guess, ADR-0058). 422: the request is
 * well-formed but cannot be fulfilled until the missing evidence is supplied.
 */
export class EvidencePackBlockedError extends CaissonError {
  readonly code = "evidence_pack_blocked";
  readonly httpStatus = 422;
  /** The structured refusal: every unresolved control/collector with its recorded reason. */
  readonly report: EvidencePackBlocked;

  constructor(report: EvidencePackBlocked) {
    super("evidence pack blocked: unresolved evidence (flag-never-guess)", {
      unresolvedCount: report.unresolved.length,
    });
    this.report = report;
  }
}

/** Stable lexicographic comparator (locale-independent — determinism must not depend on locale). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Map one (pass|flagged) collector result to a manifest evidence item; fail closed on a bad shape. */
function buildItem(
  result: CollectorResult,
  filled: ReadonlySet<string>,
): ItemInput {
  if (result.status === "unresolved") {
    // Unreachable: unresolved results are caught and thrown before any assembly runs.
    throw new ValidationError(
      "unresolved evidence reached pack assembly (flag-never-guess invariant violated)",
    );
  }
  const manualSlots = result.item.manualSlots.map((s) => ({
    id: s.id,
    label: s.label,
    required: s.required,
    filled: filled.has(s.id),
  }));
  const head = {
    collectorId: result.item.collectorId,
    title: result.item.title,
    summary: result.item.summary,
  };
  const facts: Record<string, JsonValue> = { ...result.item.facts };
  if (result.status === "flagged") {
    const reason = result.reason;
    if (reason === undefined || reason.trim().length === 0) {
      throw new ValidationError(
        "a flagged evidence item requires a recorded reason (flag-never-guess, ADR-0058)",
      );
    }
    return { ...head, status: "flagged", reason, facts, manualSlots };
  }
  return { ...head, status: "pass", facts, manualSlots };
}

/** Assemble one control: map + sort its evidence and DERIVE readiness (gap iff any item flagged). */
function buildControl(plan: EvidenceControlPlan): ControlInput {
  const filled = new Set(plan.filledSlotIds ?? []);
  const evidence = plan.evidence
    .map((r) => buildItem(r, filled))
    .sort((a, b) => cmp(a.collectorId, b.collectorId));
  const readiness = evidence.some((e) => e.status === "flagged")
    ? "gap"
    : "ready";
  return {
    controlId: plan.controlId,
    title: plan.title,
    family: plan.family,
    statement: plan.statement,
    crosswalk: [...plan.crosswalk],
    evidence,
    readiness,
  };
}

/**
 * Derive the auditor posture line — readiness language ONLY. Never "compliant"/"certified" (the
 * format's `postureCopy` refine re-rejects those at parse time; this template keeps clear of them).
 */
function posturePhrase(total: number, ready: number, gaps: number): string {
  const head = `${String(ready)} of ${String(total)} controls evidence-ready`;
  if (gaps === 0) return `${head}; no gaps recorded.`;
  const gapWord = gaps === 1 ? "gap" : "gaps";
  const tail = gaps === 1 ? "a remediation item" : "remediation items";
  return `${head}; ${String(gaps)} ${gapWord} recorded as ${tail}.`;
}

/**
 * Phases 1 + 2: refuse the pack outright if any evidence is `unresolved`, else assemble and
 * validate the canonical manifest body.
 *
 * Fails closed: `EvidencePackBlockedError` on unresolved evidence (no body at all), `ValidationError`
 * on a malformed item or a body the format schema rejects. The returned body carries no clock and no
 * signature, so the same evidence always canonicalizes to the same bytes.
 */
export function assembleEvidenceManifest(
  input: AssembleEvidenceManifestInput,
): EvidencePackManifest {
  // PHASE 1 — flag-never-guess. Scan EVERY control for unresolved evidence before assembling
  // anything; refuse the whole pack if any is found. No filesystem touch here → no partial pack.
  const unresolved: Array<{
    controlId: string;
    collectorId: string;
    reason: string | undefined;
  }> = [];
  for (const control of input.controls) {
    for (const result of control.evidence) {
      if (result.status === "unresolved") {
        unresolved.push({
          controlId: control.controlId,
          collectorId: result.item.collectorId,
          reason: result.reason,
        });
      }
    }
  }
  if (unresolved.length > 0) {
    const sortedUnresolved = [...unresolved].sort(
      (a, b) =>
        cmp(a.controlId, b.controlId) || cmp(a.collectorId, b.collectorId),
    );
    const report = parseEvidencePackBlocked({
      formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
      tenantId: input.tenantId,
      framework: input.framework,
      blocked: true,
      unresolved: sortedUnresolved,
    });
    throw new EvidencePackBlockedError(report);
  }

  // PHASE 2 — assemble + validate the canonical body. Controls are id-sorted so input order never
  // changes the bytes; the format schema re-enforces every honesty invariant (counts, readiness,
  // posture copy, no timestamp/signature), so a regression here cannot produce a valid pack.
  const controls = input.controls
    .map(buildControl)
    .sort((a, b) => cmp(a.controlId, b.controlId));
  const controlsReady = controls.filter((c) => c.readiness === "ready").length;
  const controlsWithGaps = controls.filter((c) => c.readiness === "gap").length;
  const totalEvidenceItems = controls.reduce(
    (n, c) => n + c.evidence.length,
    0,
  );
  const rawManifest: ManifestInput = {
    formatVersion: EVIDENCE_PACK_FORMAT_VERSION,
    tenantId: input.tenantId,
    framework: input.framework,
    chainAnchor: input.chainAnchor,
    controls,
    crosswalkRollup: input.crosswalkRollup,
    summary: {
      totalControls: controls.length,
      controlsReady,
      controlsWithGaps,
      totalEvidenceItems,
      posture: posturePhrase(controls.length, controlsReady, controlsWithGaps),
    },
  };
  return parseEvidencePackManifest(rawManifest);
}
