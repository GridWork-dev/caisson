// src/evidence/collector.ts — the declarative evidence-collector contract (ADR-0058).
//
// An EvidenceCollector is a PURE, typed transform from one already-gathered substrate fact to one
// evidence item plus its verdict. It runs NO I/O, opens NO DB transaction, and reads NO clock — the
// substrate fact (a verified audit chain + anchor, an RLS posture snapshot, a WORM retention term)
// is gathered at the edge by code that DOES depend on `audit-worm`/`tenancy-rls`, then handed in.
// That keeps collectors deterministic, unit-testable with no live cloud/DB (HOUSE RULE), and
// down-only: the only runtime dependency a collector composes is `@caisson-sh/kernel` (`verifyChain`).
//
// Boundary note (why no Zod here): the facts a collector consumes are produced in-process by the
// trusted substrate stores (`AuditChainStore.load`, the RLS catalog read, `ArtifactStore.head`),
// each of which already validates at ITS boundary (e.g. `version-store` Zod-parses provenance on
// read-back). Collectors introduce no new external boundary, so they validate by TYPE, not Zod —
// the external surfaces (DB rows, manual-upload payloads) are parsed where they are read.
//
// Flag-never-guess (ADR-0058): a collector NEVER infers a passing status it cannot evidence. A
// `flagged` (real deficiency) or `unresolved` (evidence absent → hard-blocks the pack in the generator) result
// MUST carry a recorded reason — enforced by the `flaggedResult`/`unresolvedResult` constructors.
import { ValidationError, type JsonValue } from "@caisson-sh/kernel";

/**
 * The verdict for one collected evidence item:
 * - `pass`       — the automated check was performed AND satisfied; the evidence stands.
 * - `flagged`    — the check was performed and found a real deficiency (a gap / POA&M item); a
 *                  recorded reason is mandatory. Never "non-compliant/certified" copy (readiness only).
 * - `unresolved` — the evidence required to make the determination was ABSENT; the collector refuses
 *                  to guess. The generator treats this as a hard block — no partial pack.
 */
export type EvidenceStatus = "pass" | "flagged" | "unresolved";

/**
 * A slot for evidence a human must attach out-of-band (a policy PDF, a signed letter, a pentest
 * report). Automated collectors declare these as supplementary; whether a slot has been FILLED is
 * tracked by the generator/manifest at the edge, never by the pure collector.
 */
export interface ManualAttachmentSlot {
  /** Stable slot id, unique within a collector's item. */
  readonly id: string;
  /** Human-readable label describing what to attach. */
  readonly label: string;
  /** Whether the pack is incomplete without this attachment. */
  readonly required: boolean;
}

/** The evidence body a collector produces for one control facet. JSON-only so it survives `canonicalize`. */
export interface EvidenceItem {
  /** The id of the collector that produced this item. */
  readonly collectorId: string;
  /** The canonical control id (registry namespace) this evidence supports. */
  readonly controlId: string;
  /** Short human title of the evidenced facet. */
  readonly title: string;
  /** Human-readable one-line finding (readiness/posture language, never "compliant/certified"). */
  readonly summary: string;
  /** Structured automated finding — canonicalize-able (no Date/undefined; ISO strings only). */
  readonly facts: { readonly [key: string]: JsonValue };
  /** Manual attachments this item invites; empty for a fully-automated facet. */
  readonly manualSlots: readonly ManualAttachmentSlot[];
}

/** A collector's output: the evidence item plus its verdict and (for non-pass) the recorded reason. */
export interface CollectorResult {
  readonly item: EvidenceItem;
  readonly status: EvidenceStatus;
  /** Present iff `status !== "pass"` — the recorded reason a check flagged or could not resolve. */
  readonly reason?: string;
}

/**
 * A declarative, typed evidence collector. Generic over the substrate `Fact` it consumes; `collect`
 * is pure (same fact → same result). Concrete collectors live under `collectors/`; the generator
 * gathers facts and runs each collector to assemble the pack.
 */
export interface EvidenceCollector<Fact> {
  /** Stable collector id (e.g. `substrate.audit-chain-integrity`). */
  readonly id: string;
  /** The canonical control id this collector evidences. */
  readonly controlId: string;
  /** Short human title. */
  readonly title: string;
  /** Manual attachments every item from this collector invites. */
  readonly manualSlots: readonly ManualAttachmentSlot[];
  /** Map one gathered fact to its evidence item + verdict. Pure. */
  collect(fact: Fact): CollectorResult;
}

/** A satisfied automated check — the evidence stands. Carries no reason. */
export function passResult(item: EvidenceItem): CollectorResult {
  return { item, status: "pass" };
}

/**
 * A performed check that found a real deficiency (a gap). The reason is MANDATORY (flag-never-guess,
 * ADR-0058) — an empty reason is itself a violation, rejected fail-closed.
 */
export function flaggedResult(
  item: EvidenceItem,
  reason: string,
): CollectorResult {
  if (reason.trim().length === 0) {
    throw new ValidationError(
      "a flagged evidence item requires a recorded reason",
    );
  }
  return { item, status: "flagged", reason };
}

/**
 * The evidence to make the determination was absent — the collector refuses to guess. The reason
 * (what was missing) is MANDATORY; the generator hard-blocks on any unresolved item.
 */
export function unresolvedResult(
  item: EvidenceItem,
  reason: string,
): CollectorResult {
  if (reason.trim().length === 0) {
    throw new ValidationError(
      "an unresolved evidence item requires a recorded reason",
    );
  }
  return { item, status: "unresolved", reason };
}
