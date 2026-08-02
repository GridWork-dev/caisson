import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import {
  anchorChain,
  buildChain,
  chainEntry,
  hashChainLink,
  verifyChain,
  type AuditChainAnchor,
} from "./audit-chain.ts";
import {
  anchorChain as anchorChainFromVerify,
  buildChainAsync,
  buildRowReceipt,
  anchorSignatureEnvelopeBytes,
  chainEntryAsync,
  classifyRowState,
  hashChainLinkAsync,
  verifyAnchorSignature,
  verifyChainAsync,
  verifyEntryAgainstAnchor,
  type PinnedAnchorKey,
  type VerifyLegs,
} from "./audit-verify.ts";

const PAYLOADS = [
  { event: "locked", artifactId: "art-1", version: 1 },
  { event: "superseded", artifactId: "art-1", version: 2 },
  { event: "locked", artifactId: "art-2", version: 1 },
] as const;

const CHAIN = buildChain(PAYLOADS);
const ANCHOR_ACCOUNT = "11111111-1111-4111-8111-111111111111";
/** The per-length anchor minted when row `i` was the tip (= anchorChain over the prefix `0..i`). */
function anchorForRow(i: number): AuditChainAnchor {
  return anchorChain(CHAIN.slice(0, i + 1));
}

describe("hashChainLinkAsync (WebCrypto twin)", () => {
  test("byte-for-byte agrees with the sync node hashChainLink (cross-impl fixture)", async () => {
    for (const entry of CHAIN) {
      expect(await hashChainLinkAsync(entry.prevHash, entry.payload)).toBe(
        hashChainLink(entry.prevHash, entry.payload),
      );
      // ...and it equals the stored hash the chain committed.
      expect(await hashChainLinkAsync(entry.prevHash, entry.payload)).toBe(
        entry.hash,
      );
    }
  });
});

describe("the whole-chain WebCrypto twins agree with the node originals", () => {
  test("anchorChain on `/audit-verify` is the SAME function, not a second copy", () => {
    // The browser entry re-exports the one pure implementation; a re-implementation would pass a
    // deep-equal check but fails this reference identity.
    expect(anchorChainFromVerify).toBe(anchorChain);
  });

  test("chainEntryAsync matches chainEntry (genesis and linked)", async () => {
    const genesis = await chainEntryAsync(null, PAYLOADS[0]);
    expect(genesis).toEqual(chainEntry(null, PAYLOADS[0]));
    expect(await chainEntryAsync(genesis, PAYLOADS[1])).toEqual(
      chainEntry(genesis, PAYLOADS[1]),
    );
  });

  test("buildChainAsync is byte-identical to buildChain", async () => {
    expect(await buildChainAsync(PAYLOADS)).toEqual(CHAIN);
  });

  test.each([
    ["clean, no anchor", CHAIN, undefined],
    ["clean, anchored", CHAIN, anchorChain(CHAIN)],
    [
      "interior tamper",
      [CHAIN[0]!, { ...CHAIN[1]!, payload: { event: "forged" } }, CHAIN[2]!],
      anchorChain(CHAIN),
    ],
    ["tail truncation", CHAIN.slice(0, 2), anchorChain(CHAIN)],
    [
      "rewritten root",
      CHAIN,
      { ...anchorChain(CHAIN), genesisHash: "0".repeat(64) },
    ],
    [
      "rewritten tip",
      CHAIN,
      { ...anchorChain(CHAIN), tipHash: "0".repeat(64) },
    ],
    ["reordered", [CHAIN[1]!, CHAIN[0]!, CHAIN[2]!], undefined],
  ])(
    "verifyChainAsync returns the node verdict on %s",
    async (_name, entries, anchor) => {
      expect(await verifyChainAsync(entries, anchor)).toEqual(
        verifyChain(entries, anchor),
      );
    },
  );

  test("the truncation verdict is really a failure — the parity check is not comparing two passes", async () => {
    expect(
      await verifyChainAsync(CHAIN.slice(0, 2), anchorChain(CHAIN)),
    ).toEqual({ valid: false, brokenAt: 2 });
    // ...and the surviving prefix on its own still hashes clean, which is why the anchor is needed.
    expect(await verifyChainAsync(CHAIN.slice(0, 2))).toEqual({
      valid: true,
      brokenAt: null,
    });
  });
});

describe("verifyEntryAgainstAnchor", () => {
  test("healthy row: link + anchor pass; signature `na` with no pinned key", async () => {
    const legs = await verifyEntryAgainstAnchor(CHAIN[1]!, anchorForRow(1));
    expect(legs).toEqual({
      linkRecompute: "pass",
      anchorEquality: "pass",
      signature: "na",
    });
  });

  test("link recompute fails when the stored hash does not match its inputs", async () => {
    const tampered = { ...CHAIN[1]!, hash: "0".repeat(64) };
    const legs = await verifyEntryAgainstAnchor(tampered, {
      ...anchorForRow(1),
      tipHash: "0".repeat(64), // keep leg 2 pass so leg 1 is what we isolate
    });
    expect(legs.linkRecompute).toBe("fail");
  });

  test("anchor equality fails when the anchor tip does not match the row hash", async () => {
    const legs = await verifyEntryAgainstAnchor(CHAIN[1]!, {
      ...anchorForRow(1),
      tipHash: "f".repeat(64),
    });
    expect(legs.anchorEquality).toBe("fail");
    expect(legs.linkRecompute).toBe("pass"); // the row itself is intact
  });

  test("redacted row: leg 1 is na (recompute skipped), leg 2 still evaluated", async () => {
    // A masked payload — recomputing it would NOT match; redacted:true must make it `na`, not `fail`.
    const masked = { ...CHAIN[1]!, payload: { event: "[redacted]" } };
    const legs = await verifyEntryAgainstAnchor(masked, anchorForRow(1), {
      redacted: true,
    });
    expect(legs.linkRecompute).toBe("na");
    expect(legs.anchorEquality).toBe("pass");
    expect(legs.signature).toBe("na");
  });
});

/** Sign an anchor's canonical CORE (`{length, tipHash, genesisHash?}`) with an ephemeral Ed25519 key
 *  — the same core the client's WebCrypto leg reconstructs — and return the signed anchor + pinned key. */
function signedAnchor(
  base: AuditChainAnchor,
  keyId = "test-anchor-key",
): { anchor: AuditChainAnchor; pinnedKey: PinnedAnchorKey } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const signatureAnchor: AuditChainAnchor = {
    ...base,
    sigV: 2,
    sigAccountId: ANCHOR_ACCOUNT,
  };
  const sig = nodeSign(
    null,
    Buffer.from(anchorSignatureEnvelopeBytes(signatureAnchor, ANCHOR_ACCOUNT)),
    privateKey,
  ).toString("base64");
  const publicKeySpkiBase64 = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
  return {
    anchor: { ...signatureAnchor, sig, keyId },
    pinnedKey: { keyId, publicKeySpkiBase64 },
  };
}

describe("verifyAnchorSignature (leg 3)", () => {
  test("signed anchor + matching pinned key → pass (client checks a real signature)", async () => {
    const { anchor, pinnedKey } = signedAnchor(anchorForRow(1));
    expect(await verifyAnchorSignature(anchor, pinnedKey, ANCHOR_ACCOUNT)).toBe(
      "pass",
    );
  });

  test("forged signature (right key, wrong core) → fail", async () => {
    const { anchor, pinnedKey } = signedAnchor(anchorForRow(1));
    // Mutate the tipHash AFTER signing: the signature no longer covers these core bytes.
    const forged: AuditChainAnchor = { ...anchor, tipHash: "f".repeat(64) };
    expect(await verifyAnchorSignature(forged, pinnedKey, ANCHOR_ACCOUNT)).toBe(
      "fail",
    );
  });

  test("unsigned anchor → na (nothing to check, never a false fail)", async () => {
    const { pinnedKey } = signedAnchor(anchorForRow(1));
    expect(
      await verifyAnchorSignature(anchorForRow(1), pinnedKey, ANCHOR_ACCOUNT),
    ).toBe("na");
  });

  test("no pinned key → na (the seal is withheld, the row is not tampered)", async () => {
    const { anchor } = signedAnchor(anchorForRow(1));
    expect(await verifyAnchorSignature(anchor)).toBe("na");
  });

  test("keyId mismatch → fail (a pinned identity cannot be substituted)", async () => {
    const { anchor } = signedAnchor(anchorForRow(1), "signer-A");
    const { pinnedKey } = signedAnchor(anchorForRow(1), "signer-B");
    expect(await verifyAnchorSignature(anchor, pinnedKey, ANCHOR_ACCOUNT)).toBe(
      "fail",
    );
  });

  test("through verifyEntryAgainstAnchor: a forged signature classifies the row `tampered`", async () => {
    const { anchor, pinnedKey } = signedAnchor(anchorForRow(1));
    const forged: AuditChainAnchor = { ...anchor, tipHash: "f".repeat(64) };
    const legs = await verifyEntryAgainstAnchor(CHAIN[1]!, forged, {
      pinnedKey,
      expectedAccountId: ANCHOR_ACCOUNT,
    });
    expect(legs.signature).toBe("fail");
    expect(classifyRowState(legs, { redacted: false })).toBe("tampered");
  });

  test("through verifyEntryAgainstAnchor: a good signature classifies `verified` (all three legs pass)", async () => {
    const { anchor, pinnedKey } = signedAnchor(anchorForRow(1));
    const legs = await verifyEntryAgainstAnchor(CHAIN[1]!, anchor, {
      pinnedKey,
      expectedAccountId: ANCHOR_ACCOUNT,
    });
    expect(legs).toEqual({
      linkRecompute: "pass",
      anchorEquality: "pass",
      signature: "pass",
    });
    expect(classifyRowState(legs, { redacted: false })).toBe("verified");
  });

  test("a genuine signed row relabeled to another sequence is tampered", async () => {
    const { anchor, pinnedKey } = signedAnchor(anchorForRow(0));
    const relabeled = { ...CHAIN[0]!, seq: 99 };

    const legs = await verifyEntryAgainstAnchor(relabeled, anchor, {
      pinnedKey,
      expectedAccountId: ANCHOR_ACCOUNT,
    });

    expect(legs.linkRecompute).toBe("pass");
    expect(legs.signature).toBe("pass");
    expect(legs.anchorEquality).toBe("fail");
    expect(classifyRowState(legs, { redacted: false })).toBe("tampered");
  });
});

describe("classifyRowState (six states)", () => {
  const pass: VerifyLegs = { linkRecompute: "pass", anchorEquality: "pass" };
  test("both pass, non-genesis → verified", () => {
    expect(classifyRowState(pass, { redacted: false })).toBe("verified");
  });
  test("both pass, genesis → genesis", () => {
    expect(classifyRowState(pass, { redacted: false, isGenesis: true })).toBe(
      "genesis",
    );
  });
  test("redacted (leg1 na) + anchor pass → anchor-confirmed-original-not-disclosed", () => {
    expect(
      classifyRowState(
        { linkRecompute: "na", anchorEquality: "pass" },
        { redacted: true },
      ),
    ).toBe("anchor-confirmed-original-not-disclosed");
  });
  test("na NOT from redaction (WebCrypto unavailable) → unverifiable, never verified (L4)", () => {
    expect(
      classifyRowState(
        { linkRecompute: "na", anchorEquality: "pass" },
        { redacted: false },
      ),
    ).toBe("unverifiable");
  });
  test("any leg fail → tampered (leg named in the legs object)", () => {
    expect(
      classifyRowState(
        { linkRecompute: "fail", anchorEquality: "pass" },
        { redacted: false },
      ),
    ).toBe("tampered");
    expect(
      classifyRowState(
        { linkRecompute: "pass", anchorEquality: "fail" },
        { redacted: false },
      ),
    ).toBe("tampered");
    // A signed anchor whose signature does not verify is a forged anchor → tampered.
    expect(
      classifyRowState(
        { linkRecompute: "pass", anchorEquality: "pass", signature: "fail" },
        { redacted: false },
      ),
    ).toBe("tampered");
  });
  test("redacted genesis surfaces the redaction-honest state, not genesis", () => {
    expect(
      classifyRowState(
        { linkRecompute: "na", anchorEquality: "pass" },
        { redacted: true, isGenesis: true },
      ),
    ).toBe("anchor-confirmed-original-not-disclosed");
  });
  test("pending short-circuits", () => {
    expect(classifyRowState(pass, { redacted: false, pending: true })).toBe(
      "pending",
    );
  });
  test("a required signature that is absent or unavailable is unverifiable, never verified", () => {
    expect(
      classifyRowState(
        {
          linkRecompute: "pass",
          anchorEquality: "pass",
          signature: "na",
        },
        { redacted: false, requireSignature: true },
      ),
    ).toBe("unverifiable");
  });
});

describe("buildRowReceipt (CR-06 versioned raw material)", () => {
  test("carries raw material sufficient to recompute both legs, omits the WORM key", async () => {
    const entry = CHAIN[2]!;
    const anchor = anchorForRow(2);
    const checks = await verifyEntryAgainstAnchor(entry, anchor);
    const receipt = buildRowReceipt({
      entry,
      anchorForRow: anchor,
      redacted: false,
      checks,
      verifiedAt: "2026-07-13T00:00:00.000Z",
    });
    expect(receipt.v).toBe(1);
    expect(receipt.seq).toBe(2);
    // L2: no internal storage key leaks into the exportable receipt.
    expect(receipt.anchor).toEqual({
      length: anchor.length,
      tipHash: anchor.tipHash,
    });
    expect("key" in receipt.anchor).toBe(false);
    // The verifier recomputes BOTH legs from `raw` alone, ignoring `checks`.
    expect(
      await hashChainLinkAsync(receipt.raw.prevHash, receipt.raw.payload),
    ).toBe(receipt.hash);
    expect(receipt.anchor.tipHash).toBe(receipt.hash);
  });
});

describe("R1 — audit-verify is node-free (bundle-safe)", () => {
  test("the module imports zero node: specifiers", () => {
    const src = readFileSync(
      new URL("./audit-verify.ts", import.meta.url),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["']node:/);
    expect(src).not.toMatch(/import\s*\(\s*["']node:/);
  });
});
