// The oscal-spine poke's checkable claims, now that it drives the REAL toOscalAssessmentPlan
// through `@caisson-sh/oscal-spine/browser` (ADR-0396) and the hand-ported mirror
// (oscal-spine-logic.ts) is deleted. No parity suite survives because there is nothing left to
// compare — the invalid-clock test now exercises the package's real fail-closed guard, where the
// mirror's test only ever proved its own copy of it.
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import {
  euAiAct,
  hipaaSecurity,
  soc2Tsc,
} from "@caisson-sh/frameworks-pack/browser";
import {
  OSCAL_VERSION,
  toOscalAssessmentPlan,
} from "@caisson-sh/oscal-spine/browser";

import {
  SAMPLE_FRAMEWORKS,
  SAMPLE_NOW,
  makeCounterIds,
} from "./oscal-spine-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "oscal-spine-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    const walk = nodeBuiltinTaint(POKE_ENTRY, {
      workspaceRoot: WORKSPACE_ROOT,
    });
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
    expect(walk.files).toContain("packages/oscal-spine/src/browser.ts");
  });
});

describe("the framework identities are derived from the real packs", () => {
  test("each triple matches its pack on id/title/version — nothing is copied prose", () => {
    expect(SAMPLE_FRAMEWORKS).toEqual(
      [soc2Tsc, hipaaSecurity, euAiAct].map(({ id, title, version }) => ({
        id,
        title,
        version,
      })),
    );
  });
});

describe("the real exporter under the poke's seams", () => {
  const soc2 = SAMPLE_FRAMEWORKS[0];

  test("a fixed clock + counter ids render deterministically and stamp OSCAL_VERSION", () => {
    if (soc2 === undefined) throw new Error("sample frameworks empty");
    const render = () =>
      toOscalAssessmentPlan(soc2, { now: SAMPLE_NOW, newId: makeCounterIds() });
    const a = render();
    const b = render();
    expect(a).toEqual(b);
    expect(a["assessment-plan"].metadata["oscal-version"]).toBe(OSCAL_VERSION);
  });

  test("an invalid clock throws the package's real fail-closed ValidationError", () => {
    if (soc2 === undefined) throw new Error("sample frameworks empty");
    expect(() =>
      toOscalAssessmentPlan(soc2, {
        now: new Date(Number.NaN),
        newId: makeCounterIds(),
      }),
    ).toThrow(ValidationError);
  });
});
