// src/evidence/oscal-bundle.test.ts — OSCAL signed evidence-bundle assembler (ADR-0231, Tasks 4-5).
//
// Proves the two load-bearing properties of the bundle: (1) the SAR's Assessment-Plan `rlink.href` is a
// RELATIVE in-bundle path and its `hashes[0].value` is the SHA-256 of the exact bundled AP bytes (the
// integrity binding — Task 4); (2) the detached signature reused from `signEvidencePack()` round-trips
// verify=true over the bundled manifest and rejects a tampered one (Task 5). Deterministic under the same
// injected clock + id seam the SAR/POA&M mapper uses.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { canonicalize, type JsonValue } from "@caisson-sh/kernel";
import {
  parseEvidencePackManifest,
  type EvidencePackManifest,
} from "@caisson-sh/compliance-core";
import {
  Ed25519Signer,
  verifyEvidenceSignature,
} from "@caisson-sh/signing-primitive";
import { assembleOscalEvidenceBundle } from "./oscal-bundle.ts";

const TENANT_SEED = Uint8Array.from(Buffer.from("42".repeat(32), "hex"));
const TENANT_KEY_ID = "tenant-acme-prod/evidence-signing/v1";
const NOW = new Date("2026-06-28T00:00:00.000Z");
const AP_PATH = "./assessment-plan/soc2-tsc.json";
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** noUncheckedIndexedAccess guard — assert a looked-up value is present. */
function req<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to be defined`);
  return value;
}

/** The golden canonical manifest (soc2-tsc: one ready + one gap control), parsed + validated. */
function goldenManifest(): EvidencePackManifest {
  const raw = JSON.parse(
    readFileSync(
      new URL("../__golden__/evidence-pack.manifest.json", import.meta.url),
      "utf8",
    ),
  ) as unknown;
  return parseEvidencePackManifest(raw);
}

/** A deterministic UUID source (a counter) shared across the AP/SAR/POA&M so ids stay globally unique. */
function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function signer(): Ed25519Signer {
  return new Ed25519Signer(TENANT_KEY_ID, TENANT_SEED);
}

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

describe("assembleOscalEvidenceBundle — layout + relative rlink + hashes (ADR-0231 Task 4)", () => {
  test("lays out the sibling-directory bundle at the locked relative paths", async () => {
    const bundle = await assembleOscalEvidenceBundle(
      goldenManifest(),
      signer(),
      {
        now: NOW,
        newId: counterIds(),
      },
    );
    expect(Object.keys(bundle.files).sort()).toEqual([
      "./assessment-plan/soc2-tsc.json",
      "./manifest.json",
      "./manifest.sig",
      "./poam.json",
      "./sar.json",
    ]);
  });

  test("rewrites the SAR back-matter rlink to the RELATIVE AP path + SHA-256 hashes[]", async () => {
    const bundle = await assembleOscalEvidenceBundle(
      goldenManifest(),
      signer(),
      {
        now: NOW,
        newId: counterIds(),
      },
    );
    const sar = bundle.assessmentResults["assessment-results"];
    const resource = req(
      req(sar["back-matter"], "back-matter").resources[0],
      "ap resource",
    );
    const rlink = req(resource.rlinks[0], "ap rlink");

    // Relative, not the dead absolute caisson.sh URL.
    expect(rlink.href).toBe(AP_PATH);
    expect(rlink.href.startsWith("./")).toBe(true);
    expect(rlink.href).not.toMatch(/^https?:\/\//);
    // import-ap still resolves to the in-document back-matter resource fragment.
    expect(sar["import-ap"].href).toBe(`#${resource.uuid}`);

    // hashes[] binds the exact bundled AP bytes.
    const hash = req(rlink.hashes?.[0], "ap hash");
    expect(hash.algorithm).toBe("SHA-256");
    expect(hash.value).toMatch(SHA256_HEX);
    const apBytes = req(bundle.files[AP_PATH], "bundled AP bytes");
    const recomputed = createHash("sha256")
      .update(apBytes, "utf8")
      .digest("hex");
    expect(hash.value).toBe(recomputed);
    expect(bundle.assessmentPlanSha256).toBe(recomputed);
  });

  test("the bundled AP bytes are the canonicalized assessment-plan document", async () => {
    const bundle = await assembleOscalEvidenceBundle(
      goldenManifest(),
      signer(),
      {
        now: NOW,
        newId: counterIds(),
      },
    );
    expect(req(bundle.files[AP_PATH], "AP bytes")).toBe(
      canonicalize(asJson(bundle.assessmentPlan)),
    );
    // No dead absolute URL anywhere in the emitted bundle bytes.
    for (const bytes of Object.values(bundle.files)) {
      expect(bytes).not.toContain("caisson.sh/oscal/assessment-plan");
    }
  });

  test("is deterministic under the injected clock + id seam", async () => {
    const a = await assembleOscalEvidenceBundle(goldenManifest(), signer(), {
      now: NOW,
      newId: counterIds(),
    });
    const b = await assembleOscalEvidenceBundle(goldenManifest(), signer(), {
      now: NOW,
      newId: counterIds(),
    });
    expect(a.files).toEqual(b.files);
  });
});

describe("assembleOscalEvidenceBundle — signature round-trip (ADR-0231 Task 5)", () => {
  test("the bundled detached signature verifies over the bundled manifest", async () => {
    const bundle = await assembleOscalEvidenceBundle(
      goldenManifest(),
      signer(),
      {
        now: NOW,
        newId: counterIds(),
      },
    );
    const manifest = parseEvidencePackManifest(
      JSON.parse(req(bundle.files["./manifest.json"], "manifest bytes")),
    );
    expect(await verifyEvidenceSignature(manifest, bundle.signature)).toBe(
      true,
    );
  });

  test("a tampered manifest fails verification (fail-closed)", async () => {
    const bundle = await assembleOscalEvidenceBundle(
      goldenManifest(),
      signer(),
      {
        now: NOW,
        newId: counterIds(),
      },
    );
    const tampered = parseEvidencePackManifest(
      JSON.parse(req(bundle.files["./manifest.json"], "manifest bytes")),
    );
    // Flip the first hex nibble of the signed tip hash — the signature must no longer verify.
    const tip = tampered.chainAnchor.tipHash;
    const forged: EvidencePackManifest = {
      ...tampered,
      chainAnchor: {
        ...tampered.chainAnchor,
        tipHash: `${tip[0] === "0" ? "1" : "0"}${tip.slice(1)}`,
      },
    };
    expect(await verifyEvidenceSignature(forged, bundle.signature)).toBe(false);
  });
});
