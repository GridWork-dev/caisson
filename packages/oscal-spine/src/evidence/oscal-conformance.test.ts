// src/evidence/oscal-conformance.test.ts — ADR-0181 (framework export) + ADR-0179 (v1.2.2 binding).
//
// The three built frameworks (SOC2-TSC / HIPAA-Security / EU-AI-Act) each get a schema-conformant OSCAL
// export NOW: a deterministic golden fixture per framework (src/__golden__/oscal-<fw>.bundle.json) plus a
// CI-SAFE JSON-schema-SHAPE assertion (UUID discipline, required metadata, resolvable import-ap + shipped
// back-matter AP resource, related-observation referential integrity). This is the credless/Java-less
// conformance floor that runs on every CI leg; the ground-truth `oscal-cli validate` round-trip
// (oscal-export-xml.test.ts) skips when the external tool is absent. NEW collectors (HIPAA field-crypto,
// EU-AI-Act risk-register) are represented as stable manifest inputs so this package's conformance
// suite remains independent of the commercial collectors that can feed those inputs at runtime.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { matchGolden } from "@caisson-sh/testing";
import { canonicalize, type JsonValue } from "@caisson-sh/kernel";
import type {
  OscalEvidencePackManifest,
  OscalManifestEvidenceItem,
} from "../contracts.ts";
import { toOscalAssessmentPlan } from "./oscal-assessment-plan.ts";
import { OSCAL_VERSION } from "../contracts.ts";
import {
  toOscalBundle,
  type OscalExportBundle,
  type OscalExportOptions,
} from "./oscal-export.ts";

const PKG_SRC_META = new URL("../index.ts", import.meta.url).href;
const TIP = "0a1b2c3d".repeat(8);
const GENESIS = "9f8e7d6c".repeat(8);
const NOW = new Date("2026-06-28T00:00:00.000Z");
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function req<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to be defined`);
  return value;
}

/** A deterministic UUID source (a counter) — makes each export byte-stable for golden fixturing. */
function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

/**
 * SHA-256 (lowercase hex) of a framework's canonicalized Assessment-Plan bytes — the integrity value the
 * bundled SAR binds into `rlink.hashes[]` (ADR-0231). Uses a fresh counter so it matches the standalone AP
 * golden (`toOscalAssessmentPlan` with a fresh seam), keeping the two goldens cross-consistent.
 */
function apSha256(fw: FrameworkCase): string {
  let n = 0;
  const ap = toOscalAssessmentPlan(
    { id: fw.id, title: fw.title, version: "2024.1" },
    {
      now: NOW,
      newId: () =>
        `00000000-0000-4000-8000-${String((n += 1)).padStart(12, "0")}`,
    },
  );
  return createHash("sha256")
    .update(canonicalize(JSON.parse(JSON.stringify(ap)) as JsonValue), "utf8")
    .digest("hex");
}

/** Export options for the bundled (ADR-0231) SAR — relative AP `rlink` + SHA-256 `hashes[]`. */
function bundleOptions(fw: FrameworkCase): OscalExportOptions {
  return {
    now: NOW,
    newId: counterIds(),
    assessmentPlan: {
      rlinkHref: `./assessment-plan/${fw.id}.json`,
      sha256: apSha256(fw),
    },
  };
}

/** A manifest control-input block. */
interface ControlInput {
  readonly controlId: string;
  readonly title: string;
  readonly family: string;
  readonly statement: string;
  readonly crosswalk: readonly never[];
  readonly evidence: readonly OscalManifestEvidenceItem[];
  readonly readiness: "ready" | "gap";
}

/** HIPAA §164.312 input as emitted by the field-crypto collector at the package boundary. */
function phiEncryptionControl(): ControlInput {
  return {
    controlId: "DATA-PROTECTION.PHI-ENCRYPTION",
    title: "PHI encryption at rest",
    family: "Technical Safeguards",
    statement:
      "Electronic PHI is encrypted at rest with per-tenant authenticated (AES-256-GCM) field encryption.",
    crosswalk: [],
    evidence: [
      {
        collectorId: "substrate.field-crypto-policy",
        title: "PHI field encryption posture",
        summary:
          "all 2 PHI fields are encrypted at rest (AES-256-GCM field-crypto envelope)",
        status: "pass",
        facts: { encryptedFields: 2, plaintextFields: 0 },
        manualSlots: [],
      },
    ],
    readiness: "ready",
  };
}

/** EU-AI-Act Art. 9 input as emitted by the risk-register collector at the package boundary. */
function aiRiskRegisterControl(): ControlInput {
  return {
    controlId: "RISK-MANAGEMENT.AI-REGISTER",
    title: "AI risk register maintained",
    family: "Risk Management",
    statement:
      "A risk register enumerates each AI lane's risks; every entry is assessed with a treatment plan on record over the lifecycle.",
    crosswalk: [],
    evidence: [
      {
        collectorId: "substrate.ai-risk-register",
        title: "AI risk register posture",
        summary: "all 2 AI risks are assessed with a treatment plan on record",
        status: "pass",
        facts: { assessedRisks: 2, untreatedRisks: 0 },
        manualSlots: [],
      },
    ],
    readiness: "ready",
  };
}

/**
 * Build a manifest for a framework: a ready audit control + a gap RLS control, plus any framework-specific
 * extra controls (HIPAA → PHI field-crypto evidence, EU-AI-Act → risk-register evidence). Summary counts
 * are derived from the assembled controls so extras never desync the honesty invariants.
 */
function manifestFor(
  id: string,
  title: string,
  readyControlId: string,
  gapControlId: string,
  extra: readonly ControlInput[] = [],
): OscalEvidencePackManifest {
  const controls: readonly ControlInput[] = [
    {
      controlId: readyControlId,
      title: "Immutable audit log",
      family: "Audit & Accountability",
      statement:
        "Security-relevant events are written to an append-only, hash-chained log anchored in WORM storage.",
      crosswalk: [],
      evidence: [
        {
          collectorId: "substrate.chain-verify",
          title: "Audit chain verifies",
          summary: "the 128-entry chain verifies against its anchor",
          status: "pass",
          facts: { entryCount: 128, valid: true },
          manualSlots: [],
        },
      ],
      readiness: "ready",
    },
    {
      controlId: gapControlId,
      title: "Row-level tenant isolation",
      family: "Access Control",
      statement:
        "Every tenant-scoped table enforces FORCE row-level security so no role can read another tenant's rows.",
      crosswalk: [],
      evidence: [
        {
          collectorId: "substrate.rls-force",
          title: "FORCE RLS posture",
          summary: "one tenant table is missing a FORCE RLS policy",
          status: "flagged",
          reason:
            'table "legacy_export" has RLS enabled but not FORCEd; a table owner could bypass the policy',
          facts: { tablesMissingForce: 1 },
          manualSlots: [],
        },
      ],
      readiness: "gap",
    },
    ...extra,
  ];
  const controlsReady = controls.filter((c) => c.readiness === "ready").length;
  const controlsWithGaps = controls.filter((c) => c.readiness === "gap").length;
  const totalEvidenceItems = controls.reduce(
    (n, c) => n + c.evidence.length,
    0,
  );
  const gapWord = controlsWithGaps === 1 ? "gap" : "gaps";
  const tail =
    controlsWithGaps === 1 ? "a remediation item" : "remediation items";
  return {
    formatVersion: "2",
    crosswalkRollup: { cells: [] },
    tenantId: "tenant-acme-prod",
    framework: { id, title, version: "2024.1" },
    chainAnchor: { length: 128, tipHash: TIP, genesisHash: GENESIS },
    controls,
    summary: {
      totalControls: controls.length,
      controlsReady,
      controlsWithGaps,
      totalEvidenceItems,
      posture: `${String(controlsReady)} of ${String(controls.length)} controls evidence-ready; ${String(controlsWithGaps)} ${gapWord} recorded as ${tail}.`,
    },
  };
}

interface FrameworkCase {
  readonly slug: string;
  readonly id: string;
  readonly title: string;
  readonly ready: string;
  readonly gap: string;
  /** Framework-specific extra controls (the new ADR-0181 collectors), appended to the base two. */
  readonly extra?: readonly ControlInput[];
}

const FRAMEWORKS: readonly FrameworkCase[] = [
  {
    slug: "soc2",
    id: "soc2-tsc",
    title: "SOC 2 — Trust Services Criteria",
    ready: "AUDIT.IMMUTABLE-LOG",
    gap: "DATA-PROTECTION.TENANT-ISOLATION",
  },
  {
    slug: "hipaa",
    id: "hipaa-security",
    title: "HIPAA Security Rule",
    ready: "AUDIT.IMMUTABLE-LOG",
    gap: "ACCESS-CONTROL.PHI-ISOLATION",
    extra: [phiEncryptionControl()],
  },
  {
    slug: "eu-ai-act",
    id: "eu-ai-act",
    title: "EU AI Act — High-Risk Obligations",
    ready: "AUDIT.IMMUTABLE-LOG",
    gap: "RISK-MANAGEMENT.AI-LIFECYCLE",
    extra: [aiRiskRegisterControl()],
  },
];

/**
 * CI-safe OSCAL JSON-schema-SHAPE assertion — the required-structure floor `oscal-cli validate` proves
 * end-to-end. Checks UUID discipline (format + uniqueness), required metadata (incl. `oscal-version` at
 * the locked value), a resolvable `import-ap` backed by a shipped back-matter AP resource, non-core
 * props carrying an `ns`, and related-observation referential integrity.
 */
function assertOscalShape(bundle: OscalExportBundle): void {
  const seen = new Set<string>();
  const uuid = (value: string, where: string): void => {
    expect(value, `${where} uuid`).toMatch(UUID_RE);
    expect(seen.has(value), `${where} uuid must be unique`).toBe(false);
    seen.add(value);
  };
  const assertMetadata = (m: {
    title: string;
    "last-modified": string;
    version: string;
    "oscal-version": string;
    props?: readonly { name: string; ns?: string }[];
  }): void => {
    expect(m.title.length).toBeGreaterThan(0);
    expect(m["last-modified"]).toMatch(ISO_RE);
    expect(m.version.length).toBeGreaterThan(0);
    expect(m["oscal-version"]).toBe(OSCAL_VERSION);
    for (const p of m.props ?? []) {
      // Non-core Caisson props MUST declare an ns (research pitfall #4).
      expect(p.ns, `prop ${p.name} ns`).toBe("https://caisson.sh/ns/oscal");
    }
  };

  // --- SAR ---
  const sar = bundle.assessmentResults["assessment-results"];
  uuid(sar.uuid, "SAR root");
  assertMetadata(sar.metadata);

  // import-ap resolves to a shipped back-matter AP resource (ADR-0179) — never a dangling fragment.
  const href = sar["import-ap"].href;
  expect(href.length).toBeGreaterThan(0);
  expect(href.startsWith("#")).toBe(true);
  const resources = req(sar["back-matter"], "SAR back-matter").resources;
  expect(resources.length).toBeGreaterThan(0);
  const ap = req(
    resources.find((r) => `#${r.uuid}` === href),
    "resolvable import-ap resource",
  );
  uuid(ap.uuid, "AP resource");
  // ADR-0231: the AP rlink is a RELATIVE in-bundle path with a SHA-256 hashes[] binding, not a served URL.
  const apRlink = req(ap.rlinks[0], "AP rlink");
  expect(apRlink.href.startsWith("./")).toBe(true);
  expect(apRlink.href).not.toMatch(/^https?:\/\//);
  const apHash = req(apRlink.hashes?.[0], "AP rlink hash");
  expect(apHash.algorithm).toBe("SHA-256");
  expect(apHash.value).toMatch(/^[0-9a-f]{64}$/);

  expect(sar.results.length).toBeGreaterThan(0);
  for (const result of sar.results) {
    uuid(result.uuid, "result");
    const obsUuids = new Set<string>();
    for (const obs of result.observations) {
      uuid(obs.uuid, "observation");
      obsUuids.add(obs.uuid);
      expect(obs.methods.length).toBeGreaterThan(0);
    }
    for (const finding of result.findings) {
      uuid(finding.uuid, "finding");
      expect(finding.target["target-id"].length).toBeGreaterThan(0);
      for (const rel of finding["related-observations"]) {
        expect(obsUuids.has(rel["observation-uuid"])).toBe(true);
      }
    }
  }

  // --- POA&M ---
  const poam =
    bundle.planOfActionAndMilestones["plan-of-action-and-milestones"];
  uuid(poam.uuid, "POA&M root");
  assertMetadata(poam.metadata);
  expect(poam["system-id"].id.length).toBeGreaterThan(0);
  const poamObs = new Set((poam.observations ?? []).map((o) => o.uuid));
  for (const o of poam.observations ?? []) uuid(o.uuid, "poam observation");
  for (const item of poam["poam-items"]) {
    uuid(item.uuid, "poam-item");
    for (const rel of item["related-observations"]) {
      expect(poamObs.has(rel["observation-uuid"])).toBe(true);
    }
  }
}

describe("OSCAL framework conformance — v1.2.2, all three frameworks (ADR-0179/0181)", () => {
  for (const fw of FRAMEWORKS) {
    test(`${fw.id}: shape-conformant SAR + POA&M at the locked version`, () => {
      const bundle = toOscalBundle(
        manifestFor(fw.id, fw.title, fw.ready, fw.gap, fw.extra),
        bundleOptions(fw),
      );
      expect(
        bundle.assessmentResults["assessment-results"].metadata[
          "oscal-version"
        ],
      ).toBe(OSCAL_VERSION);
      assertOscalShape(bundle);
    });

    test(`${fw.id}: deterministic golden bundle`, () => {
      const bundle = toOscalBundle(
        manifestFor(fw.id, fw.title, fw.ready, fw.gap, fw.extra),
        bundleOptions(fw),
      );
      matchGolden(PKG_SRC_META, `oscal-${fw.slug}.bundle`, bundle);
    });
  }
});
