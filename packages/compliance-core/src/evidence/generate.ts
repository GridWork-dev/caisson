// src/evidence/generate.ts — the deterministic, control→evidence pack generator (ADR-0058).
//
// This is the convergence point of the compliance leg. It composes, never re-implements:
//   - `@caisson/kernel` `canonicalize` for the byte-stable signable body (the same bytes the signer signs);
//   - the `EvidenceCollector` results (run at the edge, where the substrate facts live);
//   - the `pack-format` schema (the determinism + honesty CONTRACT) — every assembled body is
//     re-validated through `parseEvidencePackManifest`, so the generator cannot regress an invariant
//     the format already forbids (no injected timestamp/signature, no fabricated counts, derived
//     readiness, no "compliant/certified" copy).
//
// Three load-bearing properties, asserted by the tests against the golden fixture (BLESS unset):
//
//   1. FLAG-NEVER-GUESS. Before assembling anything, every control is scanned for an
//      `unresolved` collector result. If ANY exists the generator throws `EvidencePackBlockedError`
//      carrying the BLOCKED-case report — and NO partial pack is produced (the throw precedes all
//      assembly, and this module touches no filesystem, so a partial write is structurally
//      impossible). A `flagged` item without a recorded reason is likewise rejected fail-closed.
//
//   2. CLOCK AT THE EDGE. The wall-clock instant is INJECTED (`now`), never read here, and is
//      surfaced only on the result envelope (`generatedAt`) for the outer signing/timestamp layer.
//      It NEVER enters the canonical body or the archive — so the same evidence yields the
//      same bytes regardless of when or by whom it was generated.
//
//   3. DETERMINISTIC ARCHIVE. The pack is a ZIP with fixed (1980-epoch) entry mtimes, name-sorted
//      entries, and a fixed deflate level, over canonical-byte contents — so its SHA-256 is
//      byte-stable. Controls are sorted by id and evidence by collector id, so input order never
//      changes the output.
import { deflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  canonicalize,
  CaissonError,
  ValidationError,
  type JsonValue,
} from "@caisson/kernel";
import type { CrosswalkReference } from "@caisson/frameworks-pack";
import type { CollectorResult } from "./collector.ts";
import {
  EVIDENCE_PACK_FORMAT_VERSION,
  type evidencePackManifestSchema,
  parseEvidencePackBlocked,
  parseEvidencePackManifest,
  type EvidencePackBlocked,
  type EvidencePackChainAnchor,
  type EvidencePackFramework,
  type EvidencePackManifest,
} from "./pack-format.ts";

// The Zod INPUT shapes of the canonical body — the generator assembles into these and lets
// `parseEvidencePackManifest` validate + normalize (key order follows the schema, not construction).
type ManifestInput = z.input<typeof evidencePackManifestSchema>;
type ControlInput = ManifestInput["controls"][number];
type ItemInput = ControlInput["evidence"][number];

/**
 * One control's assembly plan: its registry metadata (from `defineControl`) plus the
 * collector results gathered for it at the edge (each `EvidenceCollector.collect(fact)`). The
 * generator derives readiness, summary counts, and posture from these — none is asserted by the caller.
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

/** The full generator input. `now` is the injected clock — it never enters the body or the archive. */
export interface GenerateEvidencePackInput {
  readonly tenantId: string;
  readonly framework: EvidencePackFramework;
  readonly chainAnchor: EvidencePackChainAnchor;
  readonly controls: readonly EvidenceControlPlan[];
  /** Injected wall-clock instant; surfaced only on `generatedAt`, never hashed (clock at the edge). */
  readonly now: Date;
}

/** The generated pack: the canonical body, its bytes, the deterministic archive + digest, and the edge clock. */
export interface EvidencePack {
  /** The validated canonical manifest body (no timestamp, no signature). */
  readonly manifest: EvidencePackManifest;
  /** `canonicalize(manifest)` — the exact bytes the signer signs; byte-identical to `manifest.json` in the archive. */
  readonly canonicalManifest: string;
  /** The deterministic ZIP archive (manifest + per-control evidence + auditor summary). */
  readonly archive: Uint8Array;
  /** Lowercase-hex SHA-256 over `archive` — byte-stable across generations and independent of `now`. */
  readonly sha256: string;
  /** The injected generation instant, ISO-8601. NOT part of the canonical body (edge-stamped). */
  readonly generatedAt: string;
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

/** Round-trip to a genuine `JsonValue` (drops `undefined`) so `canonicalize` accepts the value. */
function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
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

/** Render the human-readable auditor summary. Derived from the body; carries no clock → byte-stable. */
function renderAuditorSummary(m: EvidencePackManifest): string {
  const lines: string[] = [
    "Caisson — Control Evidence Pack",
    `Framework: ${m.framework.title} (${m.framework.id}, v${m.framework.version})`,
    `Tenant: ${m.tenantId}`,
    `Audit-chain anchor: length ${String(m.chainAnchor.length)}, tip ${m.chainAnchor.tipHash}`,
    "",
    `Posture: ${m.summary.posture}`,
    `Controls: ${String(m.summary.totalControls)} total — ${String(
      m.summary.controlsReady,
    )} evidence-ready, ${String(m.summary.controlsWithGaps)} with gaps; ${String(
      m.summary.totalEvidenceItems,
    )} evidence items.`,
    "",
  ];
  for (const c of m.controls) {
    const tag = c.readiness === "ready" ? "READY" : "GAP";
    const count = c.evidence.length;
    lines.push(
      `[${tag}] ${c.controlId} — ${c.title} (${String(count)} evidence item${count === 1 ? "" : "s"})`,
    );
    for (const e of c.evidence) {
      if (e.status === "flagged" && e.reason !== undefined) {
        lines.push(`    - flagged: ${e.collectorId} — ${e.reason}`);
      }
    }
  }
  lines.push(
    "",
    "This pack reflects control-evidence readiness only. It is not an attestation or audit opinion, and makes no claim of conformance.",
  );
  return `${lines.join("\n")}\n`;
}

// --- Deterministic ZIP writer ------------------------------------------------------------------
// A minimal, dependency-free ZIP (deflate) builder. Determinism is the whole point: fixed 1980-epoch
// DOS mtimes, name-sorted entries, fixed deflate level, no extra fields — so identical contents
// always serialize to identical bytes. (Bun has no built-in archive writer; this avoids a dep.)

const DOS_DATE_1980_01_01 = 0x0021; // year=0 (1980), month=1, day=1 — the ZIP epoch.
const DOS_TIME_MIDNIGHT = 0x0000;

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i] as number;
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ArchiveFile {
  readonly name: string;
  readonly data: Uint8Array;
}

function buildDeterministicZip(files: readonly ArchiveFile[]): Uint8Array {
  const sorted = [...files].sort((a, b) => cmp(a.name, b.name));
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const file of sorted) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const raw = Buffer.from(file.data);
    const crc = crc32(raw);
    const compressed = deflateRawSync(raw, { level: 9 });

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(0, 6); // general purpose bit flag
    local.writeUInt16LE(8, 8); // compression method: deflate
    local.writeUInt16LE(DOS_TIME_MIDNIGHT, 10);
    local.writeUInt16LE(DOS_DATE_1980_01_01, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    nameBytes.copy(local, 30);
    localChunks.push(local, compressed);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed to extract
    central.writeUInt16LE(0, 8); // general purpose bit flag
    central.writeUInt16LE(8, 10); // compression method: deflate
    central.writeUInt16LE(DOS_TIME_MIDNIGHT, 12);
    central.writeUInt16LE(DOS_DATE_1980_01_01, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30); // extra field length
    central.writeUInt16LE(0, 32); // file comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal file attributes
    central.writeUInt32LE(0, 38); // external file attributes
    central.writeUInt32LE(offset, 42); // relative offset of local header
    nameBytes.copy(central, 46);
    centralChunks.push(central);

    offset += local.length + compressed.length;
  }

  const localPart = Buffer.concat(localChunks);
  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk with the central directory
  eocd.writeUInt16LE(sorted.length, 8); // central dir entries on this disk
  eocd.writeUInt16LE(sorted.length, 10); // total central dir entries
  eocd.writeUInt32LE(centralDir.length, 12); // size of central directory
  eocd.writeUInt32LE(localPart.length, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return new Uint8Array(Buffer.concat([localPart, centralDir, eocd]));
}

/** Assemble the archive entries: canonical manifest + per-control evidence + auditor summary. */
function buildArchiveEntries(
  manifest: EvidencePackManifest,
  canonicalManifest: string,
): ArchiveFile[] {
  const enc = new TextEncoder();
  const files: ArchiveFile[] = [
    { name: "manifest.json", data: enc.encode(canonicalManifest) },
    {
      name: "auditor-summary.txt",
      data: enc.encode(renderAuditorSummary(manifest)),
    },
  ];
  for (const control of manifest.controls) {
    files.push({
      name: `controls/${control.controlId}.json`,
      data: enc.encode(canonicalize(toJson(control))),
    });
  }
  return files;
}

/**
 * Generate a deterministic, control→evidence pack from already-gathered collector results.
 *
 * Fails closed: any `unresolved` evidence throws `EvidencePackBlockedError` (no pack), any malformed
 * item throws `ValidationError`. On success the canonical body is byte-stable and signable, and the
 * archive's SHA-256 is reproducible and independent of the injected clock.
 */
export function generateEvidencePack(
  input: GenerateEvidencePackInput,
): EvidencePack {
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
    summary: {
      totalControls: controls.length,
      controlsReady,
      controlsWithGaps,
      totalEvidenceItems,
      posture: posturePhrase(controls.length, controlsReady, controlsWithGaps),
    },
  };
  const manifest = parseEvidencePackManifest(rawManifest);

  // PHASE 3 — canonical bytes + deterministic archive + byte-stable digest. The clock is stamped
  // ONLY on the envelope, never into the hashed contents.
  const canonicalManifest = canonicalize(toJson(manifest));
  const archive = buildDeterministicZip(
    buildArchiveEntries(manifest, canonicalManifest),
  );
  const sha256 = createHash("sha256").update(archive).digest("hex");

  return {
    manifest,
    canonicalManifest,
    archive,
    sha256,
    generatedAt: input.now.toISOString(),
  };
}
