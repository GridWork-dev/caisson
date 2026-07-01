// src/evidence/oscal-export.test.ts — OSCAL export adapter (ADR-0058, T15).
//
// Seam-tested (no transport, no network, no golden): the adapter is a PURE deterministic mapping of
// the T13 evidence-pack manifest into OSCAL v1.1.3 SAR + POA&M bodies. The tests assert the OSCAL
// shape, the honest readiness→objective-status mapping (ready→satisfied, gap→not-satisfied + POA&M
// item), determinism under injected clock + id seam, the TM-K honesty floor (no compliant/certified),
// and fail-closed behaviour on a bad clock / malformed provenance.
import { describe, expect, test } from "bun:test";
import { canonicalize, ValidationError, type JsonValue } from "@caisson/kernel";
import {
  parseEvidencePackManifest,
  type EvidencePackManifest,
} from "./pack-format.ts";
import {
  OSCAL_VERSION,
  toOscalAssessmentResults,
  toOscalBundle,
  toOscalPlanOfActionAndMilestones,
  type OscalExportOptions,
} from "./oscal-export.ts";

const TENANT = "tenant-acme-prod";
const TIP = "0a1b2c3d".repeat(8);
const GENESIS = "9f8e7d6c".repeat(8);
const NOW = new Date("2026-06-28T00:00:00.000Z");
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** noUncheckedIndexedAccess guard — assert a looked-up element is present. */
function req<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`expected ${what} to be defined`);
  return value;
}

/** A deterministic UUID source (a counter) — makes the export byte-stable for these assertions. */
function counterIds(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

function det(overrides?: Partial<OscalExportOptions>): OscalExportOptions {
  return { now: NOW, newId: counterIds(), ...overrides };
}

/** A two-control pack: one READY (2 passing items), one GAP (1 flagged item). */
function fixtureManifest(): EvidencePackManifest {
  return parseEvidencePackManifest({
    formatVersion: "1",
    tenantId: TENANT,
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: { length: 128, tipHash: TIP, genesisHash: GENESIS },
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit & Accountability",
        statement:
          "Security-relevant events are written to an append-only, hash-chained log anchored in WORM storage.",
        crosswalk: [{ framework: "SOC2-TSC", reference: "CC7.2" }],
        evidence: [
          {
            collectorId: "substrate.chain-verify",
            title: "Audit chain verifies",
            summary: "the 128-entry chain verifies against its anchor",
            status: "pass",
            facts: { entryCount: 128, valid: true },
            manualSlots: [],
          },
          {
            collectorId: "substrate.worm-retention",
            title: "WORM retention floor met",
            summary: "locked artifact retained beyond the legal floor",
            status: "pass",
            facts: { meetsFloor: true },
            manualSlots: [
              {
                id: "retention-policy-pdf",
                label: "Signed records-retention policy (PDF)",
                required: false,
                filled: false,
              },
            ],
          },
        ],
        readiness: "ready",
      },
      {
        controlId: "DATA-PROTECTION.TENANT-ISOLATION",
        title: "Row-level tenant isolation",
        family: "Access Control",
        statement:
          "Every tenant-scoped table enforces FORCE row-level security so no role can read another tenant's rows.",
        crosswalk: [{ framework: "SOC2-TSC", reference: "CC6.1" }],
        evidence: [
          {
            collectorId: "substrate.rls-force",
            title: "FORCE RLS posture",
            summary: "one tenant table is missing a FORCE RLS policy",
            status: "flagged",
            reason:
              'table "legacy_export" has RLS enabled but not FORCEd; a table owner could bypass the policy',
            facts: { tablesMissingForce: 1, missing: ["legacy_export"] },
            manualSlots: [],
          },
        ],
        readiness: "gap",
      },
    ],
    summary: {
      totalControls: 2,
      controlsReady: 1,
      controlsWithGaps: 1,
      totalEvidenceItems: 3,
      posture:
        "1 of 2 controls evidence-ready; 1 gap recorded as a remediation item.",
    },
  });
}

/** An all-ready pack (no gaps) — the clean-export case. */
function cleanManifest(): EvidencePackManifest {
  return parseEvidencePackManifest({
    formatVersion: "1",
    tenantId: TENANT,
    framework: {
      id: "soc2-tsc",
      title: "SOC 2 — Trust Services Criteria",
      version: "2024.1",
    },
    chainAnchor: { length: 12, tipHash: TIP },
    controls: [
      {
        controlId: "AUDIT.IMMUTABLE-LOG",
        title: "Immutable audit log",
        family: "Audit & Accountability",
        statement: "Append-only, hash-chained, WORM-anchored audit log.",
        crosswalk: [],
        evidence: [
          {
            collectorId: "substrate.chain-verify",
            title: "Audit chain verifies",
            summary: "the chain verifies against its anchor",
            status: "pass",
            facts: { valid: true },
            manualSlots: [],
          },
        ],
        readiness: "ready",
      },
    ],
    summary: {
      totalControls: 1,
      controlsReady: 1,
      controlsWithGaps: 0,
      totalEvidenceItems: 1,
      posture: "1 of 1 controls evidence-ready; no gaps recorded.",
    },
  });
}

function asJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

describe("toOscalAssessmentResults — SAR mapping", () => {
  test("emits a wrapped assessment-results document with required metadata", () => {
    const doc = toOscalAssessmentResults(fixtureManifest(), det());
    const sar = doc["assessment-results"];
    expect(sar.uuid).toMatch(UUID_RE);
    expect(sar.metadata["oscal-version"]).toBe(OSCAL_VERSION);
    expect(sar.metadata["last-modified"]).toBe(NOW.toISOString());
    expect(sar.metadata.version).toBe("2024.1");
    expect(sar.metadata.title).toContain("Security Assessment Results");
    // ADR-0179: import-ap resolves to a shipped back-matter AP resource (not a bare dangling fragment).
    expect(sar["import-ap"].href).toMatch(/^#[0-9a-f-]{36}$/i);
    const resources = req(sar["back-matter"], "back-matter").resources;
    const apResource = req(resources[0], "ap resource");
    expect(`#${apResource.uuid}`).toBe(sar["import-ap"].href);
    expect(apResource.rlinks[0]?.href).toBe(
      "https://caisson.sh/oscal/assessment-plan/soc2-tsc.json",
    );
  });

  test("one finding per control with objective status derived from readiness", () => {
    const sar = toOscalAssessmentResults(fixtureManifest(), det())[
      "assessment-results"
    ];
    const result = req(sar.results[0], "result");
    expect(result["reviewed-controls"]["control-selections"][0]).toEqual({
      "include-all": {},
    });
    expect(result.findings).toHaveLength(2);

    const ready = req(
      result.findings.find(
        (f) => f.target["target-id"] === "AUDIT.IMMUTABLE-LOG",
      ),
      "ready finding",
    );
    expect(ready.target.status.state).toBe("satisfied");
    expect(ready.target.status.reason).toBeUndefined();

    const gap = req(
      result.findings.find(
        (f) => f.target["target-id"] === "DATA-PROTECTION.TENANT-ISOLATION",
      ),
      "gap finding",
    );
    expect(gap.target.status.state).toBe("not-satisfied");
    expect(gap.target.status.reason).toContain("substrate.rls-force");
  });

  test("one observation per evidence item, linked from its control's finding", () => {
    const sar = toOscalAssessmentResults(fixtureManifest(), det())[
      "assessment-results"
    ];
    const result = req(sar.results[0], "result");
    expect(result.observations).toHaveLength(3);
    for (const obs of result.observations) {
      expect(obs.methods).toEqual(["EXAMINE"]);
      expect(obs.collected).toBe(NOW.toISOString());
    }
    // Every related-observation reference resolves to a real observation uuid.
    const obsUuids = new Set(result.observations.map((o) => o.uuid));
    const referenced = result.findings.flatMap((f) =>
      f["related-observations"].map((r) => r["observation-uuid"]),
    );
    expect(referenced).toHaveLength(3);
    for (const ref of referenced) expect(obsUuids.has(ref)).toBe(true);
  });

  test("binds the doc to the WORM audit-chain tip via a metadata link", () => {
    const sar = toOscalAssessmentResults(fixtureManifest(), det())[
      "assessment-results"
    ];
    const link = req(req(sar.metadata.links, "links")[0], "anchor link");
    expect(link.href).toBe(`urn:caisson:audit-chain:${TIP}`);
    expect(link.rel).toBe("caisson-audit-chain-anchor");
  });

  test("records pack provenance + a custom import-ap when supplied", () => {
    const sha = "ab".repeat(32);
    const sar = toOscalAssessmentResults(
      fixtureManifest(),
      det({ packSha256: sha, assessmentPlanHref: "https://grc.example/ap/42" }),
    )["assessment-results"];
    expect(sar["import-ap"].href).toBe("https://grc.example/ap/42");
    const prop = req(
      req(sar.metadata.props, "props").find(
        (p) => p.name === "caisson-evidence-pack-sha256",
      ),
      "sha256 prop",
    );
    expect(prop.value).toBe(sha);
  });
});

describe("toOscalPlanOfActionAndMilestones — POA&M mapping", () => {
  test("one poam-item per GAP control, identifying the tenant", () => {
    const poam = toOscalPlanOfActionAndMilestones(fixtureManifest(), det())[
      "plan-of-action-and-milestones"
    ];
    expect(poam.uuid).toMatch(UUID_RE);
    expect(poam["system-id"].id).toBe(TENANT);
    expect(poam["poam-items"]).toHaveLength(1);
    const item = req(poam["poam-items"][0], "poam item");
    expect(item.title).toContain("DATA-PROTECTION.TENANT-ISOLATION");
    expect(item.description).toContain("Remediation required");
    // The flagged item surfaces as an observation referenced by the poam-item.
    expect(poam.observations).toHaveLength(1);
    const obs = req(req(poam.observations, "observations")[0], "observation");
    expect(item["related-observations"][0]?.["observation-uuid"]).toBe(
      obs.uuid,
    );
  });

  test("a clean pack yields zero poam-items and omits observations", () => {
    const poam = toOscalPlanOfActionAndMilestones(cleanManifest(), det())[
      "plan-of-action-and-milestones"
    ];
    expect(poam["poam-items"]).toHaveLength(0);
    expect(poam.observations).toBeUndefined();
  });

  test("a clean pack's SAR marks every control satisfied", () => {
    const sar = toOscalAssessmentResults(cleanManifest(), det())[
      "assessment-results"
    ];
    const result = req(sar.results[0], "result");
    expect(
      result.findings.every((f) => f.target.status.state === "satisfied"),
    ).toBe(true);
  });
});

describe("toOscalBundle — determinism + honesty + fail-closed", () => {
  test("identical input + injected clock/id seam yields a byte-identical bundle", () => {
    const m = fixtureManifest();
    const a = toOscalBundle(m, det());
    const b = toOscalBundle(m, det());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // Canonicalizable (no NaN/undefined leaks) and stable under canonicalize.
    expect(canonicalize(asJson(a))).toBe(canonicalize(asJson(b)));
  });

  test("the default id source mints distinct random UUIDs per call", () => {
    const m = fixtureManifest();
    const a = toOscalAssessmentResults(m, { now: NOW })["assessment-results"];
    const b = toOscalAssessmentResults(m, { now: NOW })["assessment-results"];
    expect(a.uuid).toMatch(UUID_RE);
    expect(a.uuid).not.toBe(b.uuid);
  });

  test("never claims compliant/certified (TM-K honesty floor)", () => {
    const bundle = toOscalBundle(fixtureManifest(), det());
    expect(JSON.stringify(bundle)).not.toMatch(/compliant|certified/i);
  });

  test("every minted UUID in the SAR is unique (no id collisions)", () => {
    const sar = toOscalAssessmentResults(fixtureManifest(), det())[
      "assessment-results"
    ];
    const result = req(sar.results[0], "result");
    const ids = [
      sar.uuid,
      result.uuid,
      ...result.observations.map((o) => o.uuid),
      ...result.findings.map((f) => f.uuid),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("fails closed on an invalid clock", () => {
    expect(() =>
      toOscalAssessmentResults(fixtureManifest(), {
        now: new Date(Number.NaN),
      }),
    ).toThrow(ValidationError);
  });

  test("fails closed on malformed pack provenance", () => {
    expect(() =>
      toOscalPlanOfActionAndMilestones(
        fixtureManifest(),
        det({ packSha256: "not-a-digest" }),
      ),
    ).toThrow(ValidationError);
  });
});
