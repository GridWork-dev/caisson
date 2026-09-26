// pack.test.ts — T-E1 proof: the pack's detached signature authenticates every exported file,
// assembly is deterministic regardless of input order, and its README never overclaims (SPEC copy
// law) relative to whether a pinned anchor-signing key was supplied.
import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign, createHash, verify } from "node:crypto";
import { canonicalize, type JsonValue } from "../canonical.ts";
import { ValidationError } from "../errors.ts";
import {
  anchorSignatureEnvelopeBytes,
  buildRowReceipt,
  type RowReceipt,
} from "../audit-verify.ts";
import {
  buildEvidencePack,
  evidencePackManifestForInput,
  evidencePackSealPayloadBytes,
  EVIDENCE_PACK_FORMAT_VERSION,
  EVIDENCE_PACK_KEY_ID_MAX_LENGTH,
  type EvidencePackMeta,
} from "./pack.ts";

const NOW = new Date("2026-07-13T12:00:00.000Z");
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CHAIN_VERIFICATION = { valid: true, brokenAt: null } as const;

function link(prevHash: string | null, payload: JsonValue): string {
  return createHash("sha256")
    .update(canonicalize([prevHash, payload]))
    .digest("hex");
}

function buildSignedFixture(): {
  receipts: RowReceipt[];
  keyId: string;
  publicKeySpkiBase64: string;
  signedMetaFor(receipts: readonly RowReceipt[]): EvidencePackMeta;
} {
  const keyId = "test-anchor-key";
  const kp = generateKeyPairSync("ed25519");
  const publicKeySpkiBase64 = kp.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");

  function signAnchor(core: {
    length: number;
    tipHash: string;
    genesisHash: string;
  }) {
    const sigV = 2 as const;
    const sigAccountId = TENANT_ID;
    const signatureAnchor = { ...core, sigV, sigAccountId };
    return {
      ...signatureAnchor,
      sig: sign(
        null,
        Buffer.from(
          anchorSignatureEnvelopeBytes(signatureAnchor, sigAccountId),
        ),
        kp.privateKey,
      ).toString("base64"),
      keyId,
    };
  }

  const genesisPayload: JsonValue = { event: "genesis", v: 1 };
  const genesisHash = link(null, genesisPayload);
  const row1Payload: JsonValue = { event: "next", v: 2, password: "s3cr3t" };
  const row1Hash = link(genesisHash, row1Payload);

  const anchor0 = signAnchor({
    length: 1,
    tipHash: genesisHash,
    genesisHash,
  });
  const anchor1 = signAnchor({
    length: 2,
    tipHash: row1Hash,
    genesisHash,
  });

  const r0 = buildRowReceipt({
    entry: {
      seq: 0,
      prevHash: null,
      payload: genesisPayload,
      hash: genesisHash,
    },
    anchorForRow: anchor0,
    redacted: false,
    checks: { linkRecompute: "pass", anchorEquality: "pass" },
    verifiedAt: NOW.toISOString(),
    includeAnchorProvenance: true,
  });
  const r1 = buildRowReceipt({
    entry: {
      seq: 1,
      prevHash: genesisHash,
      payload: row1Payload,
      hash: row1Hash,
    },
    anchorForRow: anchor1,
    redacted: false,
    checks: { linkRecompute: "pass", anchorEquality: "pass" },
    verifiedAt: NOW.toISOString(),
    includeAnchorProvenance: true,
  });

  function signedMetaFor(receipts: readonly RowReceipt[]): EvidencePackMeta {
    const base = {
      tenantId: TENANT_ID,
      chainLength: receipts.length,
      now: NOW,
      chainVerification: CHAIN_VERIFICATION,
      anchorAuth: { keyId, publicKeySpkiBase64 },
    };
    return {
      ...base,
      packSeal: {
        v: 2,
        keyId,
        accountId: TENANT_ID,
        sig: sign(
          null,
          Buffer.from(
            evidencePackSealPayloadBytes({
              manifest: evidencePackManifestForInput({
                receipts,
                meta: base,
              }),
              accountId: TENANT_ID,
            }),
          ),
          kp.privateKey,
        ).toString("base64"),
      },
    };
  }

  return {
    receipts: [r0, r1],
    keyId,
    publicKeySpkiBase64,
    signedMetaFor,
  };
}

describe("buildEvidencePack", () => {
  test("the detached seal authenticates the canonical file manifest", () => {
    const { receipts, publicKeySpkiBase64, signedMetaFor } =
      buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: signedMetaFor(receipts),
    });
    expect(pack.formatVersion).toBe(EVIDENCE_PACK_FORMAT_VERSION);
    expect(pack.packSeal).toBeDefined();
    expect(
      verify(
        null,
        Buffer.from(
          evidencePackSealPayloadBytes({
            manifest: pack.manifest,
            accountId: TENANT_ID,
          }),
        ),
        {
          key: Buffer.from(publicKeySpkiBase64, "base64"),
          format: "der",
          type: "spki",
        },
        Buffer.from(pack.packSeal?.sig ?? "", "base64"),
      ),
    ).toBe(true);
  });

  test("substituting a file no longer matches the signed manifest", () => {
    const { receipts, signedMetaFor } = buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: signedMetaFor(receipts),
    });
    const readme = pack.files.find((file) => file.name === "README.md");
    const signedDigest = pack.manifest.files.find(
      (file) => file.name === "README.md",
    )?.sha256;

    expect(readme).toBeDefined();
    expect(signedDigest).toBeDefined();
    expect(
      createHash("sha256")
        .update(`${readme?.contents ?? ""}\nsubstituted`)
        .digest("hex"),
    ).not.toBe(signedDigest);
  });

  test("substituting the manifest invalidates the detached seal", () => {
    const { receipts, publicKeySpkiBase64, signedMetaFor } =
      buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: signedMetaFor(receipts),
    });
    const substitutedManifest = {
      ...pack.manifest,
      files: pack.manifest.files.map((file) =>
        file.name === "README.md" ? { ...file, sha256: "0".repeat(64) } : file,
      ),
    };

    expect(
      verify(
        null,
        Buffer.from(
          evidencePackSealPayloadBytes({
            manifest: substitutedManifest,
            accountId: TENANT_ID,
          }),
        ),
        {
          key: Buffer.from(publicKeySpkiBase64, "base64"),
          format: "der",
          type: "spki",
        },
        Buffer.from(pack.packSeal?.sig ?? "", "base64"),
      ),
    ).toBe(false);
  });

  test("tampered receipt bytes have a different manifest digest", () => {
    const { receipts, signedMetaFor } = buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: signedMetaFor(receipts),
    });
    const receiptsFile = pack.files.find(
      (file) => file.name === "receipts.json",
    );
    const signedDigest = pack.manifest.files.find(
      (file) => file.name === "receipts.json",
    )?.sha256;

    expect(
      createHash("sha256")
        .update(`${receiptsFile?.contents ?? ""}\nforged`)
        .digest("hex"),
    ).not.toBe(signedDigest);
  });

  test("deterministic: input order never changes the receipts.json bytes or the pack digest", () => {
    const { receipts, signedMetaFor } = buildSignedFixture();
    const meta = signedMetaFor(receipts);
    const forward = buildEvidencePack({ receipts, meta });
    const reversed = buildEvidencePack({
      receipts: [...receipts].reverse(),
      meta,
    });
    expect(reversed.sha256).toBe(forward.sha256);
    const forwardReceipts = forward.files.find(
      (f) => f.name === "receipts.json",
    )!.contents;
    const reversedReceipts = reversed.files.find(
      (f) => f.name === "receipts.json",
    )!.contents;
    expect(reversedReceipts).toBe(forwardReceipts);
  });

  test("ships no executable verifier and names the honest out-of-band path", () => {
    const { receipts, signedMetaFor } = buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: signedMetaFor(receipts),
    });
    expect(pack.files.some((file) => file.name === "verify.mjs")).toBe(false);
    const readme = pack.files.find(
      (file) => file.name === "README.md",
    )?.contents;
    expect(readme).toContain("CAISSON_VERIFY_PACK_KEY_SHA256");
    expect(readme).toContain("@caisson-sh/verify-pack");
    expect(readme).toContain("not distributed through a package registry");
    // No install command may appear. `npx @caisson-sh/verify-pack` does not resolve (commercial, never
    // registry-published) and the old in-repo fallback pointed an external auditor at a private
    // repository. Both are commands the reader cannot run, so both are banned here by name.
    expect(readme).not.toContain("npx @caisson-sh/verify-pack");
    expect(readme).not.toContain("bun run packages/verify-pack");
    // The route that actually works for a reader with no relationship to the issuer.
    expect(readme).toContain("@caisson-sh/kernel/audit-verify");
  });

  test("mispaired anchor authentication and pack seal throws the typed validation error", () => {
    const { receipts, signedMetaFor } = buildSignedFixture();
    const signed = signedMetaFor(receipts);
    const { packSeal: _packSeal, ...withoutPackSeal } = signed;

    expect(() =>
      buildEvidencePack({
        receipts,
        meta: withoutPackSeal,
      }),
    ).toThrow(ValidationError);
  });

  test("rejects a key identity that the out-of-band verifier cannot parse", () => {
    const { receipts, signedMetaFor } = buildSignedFixture();
    const signed = signedMetaFor(receipts);
    const keyId = "k".repeat(EVIDENCE_PACK_KEY_ID_MAX_LENGTH + 1);

    expect(() =>
      buildEvidencePack({
        receipts,
        meta: {
          ...signed,
          anchorAuth: { ...signed.anchorAuth!, keyId },
          packSeal: { ...signed.packSeal!, keyId },
        },
      }),
    ).toThrow(ValidationError);
  });

  test("a canonical manifest covers every exported file name and digest", () => {
    const { receipts, signedMetaFor } = buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: signedMetaFor(receipts),
    });
    expect(pack.manifest.files.map((file) => file.name)).toEqual(
      [...pack.files].map((file) => file.name).sort(),
    );
    for (const file of pack.files) {
      expect(
        pack.manifest.files.find((entry) => entry.name === file.name)?.sha256,
      ).toBe(createHash("sha256").update(file.contents).digest("hex"));
    }
  });

  describe("README honesty (SPEC copy law — never overclaim)", () => {
    const BANNED = [/impossible to tamper/i, /\bindependently verified\b/i];

    test("signed pack (anchorAuth present): claims the signature-checked seal, no banned strings", () => {
      const { receipts, signedMetaFor } = buildSignedFixture();
      const pack = buildEvidencePack({
        receipts,
        meta: signedMetaFor(receipts),
      });
      const readme = pack.files.find((f) => f.name === "README.md")!.contents;
      expect(readme).toContain("verified against write-once anchor");
      expect(readme).toContain("(signature-checked)");
      for (const pattern of BANNED) expect(readme).not.toMatch(pattern);
    });

    test("unsigned pack: honestly refuses an authenticated PASS, no banned strings", () => {
      const { receipts } = buildSignedFixture();
      const pack = buildEvidencePack({
        receipts,
        meta: {
          tenantId: TENANT_ID,
          chainLength: 2,
          now: NOW,
          chainVerification: CHAIN_VERIFICATION,
        },
      });
      const readme = pack.files.find((f) => f.name === "README.md")!.contents;
      expect(readme).toContain("refuses an authenticated PASS");
      expect(readme).not.toContain("signature-checked");
      for (const pattern of BANNED) expect(readme).not.toMatch(pattern);
    });

    test("no surface in this module's own source carries a banned string either", async () => {
      const src = await Bun.file(new URL("./pack.ts", import.meta.url)).text();
      // The source may only ever assemble the honest variants above — the literal banned phrases
      // must not appear anywhere in the generator itself.
      for (const pattern of BANNED) expect(src).not.toMatch(pattern);
    });
  });
});
