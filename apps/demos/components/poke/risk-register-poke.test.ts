// The risk-register poke's checkable claims, now that it drives the REAL @caisson-sh/risk-register
// and the hand-ported mirror (risk-register-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a ~428KB polyfill, exit 0).
//   2. The sample fixture is the package's own golden row, so the demo shows real artifacts.
//   3. The poke-local matrix is a rendering enumeration over the real primitive — no ordinal table
//      is restated here.
//   4. The real ASYNC recordResidualOverride runs against the poke's injected in-memory chain port,
//      and the port never fabricates evidence (its "hash" is affirmatively not hash-shaped).
//   5. effectiveResidual comes off the real buildRiskTreatmentPlan row — the treatment-plan
//      invariant exists in exactly one place: the package.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { InternalError, ValidationError } from "@caisson-sh/kernel";
import type { AuditChainStore } from "@caisson-sh/audit-worm";
import {
  buildRiskTreatmentPlan,
  computeResidual,
  defineRiskEntry,
  recordResidualOverride,
} from "@caisson-sh/risk-register";

import {
  IMPACTS,
  LIKELIHOODS,
  NOT_A_CHAIN_HASH,
  SAMPLE_ACCOUNT_ID,
  SAMPLE_EVIDENCE_DIGEST,
  SAMPLE_IMPACT,
  SAMPLE_LIKELIHOOD,
  SAMPLE_NOW,
  SAMPLE_OWNER,
  SAMPLE_RISK_ID,
  SAMPLE_SUBJECT,
  SAMPLE_TENANT_ID,
  SAMPLE_TREATMENT_PLAN,
  browserChainDouble,
  residualMatrix,
} from "./risk-register-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "risk-register-poke.tsx");

/** The poke's entry, authored through the real package the way the component authors it. */
function sampleEntry() {
  return defineRiskEntry({
    riskId: SAMPLE_RISK_ID,
    subject: SAMPLE_SUBJECT,
    likelihood: SAMPLE_LIKELIHOOD,
    impact: SAMPLE_IMPACT,
    treatmentPlan: SAMPLE_TREATMENT_PLAN,
    owner: SAMPLE_OWNER,
    evidenceDigest: SAMPLE_EVIDENCE_DIGEST,
    crosswalk: [],
  });
}

/** Strips nominal brands for deep-equality against parsed golden JSON. */
function plain<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: the UI kit alone contributes ~40 files, so files.length can never prove
    // the risk-register edges resolved. These files are reachable ONLY through
    // @caisson-sh/risk-register's own imports — first hop, then two second hops (one per
    // cross-package seam), so a resolver that went blind inside a workspace package fails here.
    expect(walk.files.length).toBeGreaterThan(20);
    expect(walk.files).toContain(
      "packages/risk-register/src/treatment-plan.ts",
    );
    expect(walk.files).toContain(
      "packages/frameworks-pack/src/registry/control.ts",
    );
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A fifth entry appearing here means a new non-workspace dependency joined the client graph —
    // that is a review event, not a silent hole in the proof.
    expect(walk.external).toEqual(["lucide-react", "radix-ui", "react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/audit-worm/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
  });

  test("audit-worm stays out of the bundle graph — and the declined edge is really there", () => {
    expect(walk.files.some((f) => f.startsWith("packages/audit-worm/"))).toBe(
      false,
    );
    // The erasure claim is checked, not assumed: the import exists in source as the
    // STATEMENT-LEVEL `import type` form (a compiler-guaranteed erasure under
    // verbatimModuleSyntax), and the inline `import { type X }` form — which the walker
    // deliberately reports as a value edge — is affirmatively absent.
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(
      /^import type \{[^}]*\} from "@caisson-sh\/audit-worm";$/m,
    );
    expect(src).not.toMatch(
      /^import \{[^}]*\btype\b[^}]*\} from "@caisson-sh\/audit-worm";$/m,
    );
  });
});

describe("the sample fixture is the package's own golden row", () => {
  test("SAMPLE_* through the real authoring path deep-equals the committed golden's R-1 row", () => {
    const golden = JSON.parse(
      readFileSync(
        join(
          WORKSPACE_ROOT,
          "packages/risk-register/src/__golden__/risk-treatment-plan.txt",
        ),
        "utf8",
      ),
    ) as { risks: readonly { riskId: string }[] };
    const goldenRow = golden.risks.find((r) => r.riskId === SAMPLE_RISK_ID);
    expect(goldenRow).toBeDefined();

    const { plan } = buildRiskTreatmentPlan({
      tenantId: SAMPLE_TENANT_ID,
      risks: [sampleEntry()],
    });
    expect(plain(plan.risks[0])).toEqual(goldenRow);
  });
});

describe("residualMatrix is a rendering enumeration over the real primitive", () => {
  test("25 cells, one per likelihood x impact pair, each derived by computeResidual", () => {
    const cells = residualMatrix();
    expect(cells.length).toBe(LIKELIHOODS.length * IMPACTS.length);
    const pairs = new Set(cells.map((c) => `${c.likelihood}|${c.impact}`));
    expect(pairs.size).toBe(25);
    for (const cell of cells) {
      expect(cell.residual).toBe(computeResidual(cell.likelihood, cell.impact));
    }
  });
});

describe("the poke drives the real async recordResidualOverride through an injected port", () => {
  const entry = sampleEntry();

  function validInput(chain: Pick<AuditChainStore, "append">) {
    return {
      chain,
      accountId: SAMPLE_ACCOUNT_ID,
      riskId: SAMPLE_RISK_ID,
      computed: entry.residual,
      overrideLikelihood: "unlikely",
      overrideImpact: "minor",
      who: "risk-officer@example.com",
      why: "compensating control in place",
      now: SAMPLE_NOW,
    } as const;
  }

  test("a valid override chains: computed carried untouched, override derived on the same scale", async () => {
    const res = await recordResidualOverride(validInput(browserChainDouble()));
    expect(res.record.computed).toBe(entry.residual);
    expect(res.record.override).toBe(computeResidual("unlikely", "minor"));
    expect(res.record.computed).not.toBe(res.record.override);
    expect(res.record.at).toBe(SAMPLE_NOW.toISOString());
  });

  test("the double is only a port, never fabricated evidence", async () => {
    const res = await recordResidualOverride(validInput(browserChainDouble()));
    expect(res.evidence.entry.hash).toBe(NOT_A_CHAIN_HASH);
    // It can never be mistaken for a real SHA-256 — an edit that made the double hash-shaped
    // fails here.
    expect(res.evidence.entry.hash).not.toMatch(/^[0-9a-f]{64}$/);
  });

  test("the double really chains: seq, prevHash linkage, anchor length", async () => {
    const chain = browserChainDouble();
    const first = await chain.append(SAMPLE_ACCOUNT_ID, { n: 1 });
    const second = await chain.append(SAMPLE_ACCOUNT_ID, { n: 2 });
    expect(first.entry.seq).toBe(0);
    expect(second.entry.seq).toBe(1);
    expect(first.entry.prevHash).toBeNull();
    expect(second.entry.prevHash).toBe(first.entry.hash);
    expect(second.anchor.length).toBe(2);
  });

  test.each([
    ["empty riskId", { riskId: "" }],
    ["empty who", { who: "" }],
    ["who over 200 chars", { who: "w".repeat(201) }],
    ["empty why", { why: "" }],
    ["why over 2000 chars", { why: "y".repeat(2001) }],
  ])(
    "the real primitive rejects %s with the package's own ValidationError",
    async (_name, patch) => {
      const err: unknown = await recordResidualOverride({
        ...validInput(browserChainDouble()),
        ...patch,
      }).then(
        () => null,
        (e: unknown) => e,
      );
      if (!(err instanceof ValidationError)) {
        throw new Error("expected a ValidationError rejection");
      }
      expect(err.code).toBe("validation_error");
      expect(err.httpStatus).toBe(400);
      expect(err.message).toContain("risk-register:");
    },
  );

  test("an evidence gap fails loud — a chain the append cannot reach is no override at all", async () => {
    const failing: Pick<AuditChainStore, "append"> = {
      append: () => Promise.reject(new Error("chain unreachable")),
    };
    const err: unknown = await recordResidualOverride(validInput(failing)).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(InternalError);
  });
});

describe("effectiveResidual comes from the real buildRiskTreatmentPlan, not a restated invariant", () => {
  const entry = sampleEntry();

  async function recorded() {
    const { record } = await recordResidualOverride({
      chain: browserChainDouble(),
      accountId: SAMPLE_ACCOUNT_ID,
      riskId: SAMPLE_RISK_ID,
      computed: entry.residual,
      overrideLikelihood: "unlikely",
      overrideImpact: "minor",
      who: "risk-officer@example.com",
      why: "compensating control in place",
      now: SAMPLE_NOW,
    });
    return record;
  }

  test("no override: effective equals computed", () => {
    const { plan } = buildRiskTreatmentPlan({
      tenantId: SAMPLE_TENANT_ID,
      risks: [entry],
    });
    const row = plan.risks[0];
    expect(row?.effectiveResidual).toBe(row?.computedResidual ?? -1);
    expect(plan.summary.overriddenCount).toBe(0);
  });

  test("with an override on record: the override governs, the computed value stays recoverable", async () => {
    const record = await recorded();
    const { plan } = buildRiskTreatmentPlan({
      tenantId: SAMPLE_TENANT_ID,
      risks: [entry],
      overridesByRiskId: new Map([[SAMPLE_RISK_ID, record]]),
    });
    const row = plan.risks[0];
    expect(row?.effectiveResidual).toBe(record.override);
    expect(row?.computedResidual).toBe(
      computeResidual(SAMPLE_LIKELIHOOD, SAMPLE_IMPACT),
    );
    expect(row?.overrideOf?.who).toBe(record.who);
    expect(row?.overrideOf?.why).toBe(record.why);
    expect(row?.overrideOf?.at).toBe(record.at);
    expect(plan.summary.overriddenCount).toBe(1);
  });

  test("moving the base sliders after an override re-derives computed while the override still governs", async () => {
    const record = await recorded();
    const moved = defineRiskEntry({
      riskId: SAMPLE_RISK_ID,
      subject: SAMPLE_SUBJECT,
      likelihood: "likely",
      impact: "severe",
      treatmentPlan: SAMPLE_TREATMENT_PLAN,
      owner: SAMPLE_OWNER,
      evidenceDigest: SAMPLE_EVIDENCE_DIGEST,
      crosswalk: [],
    });
    const { plan } = buildRiskTreatmentPlan({
      tenantId: SAMPLE_TENANT_ID,
      risks: [moved],
      overridesByRiskId: new Map([[SAMPLE_RISK_ID, record]]),
    });
    const row = plan.risks[0];
    expect(row?.computedResidual).toBe(computeResidual("likely", "severe"));
    expect(row?.effectiveResidual).toBe(record.override);
  });
});
