#!/usr/bin/env node
// standalone-verifier.mjs — a self-contained, zero-dependency verifier for a Caisson audit-chain
// evidence pack (T-K4, fork c/d, CR-06). A third party will NOT `bun install` the monorepo to check
// their pack, so this file imports NOTHING from `@caisson/*` — it inlines the exact canonicalization
// (byte-pinned against `@caisson/kernel`'s `canonical.ts` by a golden test) and the hash/signature
// primitives it needs, using only runtime-global WebCrypto with a `node:crypto` fallback (Node builtins
// are not an npm dependency).
//
// ponytail: inlined canonicalize is a deliberate duplicate of kernel/canonical.ts — pinned by the
// golden test in standalone-verifier.test.ts; upgrade path = codegen from canonical.ts if a third
// divergence ever appears.
//
// What this recomputes, PER ROW, from the pack's raw material — it NEVER trusts the embedded `checks`
// block (CR-06):
//   0. full-chain gate   — the issuer's chain snapshot must report `{valid:true, brokenAt:null}`;
//                           absent or detected-broken snapshots fail before row verification.
//   1. link recompute    — SHA-256(canonicalize([prevHash, payload])) === hash (skipped, reported "na",
//                           for a redacted row — the masked payload cannot recompute the original hash).
//   2. anchor equality    — anchor.tipHash === hash (the per-row commitment; L2's public-tag rule, plain
//                           equality is correct, not a secret compare).
//   3. anchor signature   — required when the pack supplies `anchorAuth`: v2 signature, pinned key id,
//                           and tenant-bound WORM account must all match. A missing signature reports
//                           "not-available" but still makes the overall verdict FAIL.
//
// A row's overall verdict is FAIL on a failed content/anchor leg, or whenever configured anchor
// authentication does not produce a passing signature.

// --- inlined canonicalize (byte-identical to @caisson/kernel canonical.ts) ----------------------
function sortValue(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(
        `standalone-verifier: non-finite number is not canonicalizable: ${String(value)}`,
      );
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(sortValue);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key]);
  return out;
}

export function canonicalize(value) {
  return JSON.stringify(sortValue(value));
}

// --- inlined base64 <-> bytes (Buffer where available, atob/btoa fallback) ----------------------
function base64ToBytes(b64) {
  if (
    typeof b64 !== "string" ||
    b64.length === 0 ||
    b64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)
  ) {
    throw new Error("standalone-verifier: malformed base64");
  }
  if (typeof Buffer !== "undefined")
    return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// --- inlined SHA-256 (WebCrypto primary, node:crypto fallback) -----------------------------------
function toHex(bytes) {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return toHex(new Uint8Array(digest));
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

async function hashChainLink(prevHash, payload) {
  const bytes = new TextEncoder().encode(canonicalize([prevHash, payload]));
  return sha256Hex(bytes);
}

// --- inlined Ed25519 signature verify (WebCrypto primary, node:crypto fallback) ------------------
async function verifyEd25519(coreBytes, sigBase64, publicKeySpkiBase64) {
  const sigBytes = base64ToBytes(sigBase64);
  const spkiBytes = base64ToBytes(publicKeySpkiBase64);
  if (globalThis.crypto?.subtle) {
    try {
      const key = await globalThis.crypto.subtle.importKey(
        "spki",
        spkiBytes,
        { name: "Ed25519" },
        false,
        ["verify"],
      );
      return await globalThis.crypto.subtle.verify(
        { name: "Ed25519" },
        key,
        sigBytes,
        coreBytes,
      );
    } catch {
      // Fall through to the node:crypto path (older runtimes lack WebCrypto Ed25519 support).
    }
  }
  const { verify, createPublicKey } = await import("node:crypto");
  const pub = createPublicKey({
    key: Buffer.from(spkiBytes),
    format: "der",
    type: "spki",
  });
  return verify(null, Buffer.from(coreBytes), pub, Buffer.from(sigBytes));
}

const ANCHOR_SIGNATURE_DOMAIN = "caisson.audit-chain.anchor.v2";
const ANCHOR_SIGNATURE_VERSION = 2;

function anchorSignatureEnvelopeBytes(anchor, accountId) {
  const core = { length: anchor.length, tipHash: anchor.tipHash };
  if (anchor.genesisHash !== undefined) core.genesisHash = anchor.genesisHash;
  return new TextEncoder().encode(
    canonicalize({
      domain: ANCHOR_SIGNATURE_DOMAIN,
      v: ANCHOR_SIGNATURE_VERSION,
      accountId,
      anchor: core,
    }),
  );
}

async function wormAnchorAccount(id) {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return id.toLowerCase();
  }
  const hex = await sha256Hex(new TextEncoder().encode(id));
  const variant = (
    (Number.parseInt(hex.slice(16, 17), 16) & 0x3) |
    0x8
  ).toString(16);
  const raw =
    hex.slice(0, 12) + "8" + hex.slice(13, 16) + variant + hex.slice(17, 32);
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20, 32)}`;
}

/**
 * Verify one receipt against the pack's (optional) anchor-signing public key. Returns
 * `{ seq, link, anchorEquality, signature, overall }` — never reads the receipt's own `checks`.
 */
export async function verifyReceipt(receipt, anchorAuth, tenantId) {
  const expectedAnchorLength =
    Number.isSafeInteger(receipt.seq) &&
    receipt.seq >= 0 &&
    receipt.seq < Number.MAX_SAFE_INTEGER
      ? receipt.seq + 1
      : undefined;
  const anchorEquality =
    receipt.anchor.tipHash === receipt.hash &&
    receipt.anchor.length === expectedAnchorLength
      ? "pass"
      : "fail";

  let link;
  if (receipt.redacted === true) {
    link = "na"; // CR-06 — a masked payload can never recompute the original hash. Not a fail.
  } else {
    const recomputed = await hashChainLink(
      receipt.raw.prevHash,
      receipt.raw.payload,
    );
    link = recomputed === receipt.hash ? "pass" : "fail";
  }

  let signature = "not-available";
  if (anchorAuth !== undefined) {
    const expectedAccountId = await wormAnchorAccount(tenantId);
    if (
      receipt.anchor.sig === undefined ||
      receipt.anchor.sigV !== ANCHOR_SIGNATURE_VERSION
    ) {
      signature = "not-available";
    } else if (
      anchorAuth.keyId !== receipt.anchor.keyId ||
      receipt.anchor.sigAccountId !== expectedAccountId
    ) {
      signature = "fail";
    } else {
      try {
        const ok = await verifyEd25519(
          anchorSignatureEnvelopeBytes(receipt.anchor, expectedAccountId),
          receipt.anchor.sig,
          anchorAuth.publicKeySpkiBase64,
        );
        signature = ok ? "pass" : "fail";
      } catch {
        signature = "fail";
      }
    }
  }

  const overall =
    // nosemgrep: no-insecure-token-compare -- link/anchorEquality/signature are pass/fail verdict strings, not secrets; the Ed25519 signature check itself is verifyEd25519 above. No timing side channel on a public verdict.
    link === "fail" ||
    anchorEquality === "fail" ||
    signature === "fail" ||
    (anchorAuth !== undefined && signature !== "pass")
      ? "FAIL"
      : "PASS";
  return { seq: receipt.seq, link, anchorEquality, signature, overall };
}

const MAX_PACK_CHAIN_LENGTH = 1_000_000;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoundedString(value, max) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/**
 * Prove the pack is a complete, ordered chain snapshot before checking any row. This prevents a
 * valid signed subset, duplicate, or relabeled historical row from earning a green pack verdict.
 */
function assertCompletePack(pack) {
  if (!isRecord(pack) || pack.formatVersion !== 1)
    throw new Error("invalid pack");
  if (
    !isRecord(pack.chainVerification) ||
    pack.chainVerification.valid !== true ||
    pack.chainVerification.brokenAt !== null
  ) {
    throw new Error("invalid chain verification");
  }
  if (
    !isBoundedString(pack.tenantId, 256) ||
    // eslint-disable-next-line no-control-regex -- fail closed on C0/C1 tenant-id bytes.
    /[\u0000-\u001f\u007f-\u009f\s/\\]/u.test(pack.tenantId)
  ) {
    throw new Error("invalid tenant");
  }
  if (
    !Number.isSafeInteger(pack.chainLength) ||
    pack.chainLength <= 0 ||
    pack.chainLength > MAX_PACK_CHAIN_LENGTH ||
    !Array.isArray(pack.receipts) ||
    pack.receipts.length !== pack.chainLength
  ) {
    throw new Error("invalid chain length");
  }

  let expectedPrevHash = null;
  for (let index = 0; index < pack.receipts.length; index += 1) {
    const receipt = pack.receipts[index];
    if (
      !isRecord(receipt) ||
      receipt.v !== 1 ||
      receipt.seq !== index ||
      !isBoundedString(receipt.hash, 1024) ||
      (receipt.prevHash !== null && !isBoundedString(receipt.prevHash, 1024)) ||
      !isRecord(receipt.raw) ||
      receipt.raw.prevHash !== receipt.prevHash ||
      receipt.prevHash !== expectedPrevHash ||
      typeof receipt.redacted !== "boolean" ||
      !isRecord(receipt.anchor) ||
      receipt.anchor.length !== index + 1 ||
      !isBoundedString(receipt.anchor.tipHash, 1024)
    ) {
      throw new Error("invalid receipt sequence");
    }
    expectedPrevHash = receipt.hash;
  }
}

/** Verify every receipt in a complete pack. Deterministic order: receipts are checked as given. */
export async function verifyPack(pack) {
  assertCompletePack(pack);
  const results = [];
  for (const receipt of pack.receipts) {
    results.push(await verifyReceipt(receipt, pack.anchorAuth, pack.tenantId));
  }
  const failed = results.filter((r) => r.overall === "FAIL");
  return { results, ok: failed.length === 0, failedCount: failed.length };
}

function legendFor(leg) {
  if (leg === "na") return "not applicable (payload redacted)";
  if (leg === "not-available")
    return "not available (unsigned or no pinned key)";
  return leg;
}

async function runCli(argv) {
  const path = argv[2];
  if (path === undefined) {
    process.stderr.write(
      "usage: node standalone-verifier.mjs <evidence-pack-receipts.json>\n",
    );
    return 2;
  }
  let verification;
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(path, "utf8");
    verification = await verifyPack(JSON.parse(raw));
  } catch {
    process.stdout.write("FAIL — evidence pack is incomplete or malformed.\n");
    return 1;
  }
  const { results, ok, failedCount } = verification;
  for (const r of results) {
    process.stdout.write(
      `row ${String(r.seq)}: link=${legendFor(r.link)} anchor-equality=${legendFor(r.anchorEquality)} signature=${legendFor(r.signature)} -> ${r.overall}\n`,
    );
  }
  process.stdout.write(
    ok
      ? `PASS — all ${String(results.length)} row(s) verified from raw material.\n`
      : `FAIL — ${String(failedCount)} of ${String(results.length)} row(s) failed verification.\n`,
  );
  return ok ? 0 : 1;
}

/** A hidden self-test mode: canonicalize each element of a JSON array (stdout: a JSON array of
 *  strings). SOLELY for the golden drift-guard test — never documented to end users. */
async function runSelfTestCanonicalize(argv) {
  const fs = await import("node:fs/promises");
  const corpus = JSON.parse(await fs.readFile(argv[3], "utf8"));
  process.stdout.write(JSON.stringify(corpus.map(canonicalize)));
  return 0;
}

// Only run as a CLI when executed directly (not when imported/spawned for testing internals).
if (import.meta.url === `file://${process.argv[1]}`) {
  const code =
    process.argv[2] === "--self-test-canonicalize"
      ? await runSelfTestCanonicalize(process.argv)
      : await runCli(process.argv);
  process.exitCode = code;
}
