// Coverage for the detached external-anchor attachment (T7). Two layers: the honest-phrase + entry
// builder in isolation, and the generator wiring — the receipt lands as a DETACHED archive entry +
// an envelope grade tag while the canonical (signed) body stays byte-identical to a no-anchor pack.
import { describe, expect, test } from "bun:test";
import { inflateRawSync } from "node:zlib";
import type { JsonValue } from "@caisson-sh/kernel";
import { passResult } from "./collector.ts";
import {
  generateEvidencePack,
  type GenerateEvidencePackInput,
} from "./generate.ts";
import {
  anchorGradePhrase,
  buildExternalAnchorEntry,
  EXTERNAL_ANCHOR_RECEIPT_ENTRY,
  type ExternalAnchorAttachment,
} from "./external-anchor.ts";

/** A structural AnchorReceipt JSON (audit-worm validated it on the WORM write; here it is evidence). */
const RECEIPT: JsonValue = {
  accountId: "acct-1",
  target: "tsa",
  anchorLength: 3,
  anchorDigest: "c".repeat(64),
  grade: "trusted-timestamped",
  receipt: {
    authority: "https://tsa.example",
    algorithm: "rfc3161",
    hashAlgorithm: "sha256",
    messageImprint: "c".repeat(64),
    token: "dG9rZW4=",
    timestampedAt: "2026-07-13T00:00:00.000Z",
  },
  receiptedAt: "2026-07-13T00:00:01.000Z",
};

const ATTACHMENT: ExternalAnchorAttachment = {
  grade: "trusted-timestamped",
  receipt: RECEIPT,
};

/**
 * A self-contained Rekor (`externally-transparent`) receipt — mirrors audit-worm's
 * `transparencyReceiptSchema`. Every byte field is already base64/string (like `timestampReceipt.token`),
 * so it is JSON-safe and canonicalizes cleanly with no byte-field breakage (R11).
 */
const REKOR_RECEIPT: JsonValue = {
  accountId: "acct-1",
  target: "rekor",
  anchorLength: 3,
  anchorDigest: "c".repeat(64),
  grade: "externally-transparent",
  receipt: {
    algorithm: "rekor-v2-hashedrekord",
    origin: "log2025-1.rekor.sigstore.dev",
    checkpoint:
      "log2025-1.rekor.sigstore.dev\n42\ncm9vdA==\n\n— log2025-1.rekor.sigstore.dev c2ln\n",
    logKeyDetails: "PKIX_ED25519",
    logPublicKey: "MCowBQYDK2VwAyEAcHVia2V5",
    logId: "bG9nSWQ=",
    logIndex: "27980982",
    inclusionHashes: ["aGFzaDE=", "aGFzaDI="],
    canonicalizedBody: "eyJib2R5Ijp0cnVlfQ==",
  },
  receiptedAt: "2026-07-17T00:00:01.000Z",
};

const REKOR_ATTACHMENT: ExternalAnchorAttachment = {
  grade: "externally-transparent",
  receipt: REKOR_RECEIPT,
};

function baseInput(): GenerateEvidencePackInput {
  return {
    tenantId: "tenant-x",
    framework: { id: "soc2-tsc", title: "SOC 2", version: "2024.1" },
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
    now: new Date("2026-06-27T12:00:00.000Z"),
  };
}

/** Read one deflate entry out of the generator's deterministic ZIP (all entries are method-8). */
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

describe("anchorGradePhrase — honest wording", () => {
  test("trusted-timestamped never claims external verifiability (ADR-0332 Binding)", () => {
    const phrase = anchorGradePhrase("trusted-timestamped");
    expect(phrase).toContain("private");
    expect(phrase).not.toMatch(/externally verifiable/i);
    expect(phrase).not.toMatch(/outside part/i);
  });

  test("externally-transparent is the only grade that claims third-party provability", () => {
    expect(anchorGradePhrase("externally-transparent")).toMatch(/public/i);
  });
});

describe("buildExternalAnchorEntry", () => {
  test("emits the fixed entry name + canonical receipt bytes", () => {
    const entry = buildExternalAnchorEntry(ATTACHMENT);
    expect(entry.name).toBe(EXTERNAL_ANCHOR_RECEIPT_ENTRY);
    expect(entry.grade).toBe("trusted-timestamped");
    expect(JSON.parse(new TextDecoder().decode(entry.data))).toMatchObject({
      grade: "trusted-timestamped",
    });
  });

  test("a grade outside the two-literal enum fails closed", () => {
    expect(() =>
      buildExternalAnchorEntry({
        grade: "self-attested" as never,
        receipt: RECEIPT,
      }),
    ).toThrow();
  });
});

describe("generateEvidencePack — detached external-anchor attachment", () => {
  test("a no-anchor pack carries no grade tag (unchanged behavior)", () => {
    const pack = generateEvidencePack(baseInput());
    expect(pack.externalAnchorGrade).toBeUndefined();
    expect(
      readZipEntry(pack.archive, EXTERNAL_ANCHOR_RECEIPT_ENTRY),
    ).toBeNull();
  });

  test("an anchored pack tags the grade + attaches the receipt WITHOUT touching the canonical body", () => {
    const plain = generateEvidencePack(baseInput());
    const anchored = generateEvidencePack({
      ...baseInput(),
      externalAnchor: ATTACHMENT,
    });

    // Envelope grade tag present.
    expect(anchored.externalAnchorGrade).toBe("trusted-timestamped");
    // The canonical (signed) body is byte-identical — the receipt is detached, not in the manifest.
    expect(anchored.canonicalManifest).toBe(plain.canonicalManifest);
    // The archive DID change (it gained the receipt entry + the summary line), so its digest differs.
    expect(anchored.sha256).not.toBe(plain.sha256);

    // The detached receipt is a real archive entry parsing back to the receipt JSON.
    const entry = readZipEntry(anchored.archive, EXTERNAL_ANCHOR_RECEIPT_ENTRY);
    expect(entry).not.toBeNull();
    expect(JSON.parse(entry as string)).toMatchObject({ target: "tsa" });
  });

  test("the honest grade phrase renders in auditor-summary.txt, never over-claiming", () => {
    const anchored = generateEvidencePack({
      ...baseInput(),
      externalAnchor: ATTACHMENT,
    });
    const summary = readZipEntry(anchored.archive, "auditor-summary.txt");
    expect(summary).not.toBeNull();
    expect(summary).toContain("third-party-clock-attested");
    expect(summary).not.toMatch(/externally verifiable/i);
  });

  test("an anchored pack is deterministic for identical input (fixed receipt → fixed archive)", () => {
    const a = generateEvidencePack({
      ...baseInput(),
      externalAnchor: ATTACHMENT,
    });
    const b = generateEvidencePack({
      ...baseInput(),
      externalAnchor: ATTACHMENT,
    });
    expect(a.sha256).toBe(b.sha256);
  });
});

// R11 — the SAME generic detached-attachment path carries a Rekor `externally-transparent` receipt: it
// round-trips canonicalize() cleanly (base64 byte fields are JSON-safe), and the honest public-log
// phrase renders — the source (external-anchor.ts) is already grade-agnostic, this pins the behavior.
describe("externally-transparent (Rekor) receipt round-trips the pack format", () => {
  test("buildExternalAnchorEntry canonicalizes a Rekor receipt back to identical JSON", () => {
    const entry = buildExternalAnchorEntry(REKOR_ATTACHMENT);
    expect(entry.grade).toBe("externally-transparent");
    const decoded = JSON.parse(new TextDecoder().decode(entry.data));
    // Byte fields survive canonicalization unchanged (no truncation / re-encoding).
    expect(decoded.receipt.algorithm).toBe("rekor-v2-hashedrekord");
    expect(decoded.receipt.canonicalizedBody).toBe("eyJib2R5Ijp0cnVlfQ==");
    expect(decoded.receipt.inclusionHashes).toEqual(["aGFzaDE=", "aGFzaDI="]);
  });

  test("the generator tags the externally-transparent grade + renders the public-log phrase", () => {
    const anchored = generateEvidencePack({
      ...baseInput(),
      externalAnchor: REKOR_ATTACHMENT,
    });
    expect(anchored.externalAnchorGrade).toBe("externally-transparent");
    const summary = readZipEntry(anchored.archive, "auditor-summary.txt");
    expect(summary).toMatch(/public/i);
    const entry = readZipEntry(anchored.archive, EXTERNAL_ANCHOR_RECEIPT_ENTRY);
    expect(JSON.parse(entry as string)).toMatchObject({ target: "rekor" });
  });

  test("an anchored Rekor pack is deterministic + leaves the signed body byte-identical", () => {
    const plain = generateEvidencePack(baseInput());
    const a = generateEvidencePack({
      ...baseInput(),
      externalAnchor: REKOR_ATTACHMENT,
    });
    const b = generateEvidencePack({
      ...baseInput(),
      externalAnchor: REKOR_ATTACHMENT,
    });
    expect(a.sha256).toBe(b.sha256);
    expect(a.canonicalManifest).toBe(plain.canonicalManifest);
  });
});
