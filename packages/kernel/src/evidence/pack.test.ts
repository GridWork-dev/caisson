// pack.test.ts — T-E1 proof: the pack round-trips through the REAL standalone verifier (subprocess,
// exactly as a third party would run it), is deterministic regardless of input order, and its README
// never overclaims (SPEC copy law) relative to whether a pinned anchor-signing key was supplied.
import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize, type JsonValue } from "../canonical.ts";
import { buildRowReceipt, type RowReceipt } from "../audit-verify.ts";
import { buildEvidencePack, EVIDENCE_PACK_FORMAT_VERSION } from "./pack.ts";

const NOW = new Date("2026-07-13T12:00:00.000Z");

function link(prevHash: string | null, payload: JsonValue): string {
  return createHash("sha256")
    .update(canonicalize([prevHash, payload]))
    .digest("hex");
}

function buildSignedFixture(): {
  receipts: RowReceipt[];
  keyId: string;
  publicKeySpkiBase64: string;
} {
  const keyId = "test-anchor-key";
  const kp = generateKeyPairSync("ed25519");
  const publicKeySpkiBase64 = kp.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");

  function signCore(core: {
    length: number;
    tipHash: string;
    genesisHash: string;
  }): string {
    const bytes = new TextEncoder().encode(canonicalize(core));
    return sign(null, Buffer.from(bytes), kp.privateKey).toString("base64");
  }

  const genesisPayload: JsonValue = { event: "genesis", v: 1 };
  const genesisHash = link(null, genesisPayload);
  const row1Payload: JsonValue = { event: "next", v: 2, password: "s3cr3t" };
  const row1Hash = link(genesisHash, row1Payload);

  const anchor0 = {
    length: 1,
    tipHash: genesisHash,
    genesisHash,
    sig: signCore({ length: 1, tipHash: genesisHash, genesisHash }),
    keyId,
  };
  const anchor1 = {
    length: 2,
    tipHash: row1Hash,
    genesisHash,
    sig: signCore({ length: 2, tipHash: row1Hash, genesisHash }),
    keyId,
  };

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

  return { receipts: [r0, r1], keyId, publicKeySpkiBase64 };
}

async function runVerifierOnPack(
  receiptsJsonContents: string,
): Promise<{ stdout: string; exitCode: number }> {
  const dir = await mkdtemp(join(tmpdir(), "caisson-pack-test-"));
  try {
    const path = join(dir, "receipts.json");
    await writeFile(path, receiptsJsonContents, "utf8");
    const verifierPath = fileURLToPath(
      new URL("./standalone-verifier.mjs", import.meta.url),
    );
    const proc = Bun.spawn(["bun", verifierPath, path], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    return { stdout, exitCode };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("buildEvidencePack", () => {
  test("round-trips through the real standalone verifier: healthy signed pack PASSes", async () => {
    const { receipts, keyId, publicKeySpkiBase64 } = buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: {
        tenantId: "tenant-1",
        chainLength: 2,
        now: NOW,
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
    });
    expect(pack.formatVersion).toBe(EVIDENCE_PACK_FORMAT_VERSION);
    const receiptsFile = pack.files.find((f) => f.name === "receipts.json");
    expect(receiptsFile).toBeDefined();

    const { stdout, exitCode } = await runVerifierOnPack(
      receiptsFile!.contents,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      "row 0: link=pass anchor-equality=pass signature=pass -> PASS",
    );
    expect(stdout).toContain(
      "row 1: link=pass anchor-equality=pass signature=pass -> PASS",
    );
    expect(stdout).toContain("PASS — all 2 row(s) verified from raw material.");
  });

  test("a tampered row FAILs through the real verifier", async () => {
    const { receipts, keyId, publicKeySpkiBase64 } = buildSignedFixture();
    const tampered: RowReceipt = {
      ...receipts[1]!,
      raw: { ...receipts[1]!.raw, payload: { event: "forged" } },
    };
    const pack = buildEvidencePack({
      receipts: [receipts[0]!, tampered],
      meta: {
        tenantId: "tenant-1",
        chainLength: 2,
        now: NOW,
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
    });
    const receiptsFile = pack.files.find((f) => f.name === "receipts.json")!;
    const { stdout, exitCode } = await runVerifierOnPack(receiptsFile.contents);
    expect(exitCode).toBe(1);
    expect(stdout).toContain("row 1: link=fail");
  });

  test("deterministic: input order never changes the receipts.json bytes or the pack digest", () => {
    const { receipts, keyId, publicKeySpkiBase64 } = buildSignedFixture();
    const meta = {
      tenantId: "tenant-1",
      chainLength: 2,
      now: NOW,
      anchorAuth: { keyId, publicKeySpkiBase64 },
    };
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

  test("verify.mjs is embedded verbatim (byte-identical to the source file)", async () => {
    const { receipts, keyId, publicKeySpkiBase64 } = buildSignedFixture();
    const pack = buildEvidencePack({
      receipts,
      meta: {
        tenantId: "t",
        chainLength: 2,
        now: NOW,
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
    });
    const embedded = pack.files.find((f) => f.name === "verify.mjs")!.contents;
    const onDisk = await Bun.file(
      new URL("./standalone-verifier.mjs", import.meta.url),
    ).text();
    expect(embedded).toBe(onDisk);
  });

  describe("README honesty (SPEC copy law — never overclaim)", () => {
    const BANNED = [/impossible to tamper/i, /\bindependently verified\b/i];

    test("signed pack (anchorAuth present): claims the signature-checked seal, no banned strings", () => {
      const { receipts, keyId, publicKeySpkiBase64 } = buildSignedFixture();
      const pack = buildEvidencePack({
        receipts,
        meta: {
          tenantId: "t",
          chainLength: 2,
          now: NOW,
          anchorAuth: { keyId, publicKeySpkiBase64 },
        },
      });
      const readme = pack.files.find((f) => f.name === "README.md")!.contents;
      expect(readme).toContain("verified against write-once anchor");
      expect(readme).toContain("(signature-checked)");
      for (const pattern of BANNED) expect(readme).not.toMatch(pattern);
    });

    test("unsigned pack (no anchorAuth): honest self-consistency claim only, no banned strings", () => {
      const { receipts } = buildSignedFixture();
      const pack = buildEvidencePack({
        receipts,
        meta: { tenantId: "t", chainLength: 2, now: NOW },
      });
      const readme = pack.files.find((f) => f.name === "README.md")!.contents;
      expect(readme).toContain("locally recomputed");
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
