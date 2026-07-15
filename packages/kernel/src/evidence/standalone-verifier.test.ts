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
} {
  const keyId = "test-anchor-key";
  const kp = generateKeyPairSync("ed25519");
  const publicKeySpkiBase64 = kp.publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");

  function link(prevHash: string | null, payload: JsonValue): string {
    return createHash("sha256")
      .update(canonicalize([prevHash, payload]))
      .digest("hex");
  }
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
  const row1Payload: JsonValue = { event: "next", v: 2 };
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

  return { receipts: [r0, r1], keyId, publicKeySpkiBase64 };
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
    const { receipts, keyId, publicKeySpkiBase64 } = buildFixture();
    await withPackFile(
      { receipts, anchorAuth: { keyId, publicKeySpkiBase64 } },
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
    const { receipts, keyId, publicKeySpkiBase64 } = buildFixture();
    const tampered: RowReceipt = {
      ...receipts[1]!,
      raw: { ...receipts[1]!.raw, payload: { event: "forged", v: 999 } },
      // The embedded `checks` still (falsely) claims pass — the verifier must ignore it (CR-06).
      checks: { linkRecompute: "pass", anchorEquality: "pass" },
    };
    await withPackFile(
      {
        receipts: [receipts[0]!, tampered],
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
    const { receipts, keyId } = buildFixture();
    const otherKey = generateKeyPairSync("ed25519")
      .publicKey.export({ format: "der", type: "spki" })
      .toString("base64");
    await withPackFile(
      { receipts, anchorAuth: { keyId, publicKeySpkiBase64: otherKey } },
      async (path) => {
        const { exitCode, stdout } = await runVerifier([path]);
        expect(exitCode).toBe(1);
        expect(stdout).toContain("signature=fail -> FAIL");
      },
    );
  });

  test("a redacted row reports link as not-applicable, never fail, and never blocks PASS", async () => {
    const { receipts, keyId, publicKeySpkiBase64 } = buildFixture();
    const redactedRow1: RowReceipt = {
      ...receipts[1]!,
      redacted: true,
      raw: { ...receipts[1]!.raw, payload: { event: "[redacted]" } },
    };
    await withPackFile(
      {
        receipts: [receipts[0]!, redactedRow1],
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
    const { receipts } = buildFixture();
    await withPackFile({ receipts }, async (path) => {
      const { exitCode, stdout } = await runVerifier([path]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain(
        "signature=not available (unsigned or no pinned key) -> PASS",
      );
    });
  });

  test("missing pack path arg exits 2 with a usage message on stderr", async () => {
    const { exitCode, stderr } = await runVerifier([]);
    expect(exitCode).toBe(2);
    expect(stderr).toContain("usage:");
  });
});
