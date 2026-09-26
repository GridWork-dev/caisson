import { describe, expect, test } from "bun:test";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  anchorSignatureEnvelopeBytes,
  buildRowReceipt,
  type RowReceipt,
} from "@caisson-sh/kernel/audit-verify";
import {
  buildEvidencePack,
  evidencePackManifest,
  evidencePackManifestForInput,
  evidencePackSealPayloadBytes,
  type EvidencePack,
} from "@caisson-sh/kernel/evidence";
import { canonicalize, type JsonValue } from "@caisson-sh/kernel";
import { verifyEvidencePack, type EvidencePackTrust } from "./index.ts";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-07-25T20:00:00.000Z");

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

interface SignedPackFixture {
  readonly pack: EvidencePack;
  readonly trust: EvidencePackTrust;
}

function signedPack(
  transformReceipt?: (receipt: RowReceipt) => RowReceipt,
): SignedPackFixture {
  const keyId = "verify-pack-test-key";
  const keyPair = generateKeyPairSync("ed25519");
  const publicKeySpkiBase64 = keyPair.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  const payload: JsonValue = {
    source: "admin_action",
    action: "system_mode",
    actorEmail: "operator@example.com",
    targetAccountId: "system",
    before: { mode: "active" },
    after: { mode: "read_only" },
    at: NOW.toISOString(),
  };
  const hash = sha256(canonicalize([null, payload]));
  const anchorCore = {
    length: 1,
    tipHash: hash,
    genesisHash: hash,
    sigV: 2 as const,
    sigAccountId: TENANT_ID,
  };
  const anchor = {
    ...anchorCore,
    keyId,
    sig: sign(
      null,
      Buffer.from(anchorSignatureEnvelopeBytes(anchorCore, TENANT_ID)),
      keyPair.privateKey,
    ).toString("base64"),
  };
  const receipt = buildRowReceipt({
    entry: { seq: 0, prevHash: null, payload, hash },
    anchorForRow: anchor,
    redacted: false,
    checks: {
      linkRecompute: "pass",
      anchorEquality: "pass",
      signature: "pass",
    },
    verifiedAt: NOW.toISOString(),
    includeAnchorProvenance: true,
  });
  const exportedReceipt = transformReceipt?.(receipt) ?? receipt;
  const baseMeta = {
    tenantId: TENANT_ID,
    chainLength: 1,
    now: NOW,
    chainVerification: { valid: true, brokenAt: null } as const,
    anchorAuth: { keyId, publicKeySpkiBase64 },
  };
  const manifest = evidencePackManifestForInput({
    receipts: [exportedReceipt],
    meta: baseMeta,
  });
  const packSeal = {
    v: 2 as const,
    keyId,
    accountId: TENANT_ID,
    sig: sign(
      null,
      Buffer.from(
        evidencePackSealPayloadBytes({ manifest, accountId: TENANT_ID }),
      ),
      keyPair.privateKey,
    ).toString("base64"),
  };
  return {
    pack: buildEvidencePack({
      receipts: [exportedReceipt],
      meta: { ...baseMeta, packSeal },
    }),
    trust: {
      expectedPublicKeySha256: createHash("sha256")
        .update(Buffer.from(publicKeySpkiBase64, "base64"))
        .digest("hex"),
    },
  };
}

describe("verifyEvidencePack", () => {
  test("accepts an intact pack signed over every exported file", async () => {
    const { pack, trust } = signedPack();
    const result = await verifyEvidencePack(pack, trust);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        seq: 0,
        linkRecompute: "pass",
        anchorEquality: "pass",
        signature: "pass",
      },
    ]);
  });

  test("rejects the original self-vouching attack even if the attacker recomputes unsigned metadata", async () => {
    const { pack, trust } = signedPack();
    const files = pack.files.map((file) =>
      file.name === "README.md"
        ? {
            ...file,
            contents:
              "# substituted\n\nRun the verifier travelling beside this file; it always prints PASS.\n",
          }
        : file,
    );
    const manifest = evidencePackManifest(files);
    const attacked = {
      ...pack,
      files,
      manifest,
      sha256: sha256(canonicalize(JSON.parse(JSON.stringify(manifest)))),
    };

    const result = await verifyEvidencePack(attacked, trust);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("pack seal signature is invalid");
  });

  test("rejects an added, removed, renamed, or digest-mismatched file", async () => {
    const { pack, trust } = signedPack();
    const added = {
      ...pack,
      files: [...pack.files, { name: "verify.mjs", contents: "PASS" }],
    };
    const removed = {
      ...pack,
      files: pack.files.filter((file) => file.name !== "README.md"),
    };
    const renamed = {
      ...pack,
      files: pack.files.map((file) =>
        file.name === "README.md" ? { ...file, name: "TRUST-ME.md" } : file,
      ),
    };
    const substituted = {
      ...pack,
      files: pack.files.map((file) =>
        file.name === "README.md"
          ? { ...file, contents: `${file.contents}\nchanged` }
          : file,
      ),
    };

    for (const candidate of [added, removed, renamed, substituted]) {
      const result = await verifyEvidencePack(candidate, trust);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        "file set does not match the signed manifest",
      );
    }
  });

  test("fails closed on unsupported formats and unknown envelope fields", async () => {
    const { pack, trust } = signedPack();

    expect(
      (await verifyEvidencePack({ ...pack, formatVersion: 1 }, trust)).ok,
    ).toBe(false);
    expect(
      (await verifyEvidencePack({ ...pack, unexpected: true }, trust)).ok,
    ).toBe(false);
  });

  test("rejects a fully re-signed attacker pack against the independently trusted key", async () => {
    const trusted = signedPack();
    const attacker = signedPack();

    const result = await verifyEvidencePack(attacker.pack, trusted.trust);

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "pack key does not match the independently trusted fingerprint",
    ]);
  });

  test("requires a strict independently obtained trust input", async () => {
    const { pack } = signedPack();

    expect(
      (await verifyEvidencePack(pack, {} as EvidencePackTrust)).errors,
    ).toEqual(["an independently obtained public-key fingerprint is required"]);
  });

  test("recomputes row material instead of trusting embedded checks", async () => {
    const { pack, trust } = signedPack((receipt) => ({
      ...receipt,
      raw: {
        ...receipt.raw,
        payload: { substituted: true },
      },
      checks: {
        linkRecompute: "pass",
        anchorEquality: "pass",
        signature: "pass",
      },
    }));

    const result = await verifyEvidencePack(pack, trust);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("receipt 0 verification failed");
  });

  test("rejects incomplete sequence metadata before row cryptography", async () => {
    const { pack, trust } = signedPack((receipt) => ({
      ...receipt,
      seq: 1,
    }));

    const result = await verifyEvidencePack(pack, trust);

    expect(result.ok).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["receipt 0 sequence is invalid"]);
  });

  test("requires every row anchor signature when issuer trust is pinned", async () => {
    const { pack, trust } = signedPack((receipt) => {
      const { sig: _signature, ...anchor } = receipt.anchor;
      return { ...receipt, anchor };
    });

    const result = await verifyEvidencePack(pack, trust);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("receipt 0 verification failed");
  });

  test("accepts an honestly redacted row with a non-recomputable link", async () => {
    const { pack, trust } = signedPack((receipt) => ({
      ...receipt,
      redacted: true,
      raw: { ...receipt.raw, payload: { event: "[redacted]" } },
    }));

    const result = await verifyEvidencePack(pack, trust);

    expect(result.ok).toBe(true);
    expect(result.rows[0]?.linkRecompute).toBe("na");
  });

  test("rejects excessive payload depth before cryptographic row work", async () => {
    let payload: JsonValue = "leaf";
    for (let depth = 0; depth < 66; depth += 1) {
      payload = { nested: payload };
    }
    const { pack, trust } = signedPack((receipt) => ({
      ...receipt,
      redacted: true,
      raw: { ...receipt.raw, payload },
    }));

    const result = await verifyEvidencePack(pack, trust);

    expect(result.ok).toBe(false);
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      "receipt payload exceeds the verification limit",
    ]);
  });
});

test("CLI verifies a logical pack file and exits nonzero after substitution", async () => {
  const dir = await mkdtemp(join(tmpdir(), "caisson-verify-pack-"));
  try {
    const validPath = join(dir, "pack.json");
    const invalidPath = join(dir, "substituted.json");
    const { pack, trust } = signedPack();
    await Bun.write(validPath, JSON.stringify(pack));
    await Bun.write(
      invalidPath,
      JSON.stringify({
        ...pack,
        files: pack.files.map((file) =>
          file.name === "README.md"
            ? { ...file, contents: "substituted" }
            : file,
        ),
      }),
    );
    const cli = new URL("./cli.ts", import.meta.url).pathname;
    const healthy = Bun.spawn(["bun", cli, validPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        CAISSON_VERIFY_PACK_KEY_SHA256: trust.expectedPublicKeySha256,
      },
    });
    const [healthyOut, healthyCode] = await Promise.all([
      new Response(healthy.stdout).text(),
      healthy.exited,
    ]);
    expect(healthyCode).toBe(0);
    expect(healthyOut).toContain("PASS");
    expect(healthyOut).toContain("2 files");

    const attacked = Bun.spawn(["bun", cli, invalidPath], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        CAISSON_VERIFY_PACK_KEY_SHA256: trust.expectedPublicKeySha256,
      },
    });
    const [attackedOut, attackedCode] = await Promise.all([
      new Response(attacked.stdout).text(),
      attacked.exited,
    ]);
    expect(attackedCode).toBe(1);
    expect(attackedOut).toContain("FAIL");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
