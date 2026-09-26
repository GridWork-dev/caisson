// The signing-primitive poke's checkable claims, now that it drives the REAL package through
// `@caisson-sh/signing-primitive/browser` (ADR-0396) and the hand-ported mirror
// (signing-primitive-logic.ts) is deleted. The verify/countersign parity suite that used to live here
// is gone because there is no second implementation left to compare against — the browser entry runs
// the same `@noble/ed25519` primitive the server does, and its one genuine twin (the async
// messageImprint check) is pinned inside the package, next to the code it pins.
//
// What remains is what only this file can assert:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build (a bundler
//      SUBSTITUTES node builtins rather than failing on them).
//   2. The embedded sample IS the shipped golden — the honest-artifact floor (ADR-0082). A demo that
//      verifies a manifest nobody ships would be a lie that still shows a green verdict.
//   3. The tamper affordances really flip the real verdict.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";
import {
  Ed25519Signer,
  StubTimestampAuthority,
  signEvidencePack,
  timestampCountersignsSignature,
} from "@caisson-sh/signing-primitive";
import {
  ED25519_PUBLIC_BYTES,
  ED25519_SIGNATURE_BYTES,
  evidenceSignablePayload,
  hexToBytes,
  verifyEvidenceSignature,
} from "@caisson-sh/signing-primitive/browser";

import {
  FOREIGN_PUBLIC_KEY,
  SAMPLE_MANIFEST,
  SAMPLE_SIGNATURE,
  SAMPLE_TIMESTAMPED_AT,
  SAMPLE_TSA_AUTHORITY,
  flipTipByte,
  sampleCountersign,
  withTamperedTip,
} from "./signing-primitive-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "signing-primitive-poke.tsx");
const PACKAGE_SRC = join(WORKSPACE_ROOT, "packages/signing-primitive/src");

// The fixed per-tenant test identity that produced the golden (sign.test.ts TENANT_SEED / KEY_ID).
const TENANT_SEED = hexToBytes("42".repeat(32));
const TENANT_KEY_ID = "tenant-acme-prod/evidence-signing/v1";

const goldenManifest = JSON.parse(
  readFileSync(
    join(PACKAGE_SRC, "__golden__/evidence-pack.manifest.json"),
    "utf8",
  ),
) as unknown as typeof SAMPLE_MANIFEST;

const goldenSignatureHex = readFileSync(
  join(PACKAGE_SRC, "__golden__/signed-manifest.sig"),
  "utf8",
).trim();

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("no app module in the walked client graph uses a node global", () => {
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }).filter(
        (offender) => offender.file.startsWith("apps/site/"),
      ),
    ).toEqual([]);
  });

  test("the walk really crossed into the package's browser entry, never sign.ts", () => {
    expect(walk.files).toContain("packages/signing-primitive/src/portable.ts");
    expect(walk.files).not.toContain("packages/signing-primitive/src/sign.ts");
    expect(walk.files).not.toContain(
      "packages/signing-primitive/src/ph-signer.ts",
    );
  });

  test("positive control: the package's `.` barrel DOES report node builtins", () => {
    // If this ever comes back empty the walker has gone blind and the assertions above are vacuous.
    const barrel = nodeBuiltinTaint(join(PACKAGE_SRC, "index.ts"), {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(barrel.offenders.some((o) => o.file.endsWith("src/sign.ts"))).toBe(
      true,
    );
  });
});

describe("the embedded sample IS the shipped golden (honest-artifact floor)", () => {
  test("SAMPLE_MANIFEST deep-equals the real __golden__/evidence-pack.manifest.json", () => {
    expect(SAMPLE_MANIFEST).toEqual(goldenManifest);
  });

  test("SAMPLE_SIGNATURE reproduces the golden .sig, key, and keyId exactly", async () => {
    const real = await signEvidencePack(
      new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED),
      goldenManifest,
    );
    expect(SAMPLE_SIGNATURE.signature).toBe(goldenSignatureHex);
    expect(SAMPLE_SIGNATURE.signature).toBe(real.signature);
    expect(SAMPLE_SIGNATURE.publicKey).toBe(real.publicKey);
    expect(SAMPLE_SIGNATURE.keyId).toBe(real.keyId);
    expect(SAMPLE_SIGNATURE.signature).toHaveLength(
      ED25519_SIGNATURE_BYTES * 2,
    );
    expect(SAMPLE_SIGNATURE.publicKey).toHaveLength(ED25519_PUBLIC_BYTES * 2);
  });

  test("the payload the poke renders a byte count for is the real signable payload", () => {
    expect(
      new TextDecoder().decode(evidenceSignablePayload(SAMPLE_MANIFEST)),
    ).toBe(new TextDecoder().decode(evidenceSignablePayload(goldenManifest)));
  });
});

describe("the tamper affordances flip the real verdict", () => {
  test("the pristine sample verifies", async () => {
    expect(
      await verifyEvidenceSignature(SAMPLE_MANIFEST, SAMPLE_SIGNATURE),
    ).toBe(true);
  });

  test("one flipped chain-tip byte fails — and changes exactly one byte", async () => {
    const tampered = withTamperedTip(SAMPLE_MANIFEST);
    expect(await verifyEvidenceSignature(tampered, SAMPLE_SIGNATURE)).toBe(
      false,
    );
    expect(flipTipByte("0a1b2c3d")).toBe("0b1b2c3d");
    const original = SAMPLE_MANIFEST.chainAnchor.tipHash;
    const flipped = tampered.chainAnchor.tipHash;
    expect(flipped).toHaveLength(original.length);
    const differing = [...original].filter(
      (char, i) => char !== flipped[i],
    ).length;
    expect(differing).toBeGreaterThan(0);
    expect(differing).toBeLessThanOrEqual(2); // at most one byte = two hex chars
  });

  test("swapping the verifying key fails", async () => {
    expect(
      await verifyEvidenceSignature(SAMPLE_MANIFEST, {
        ...SAMPLE_SIGNATURE,
        publicKey: FOREIGN_PUBLIC_KEY,
      }),
    ).toBe(false);
  });
});

describe("the RFC-3161 receipt is the package's real test double", () => {
  test("sampleCountersign deep-equals the package's own StubTimestampAuthority output", async () => {
    const real = await new StubTimestampAuthority({
      authority: SAMPLE_TSA_AUTHORITY,
      now: new Date(SAMPLE_TIMESTAMPED_AT),
    }).countersign(hexToBytes(SAMPLE_SIGNATURE.signature));
    expect(await sampleCountersign(SAMPLE_SIGNATURE)).toEqual(real);
    expect(real.messageImprint).toHaveLength(64); // sha256 hex
  });

  test("the receipt countersigns THIS signature under the node verifier too", async () => {
    const token = await sampleCountersign(SAMPLE_SIGNATURE);
    expect(timestampCountersignsSignature(token, SAMPLE_SIGNATURE)).toBe(true);
    // The imprint binds the signature bytes, so a swapped verifying key leaves it intact…
    expect(
      timestampCountersignsSignature(token, {
        ...SAMPLE_SIGNATURE,
        publicKey: FOREIGN_PUBLIC_KEY,
      }),
    ).toBe(true);
    // …while a different signature does not.
    expect(
      timestampCountersignsSignature(token, {
        ...SAMPLE_SIGNATURE,
        signature: "ab".repeat(64),
      }),
    ).toBe(false);
  });
});
