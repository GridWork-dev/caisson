// The field-crypto poke's checkable claims, now that it drives the REAL package through
// `@caisson-sh/field-crypto/browser` (ADR-0396) and the hand-ported mirror (field-crypto-logic.ts) is
// deleted. The parity suite that used to live here moved INTO the package
// (packages/field-crypto/src/browser-parity.test.ts) along with the implementation it pins — there is
// nothing left here to compare a copy against. What remains is what only this file can assert:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build (a
//      bundler SUBSTITUTES node builtins rather than failing on them).
//   2. The demo composition genuinely runs the shipped primitive end to end: an envelope sealed here
//      opens under the REAL node `decryptField`, and only for the tenant that sealed it.
//   3. The seal/open/rotate behaviors the UI narrates are true.
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson-sh/testing/module-graph";
import {
  DerivedKeyProvider,
  decryptField,
  derivedContext,
  encryptField,
  parseEnvelope,
} from "@caisson-sh/field-crypto";
import {
  NONCE_BYTES,
  TAG_BYTES,
  MAX_KEY_VERSION,
  nextKeyVersion,
} from "@caisson-sh/field-crypto/browser";

import {
  DEMO_COLUMN_CONTEXT,
  DEMO_MASTER_KEY,
  DEMO_ROW_ID,
  DEMO_SALT,
  bytesToHex,
  envelopeSegments,
  openEnvelope,
  sealEnvelope,
} from "./field-crypto-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "field-crypto-poke.tsx");

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

  test("the walk really crossed into the package's browser entry, never its node half", () => {
    expect(walk.files).toContain("packages/field-crypto/src/portable.ts");
    for (const excluded of [
      "packages/field-crypto/src/cipher.ts",
      "packages/field-crypto/src/derive.ts",
      "packages/field-crypto/src/kms.ts",
      "packages/field-crypto/src/column.ts",
    ]) {
      expect(walk.files).not.toContain(excluded);
    }
  });

  test("positive control: the package's `.` barrel DOES report node builtins", () => {
    // If this ever comes back empty the walker has gone blind and the assertions above are vacuous.
    const barrel = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/field-crypto/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(barrel.offenders.length).toBeGreaterThan(0);
  });
});

describe("the demo composition runs the shipped row-bound path, not a lookalike", () => {
  const provider = new DerivedKeyProvider(
    Buffer.from(DEMO_MASTER_KEY),
    Buffer.from(DEMO_SALT),
  );
  const tenantA = derivedContext(provider, "tenant-a");
  const tenantB = derivedContext(provider, "tenant-b");

  test("an envelope sealed in the poke opens under the real decryptField", async () => {
    const sealed = await sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "123-45-6789",
    });
    expect(
      decryptField(tenantA, DEMO_COLUMN_CONTEXT, DEMO_ROW_ID, sealed.wire),
    ).toBe("123-45-6789");
    // The isolation claim the UI makes, checked against the REAL server-side opener.
    expect(() =>
      decryptField(tenantB, DEMO_COLUMN_CONTEXT, DEMO_ROW_ID, sealed.wire),
    ).toThrow();
    // …and the sample master/salt really are the package's KAT vectors, so the demo's derived key is
    // the golden one — a different fixture would fail the decrypt above, not just look different.
    expect(parseEnvelope(sealed.wire).keyVersion).toBe(1);
  });

  test("a real encryptField envelope opens in the poke, and only as the sealing tenant", async () => {
    const wire = encryptField(
      tenantA,
      DEMO_COLUMN_CONTEXT,
      DEMO_ROW_ID,
      "on-device secret",
    );
    const opened = await openEnvelope({ wire, asTenant: "tenant-a" });
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.plaintext).toBe("on-device secret");
    expect(await openEnvelope({ wire, asTenant: "tenant-b" })).toEqual({
      ok: false,
      reason: "auth",
    });
  });
});

describe("the seal / open / rotate behaviors the UI narrates", () => {
  test("every seal draws a fresh package-owned nonce", async () => {
    const input = {
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "same",
    } as const;
    const first = await sealEnvelope(input);
    const second = await sealEnvelope(input);
    expect(first.wire).not.toBe(second.wire);
    expect(parseEnvelope(first.wire).nonce).toHaveLength(NONCE_BYTES);
    expect(bytesToHex(parseEnvelope(first.wire).nonce)).not.toBe(
      bytesToHex(parseEnvelope(second.wire).nonce),
    );
  });

  test("an envelope sealed under an old key version still opens after a rotate", async () => {
    const v1 = await sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "old",
    });
    expect(nextKeyVersion(1)).toBe(2);
    const v2 = await sealEnvelope({
      tenant: "tenant-a",
      keyVersion: nextKeyVersion(1),
      plaintext: "new",
    });
    expect(parseEnvelope(v2.wire).keyVersion).toBe(2);

    const openedOld = await openEnvelope({
      wire: v1.wire,
      asTenant: "tenant-a",
    });
    expect(openedOld.ok).toBe(true);
    if (openedOld.ok) {
      expect(openedOld.plaintext).toBe("old");
      expect(openedOld.keyVersion).toBe(1);
    }
  });

  test("the rotate control is bounded by the envelope's u16 key-version field", () => {
    expect(() => nextKeyVersion(MAX_KEY_VERSION)).toThrow();
  });

  test("a malformed wire fails closed as { ok: false, reason: 'malformed' }", async () => {
    expect(
      await openEnvelope({ wire: "not-a-real-envelope", asTenant: "tenant-a" }),
    ).toEqual({ ok: false, reason: "malformed" });
  });

  test("envelopeSegments renders the real on-disk layout with the package's field names", async () => {
    const sealed = await sealEnvelope({
      tenant: "tenant-a",
      keyVersion: 1,
      plaintext: "seg",
    });
    const segments = envelopeSegments(sealed.wire);
    expect(segments.map((s) => s.label)).toEqual([
      "ver",
      "alg",
      "key_version",
      "nonce",
      "ciphertext",
      "tag",
    ]);
    expect(segments.find((s) => s.label === "nonce")?.byteLength).toBe(
      NONCE_BYTES,
    );
    expect(segments.find((s) => s.label === "tag")?.byteLength).toBe(TAG_BYTES);
    // The strip is a view of the SAME bytes the wire carries, not a re-render of the inputs.
    expect(segments.find((s) => s.label === "tag")?.hex).toBe(
      bytesToHex(parseEnvelope(sealed.wire).tag),
    );
  });
});
