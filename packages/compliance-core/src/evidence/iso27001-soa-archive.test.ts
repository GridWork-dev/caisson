// Coverage for the ISO/IEC 27001:2022 SoA as an ADDITIVE evidence-pack archive entry (SPEC piece 2:
// "evidence pack additive section"). Mirrors `external-anchor.test.ts`'s own detached-attachment
// coverage: the SoA lands as an extra archive entry while the canonical (signed) manifest body stays
// byte-identical to a no-SoA pack — this generator is framework-agnostic and never merges the SoA
// into the canonical body.
import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import { canonicalize } from "@caisson-sh/kernel";
import {
  computeIso27001SoaRows,
  iso27001Crosswalk,
} from "@caisson-sh/frameworks-pack";
import { passResult } from "./collector.ts";
import {
  generateEvidencePack,
  type GenerateEvidencePackInput,
} from "./generate.ts";
import {
  buildIso27001SoaArchiveEntry,
  ISO27001_SOA_ARCHIVE_ENTRY,
  toOscalIso27001Soa,
} from "@caisson-sh/oscal-spine";

function baseInput(): GenerateEvidencePackInput {
  return {
    tenantId: "tenant-acme-prod",
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: {
      length: 3,
      tipHash: "a".repeat(64),
      genesisHash: "b".repeat(64),
    },
    crosswalkRollup: { cells: [] },
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit",
        statement: "append-only hash-chained log anchored in WORM",
        crosswalk: [{ framework: "SOC2-TSC", reference: "CC7.2" }],
        evidence: [
          passResult({
            collectorId: "substrate.worm-retention",
            controlId: "AUDIT.IMMUTABLE-LOG",
            title: "WORM retention floor met",
            summary: "locked artifact retained beyond the legal floor",
            facts: { meetsFloor: true },
            manualSlots: [],
          }),
        ],
      },
    ],
    now: new Date("2026-07-19T12:00:00.000Z"),
  };
}

function soaEntry() {
  const rows = computeIso27001SoaRows({
    controlIds: ["A.5.15"],
    crosswalk: iso27001Crosswalk,
    controlStatuses: new Map([["ACCESS-CONTROL.LOGICAL", "ready"]]),
  });
  const doc = toOscalIso27001Soa(rows, {
    now: new Date("2026-07-19T00:00:00.000Z"),
    title: "Caisson ISO/IEC 27001:2022 Statement of Applicability",
    version: "2026.1",
  });
  return buildIso27001SoaArchiveEntry(doc);
}

/** Read one deflate entry out of the generator's deterministic ZIP (all entries are method-8) —
 *  mirrors `external-anchor.test.ts`'s own local helper. */
function readZipEntry(zip: Uint8Array, name: string): string | null {
  const buf = Buffer.from(zip);
  const target = Buffer.from(name, "utf8");
  let off = 0;
  while (off + 30 <= buf.length && buf.readUInt32LE(off) === 0x04034b50) {
    const compMethod = buf.readUInt16LE(off + 8);
    const compSize = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const nameStart = off + 30;
    const entryName = buf.subarray(nameStart, nameStart + nameLen);
    const dataStart = nameStart + nameLen + extraLen;
    const data = buf.subarray(dataStart, dataStart + compSize);
    if (entryName.equals(target)) {
      return (compMethod === 8 ? inflateRawSync(data) : data).toString("utf8");
    }
    off = dataStart + compSize;
  }
  return null;
}

describe("generateEvidencePack — ISO 27001 SoA as a detached archive entry", () => {
  test("a no-SoA pack carries no soa/ entry (unchanged behavior)", () => {
    const pack = generateEvidencePack(baseInput());
    expect(readZipEntry(pack.archive, ISO27001_SOA_ARCHIVE_ENTRY)).toBeNull();
  });

  test("an attached SoA lands under the fixed entry name with exact canonical bytes", () => {
    const entry = soaEntry();
    const pack = generateEvidencePack({ ...baseInput(), iso27001Soa: entry });
    const found = readZipEntry(pack.archive, ISO27001_SOA_ARCHIVE_ENTRY);
    expect(found).toBe(new TextDecoder().decode(entry.data));
  });

  test("attaching the SoA never touches the canonical manifest body", () => {
    const withSoa = generateEvidencePack({
      ...baseInput(),
      iso27001Soa: soaEntry(),
    });
    const withoutSoa = generateEvidencePack(baseInput());
    expect(withSoa.manifest).toEqual(withoutSoa.manifest);
    expect(withSoa.canonicalManifest).toBe(withoutSoa.canonicalManifest);
  });

  test("the entry name is a stable, canonicalize-round-trippable path", () => {
    expect(ISO27001_SOA_ARCHIVE_ENTRY).toBe("soa/iso-27001.json");
    const entry = soaEntry();
    const parsed: unknown = JSON.parse(new TextDecoder().decode(entry.data));
    expect(canonicalize(parsed as never)).toBe(
      new TextDecoder().decode(entry.data),
    );
  });
});
