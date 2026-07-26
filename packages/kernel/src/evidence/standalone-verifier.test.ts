// standalone-verifier.test.ts — T-K4 golden + integration proof.
//
// The verifier is a plain .mjs with NO `@caisson/*` import (a third party will not `bun install` the
// monorepo), so it cannot be imported into a typed test the normal way. Every case here spawns it as a
// real subprocess — exactly how a third party would run it — and asserts on stdout/exit code. This is
// also the load-bearing R3 drift guard: the golden case proves the inlined `canonicalize` byte-matches
// `@caisson/kernel`'s `canonical.ts` over a representative corpus.
import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign, createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalize, type JsonValue } from "../canonical.ts";
import { buildRowReceipt, type RowReceipt } from "../audit-verify.ts";

const VERIFIER_PATH = fileURLToPath(
  new URL("./standalone-verifier.mjs", import.meta.url),
);
const CHAIN_VERIFICATION = { valid: true, brokenAt: null } as const;

async function runVerifier(
  args: readonly string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["bun", VERIFIER_PATH, ...args], {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

const GOLDEN_CORPUS: readonly JsonValue[] = [
  { b: 1, a: 2, nested: { z: 1, a: 2, arr: [3, 1, 2] } },
  [3, 1, { z: 1, a: 2 }],
  "hello éè unicode",
  0,
  -1,
  3.14159,
  null,
  true,
  false,
  { empty: {}, emptyArr: [] },
  { deeply: { nested: { objects: { sort: { keys: 1, alphabetically: 2 } } } } },
];

describe("R3 — canonicalize drift guard (golden)", () => {
  test("the verifier's inlined canonicalize byte-matches @caisson/kernel canonical.ts", async () => {
    let dir: string | undefined;
    try {
      dir = await mkdtemp(join(tmpdir(), "caisson-verifier-golden-"));
      const corpusPath = join(dir, "corpus.json");
      await Bun.write(corpusPath, JSON.stringify(GOLDEN_CORPUS));

      const { stdout, stderr, exitCode } = await runVerifier([
        "--self-test-canonicalize",
        corpusPath,
      ]);
      expect(stderr).toBe("");
      expect(exitCode).toBe(0);
      const got: string[] = JSON.parse(stdout);
      const want = GOLDEN_CORPUS.map((v) => canonicalize(v));
      expect(got).toEqual(want);
    } finally {
      if (dir !== undefined) await rm(dir, { recursive: true, force: true });
    }
  });
});

/** Build a tiny 2-row signed chain + a matching evidence-pack-shaped fixture for the integration cases. */
function buildFixture(): {
  receipts: RowReceipt[];
  keyId: string;
  publicKeySpkiBase64: string;
  tenantId: string;
} {
  const keyId = "test-anchor-key";
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const kp = generateKeyPairSync("ed25519");
  const publicKeySpkiBase64 = kp.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");

  function link(prevHash: string | null, payload: JsonValue): string {
    return createHash("sha256")
      .update(canonicalize([prevHash, payload]))
      .digest("hex");
  }
  function signedAnchor(core: {
    length: number;
    tipHash: string;
    genesisHash: string;
  }) {
    const envelope = {
      domain: "caisson.audit-chain.anchor.v2",
      v: 2,
      accountId: tenantId,
      anchor: core,
    };
    return {
      ...core,
      sig: sign(
        null,
        Buffer.from(new TextEncoder().encode(canonicalize(envelope))),
        kp.privateKey,
      ).toString("base64"),
      keyId,
      sigV: 2 as const,
      sigAccountId: tenantId,
    };
  }

  const genesisPayload: JsonValue = { event: "genesis", v: 1 };
  const genesisHash = link(null, genesisPayload);
  const row1Payload: JsonValue = { event: "next", v: 2 };
  const row1Hash = link(genesisHash, row1Payload);

  const anchor0 = signedAnchor({
    length: 1,
    tipHash: genesisHash,
    genesisHash,
  });
  const anchor1 = signedAnchor({
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
    verifiedAt: "2026-07-13T00:00:00.000Z",
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
    verifiedAt: "2026-07-13T00:00:00.000Z",
    includeAnchorProvenance: true,
  });

  return {
    receipts: [r0, r1],
    keyId,
    publicKeySpkiBase64,
    tenantId,
  };
}

async function withPackFile<T>(
  pack: unknown,
  fn: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "caisson-verifier-pack-"));
  try {
    const path = join(dir, "pack.json");
    await Bun.write(path, JSON.stringify(pack));
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("verifyPack CLI (integration, subprocess)", () => {
  test("a healthy signed pack: all rows PASS, signature checked against the pinned key", async () => {
    const { receipts, keyId, publicKeySpkiBase64, tenantId } = buildFixture();
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: 2,
        receipts,
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
      async (path) => {
        const { stdout, stderr, exitCode } = await runVerifier([path]);
        expect(stderr).toBe("");
        expect(exitCode).toBe(0);
        expect(stdout).toContain(
          "row 0: link=pass anchor-equality=pass signature=pass -> PASS",
        );
        expect(stdout).toContain(
          "row 1: link=pass anchor-equality=pass signature=pass -> PASS",
        );
        expect(stdout).toContain(
          "PASS — all 2 row(s) verified from raw material.",
        );
      },
    );
  });

  test("a tampered payload FAILs the link leg without trusting the embedded checks block", async () => {
    const { receipts, keyId, publicKeySpkiBase64, tenantId } = buildFixture();
    const tampered: RowReceipt = {
      ...receipts[1]!,
      raw: { ...receipts[1]!.raw, payload: { event: "forged", v: 999 } },
      // The embedded `checks` still (falsely) claims pass — the verifier must ignore it (CR-06).
      checks: { linkRecompute: "pass", anchorEquality: "pass" },
    };
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        receipts: [receipts[0]!, tampered],
        chainLength: 2,
        tenantId,
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("row 1: link=fail");
        expect(stdout).toContain("FAIL — 1 of 2 row(s) failed verification.");
      },
    );
  });

  test("a forged signature (wrong public key) FAILs even though link + anchor equality pass", async () => {
    const { receipts, keyId, tenantId } = buildFixture();
    const otherKey = generateKeyPairSync("ed25519")
      .publicKey.export({ format: "der", type: "spki" })
      .toString("base64");
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: 2,
        receipts,
        anchorAuth: { keyId, publicKeySpkiBase64: otherKey },
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("signature=fail -> FAIL");
      },
    );
  });

  test("a pinned pack fails closed when a signature is stripped", async () => {
    const { receipts, keyId, publicKeySpkiBase64, tenantId } = buildFixture();
    const { sig: _sig, ...unsignedAnchor } = receipts[0]!.anchor;
    const stripped: RowReceipt = {
      ...receipts[0]!,
      anchor: unsignedAnchor,
    };

    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: 1,
        receipts: [stripped],
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("signature=not available");
        expect(stdout).toContain("-> FAIL");
      },
    );
  });

  test.each([
    ["key id substitution", { keyId: "attacker-key" }],
    ["malformed signature", { sig: "not-base64!" }],
  ])("%s fails a pinned pack", async (_label, patch) => {
    const { receipts, keyId, publicKeySpkiBase64, tenantId } = buildFixture();
    const compromised: RowReceipt = {
      ...receipts[0]!,
      anchor: { ...receipts[0]!.anchor, ...patch },
    };

    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: 1,
        receipts: [compromised],
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("signature=fail -> FAIL");
      },
    );
  });

  test("a valid tenant-A signed chain cannot be replayed as tenant B", async () => {
    const { receipts, keyId, publicKeySpkiBase64 } = buildFixture();
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId: "22222222-2222-4222-8222-222222222222",
        chainLength: 2,
        receipts,
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("signature=fail -> FAIL");
      },
    );
  });

  test("a redacted row reports link as not-applicable, never fail, and never blocks PASS", async () => {
    const { receipts, keyId, publicKeySpkiBase64, tenantId } = buildFixture();
    const redactedRow1: RowReceipt = {
      ...receipts[1]!,
      redacted: true,
      raw: { ...receipts[1]!.raw, payload: { event: "[redacted]" } },
    };
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        receipts: [receipts[0]!, redactedRow1],
        chainLength: 2,
        tenantId,
        anchorAuth: { keyId, publicKeySpkiBase64 },
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(0);
        expect(stdout).toContain(
          "row 1: link=not applicable (payload redacted) anchor-equality=pass signature=pass -> PASS",
        );
      },
    );
  });

  test("no anchorAuth in the pack: signature reports not-available, never a silent pass/fail", async () => {
    const { receipts, tenantId } = buildFixture();
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: 2,
        receipts,
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(0);
        expect(stdout).toContain(
          "signature=not available (unsigned or no pinned key) -> PASS",
        );
      },
    );
  });

  test.each([
    ["an empty pack", { chainLength: 0, receipts: [] }],
    ["a dropped receipt", { chainLength: 2, receipts: undefined }],
    ["a duplicated receipt", { chainLength: 2, receipts: undefined }],
    ["reordered receipts", { chainLength: 2, receipts: undefined }],
    ["an interior sequence gap", { chainLength: 2, receipts: undefined }],
    ["an anchor-length mismatch", { chainLength: 1, receipts: undefined }],
  ])("%s fails closed before row verification", async (label, shape) => {
    const { receipts, tenantId } = buildFixture();
    const malformedReceipts =
      label === "a dropped receipt"
        ? [receipts[0]!]
        : label === "a duplicated receipt"
          ? [receipts[0]!, receipts[0]!]
          : label === "reordered receipts"
            ? [receipts[1]!, receipts[0]!]
            : label === "an interior sequence gap"
              ? [receipts[0]!, { ...receipts[1]!, seq: 2 }]
              : label === "an anchor-length mismatch"
                ? [
                    {
                      ...receipts[0]!,
                      anchor: { ...receipts[0]!.anchor, length: 2 },
                    },
                  ]
                : [];
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: shape.chainLength,
        receipts: shape.receipts ?? malformedReceipts,
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("incomplete or malformed");
      },
    );
  });

  test("rejects an unbounded or control-bearing tenant id", async () => {
    const { receipts } = buildFixture();
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId: `acct\u0000${"x".repeat(300)}`,
        chainLength: 2,
        receipts,
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("incomplete or malformed");
      },
    );
  });

  test("an unsupported pack format fails closed", async () => {
    const { receipts, tenantId } = buildFixture();
    await withPackFile(
      {
        formatVersion: 2,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: 2,
        receipts,
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("incomplete or malformed");
      },
    );
  });

  test("an unsupported receipt format fails closed", async () => {
    const { receipts, tenantId } = buildFixture();
    await withPackFile(
      {
        formatVersion: 1,
        chainVerification: CHAIN_VERIFICATION,
        tenantId,
        chainLength: 2,
        receipts: [{ ...receipts[0]!, v: 2 }, receipts[1]!],
      },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("incomplete or malformed");
      },
    );
  });

  test.each([
    ["missing", undefined],
    ["invalid", { valid: false, brokenAt: 2 }],
  ])(
    "%s chain-level verification fails closed",
    async (_label, chainVerification) => {
      const { receipts, tenantId } = buildFixture();
      await withPackFile(
        {
          formatVersion: 1,
          ...(chainVerification === undefined ? {} : { chainVerification }),
          tenantId,
          chainLength: 2,
          receipts,
        },
        async (path) => {
          const { exitCode, stdout } = await runVerifier([path]);
          expect(exitCode).toBe(1);
          expect(stdout).toContain("incomplete or malformed");
        },
      );
    },
  );

  test("missing pack path arg exits 2 with a usage message on stderr", async () => {
    const { exitCode, stderr } = await runVerifier([]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("usage:");
  });
});
