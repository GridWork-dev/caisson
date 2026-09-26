// src/evidence/generate.ts — the deterministic, control→evidence pack generator (ADR-0058).
//
// This is the convergence point of the compliance leg. It composes, never re-implements:
//   - `@caisson-sh/kernel` `canonicalize` for the byte-stable signable body (the same bytes the signer signs);
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
//      That scan and the whole canonical-body assembly live in the node-free `assemble.ts`
//      (ADR-0396) and are COMPOSED here, never duplicated — this module owns only phase 3.
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
import { canonicalize, type JsonValue } from "@caisson-sh/kernel";
import {
  assembleEvidenceManifest,
  type AssembleEvidenceManifestInput,
} from "./assemble.ts";
import type { EvidencePackManifest } from "./pack-format.ts";
import {
  anchorGradePhrase,
  buildExternalAnchorEntry,
  type AnchorGrade,
  type ExternalAnchorAttachment,
} from "./external-anchor.ts";

/** The full generator input. `now` is the injected clock — it never enters the body or the archive. */
export interface GenerateEvidencePackInput extends AssembleEvidenceManifestInput {
  /** Injected wall-clock instant; surfaced only on `generatedAt`, never hashed (clock at the edge). */
  readonly now: Date;
  /**
   * Optionally, the newest external-anchor receipt for this tenant (SPEC external-anchoring §6). It
   * is attached DETACHED — an extra archive entry + an envelope grade tag — NEVER a field in the
   * canonical body (the receipt carries a non-deterministic TSA token; hashing it would break
   * byte-stability). Absence is NOT an unresolved-evidence gap: anchoring is adopter-optional, so a
   * pack still generates normally with no external-anchor entry.
   */
  readonly externalAnchor?: ExternalAnchorAttachment;
  /**
   * Optionally, a pre-rendered ISO/IEC 27001:2022 Statement-of-Applicability artifact (SPEC piece 2:
   * "evidence pack additive section") — build it with `buildIso27001SoaArchiveEntry(toOscalIso27001Soa(...))`.
   * Attached DETACHED, exactly like `externalAnchor`: an extra archive entry (`soa/iso-27001.json`),
   * NEVER a field merged into the canonical manifest body — this generator is framework-agnostic and
   * does not know what an SoA is, only that it is bytes under a name. Absence is normal: the SoA is
   * ISO-27001-specific and optional for every other framework pack.
   */
  readonly iso27001Soa?: { readonly name: string; readonly data: Uint8Array };
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
  /**
   * The trust grade of the attached external-anchor receipt, when one was supplied (detached, on the
   * envelope — like `generatedAt`, never in the canonical body). Absent when anchoring is off / no
   * receipt was minted. `trusted-timestamped` in v1; `externally-transparent` once v1.1 ships.
   */
  readonly externalAnchorGrade?: AnchorGrade;
}

/** Stable lexicographic comparator (locale-independent — determinism must not depend on locale). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Round-trip to a genuine `JsonValue` (drops `undefined`) so `canonicalize` accepts the value. */
function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

/** Render the human-readable auditor summary. Derived from the body; carries no clock → byte-stable
 *  (an external-anchor grade, when present, adds one honest line — never a clock or token). */
function renderAuditorSummary(
  m: EvidencePackManifest,
  externalGrade?: AnchorGrade,
): string {
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
  if (externalGrade !== undefined) {
    lines.push("", anchorGradePhrase(externalGrade));
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

/**
 * Assemble the archive entries: canonical manifest + per-control evidence + auditor summary, plus —
 * when supplied — the DETACHED external-anchor receipt (its own entry, never merged into the body).
 */
function buildArchiveEntries(
  manifest: EvidencePackManifest,
  canonicalManifest: string,
  external?: {
    readonly name: string;
    readonly data: Uint8Array;
    readonly grade: AnchorGrade;
  },
  iso27001Soa?: { readonly name: string; readonly data: Uint8Array },
): ArchiveFile[] {
  const enc = new TextEncoder();
  const files: ArchiveFile[] = [
    { name: "manifest.json", data: enc.encode(canonicalManifest) },
    {
      name: "auditor-summary.txt",
      data: enc.encode(renderAuditorSummary(manifest, external?.grade)),
    },
  ];
  for (const control of manifest.controls) {
    files.push({
      name: `controls/${control.controlId}.json`,
      data: enc.encode(canonicalize(toJson(control))),
    });
  }
  if (external !== undefined) {
    files.push({ name: external.name, data: external.data });
  }
  if (iso27001Soa !== undefined) {
    files.push({ name: iso27001Soa.name, data: iso27001Soa.data });
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
  // PHASES 1 + 2 — flag-never-guess refusal, then the derived, schema-validated canonical body.
  // Both live in `assemble.ts` (node-free) so the browser entry and this generator run the SAME
  // implementation; `EvidencePackBlockedError` propagates unchanged.
  const manifest = assembleEvidenceManifest(input);

  // PHASE 3 — canonical bytes + deterministic archive + byte-stable digest. The clock is stamped
  // ONLY on the envelope, never into the hashed contents. The external-anchor receipt (when present)
  // rides as a DETACHED archive entry + an envelope grade tag — never inside the canonical body.
  const external =
    input.externalAnchor !== undefined
      ? buildExternalAnchorEntry(input.externalAnchor)
      : undefined;
  const canonicalManifest = canonicalize(toJson(manifest));
  const archive = buildDeterministicZip(
    buildArchiveEntries(
      manifest,
      canonicalManifest,
      external,
      input.iso27001Soa,
    ),
  );
  const sha256 = createHash("sha256").update(archive).digest("hex");

  return {
    manifest,
    canonicalManifest,
    archive,
    sha256,
    generatedAt: input.now.toISOString(),
    ...(external !== undefined ? { externalAnchorGrade: external.grade } : {}),
  };
}
