import { describe, expect, test } from "bun:test";

import {
  OSCAL_VERSION as REAL_OSCAL_VERSION,
  toOscalAssessmentPlan as realToOscalAssessmentPlan,
} from "../../../../packages/oscal-spine/src/index.ts";
import {
  OSCAL_VERSION,
  SAMPLE_FRAMEWORKS,
  SAMPLE_NOW,
  makeCounterIds,
  toOscalAssessmentPlan,
} from "./oscal-spine-logic";

describe("OSCAL spine browser mirror", () => {
  test("the locked OSCAL version matches the package", () => {
    expect(OSCAL_VERSION).toBe(REAL_OSCAL_VERSION);
  });

  for (const framework of SAMPLE_FRAMEWORKS) {
    test(`${framework.id} Assessment Plan matches the real package byte-for-byte`, () => {
      const mirror = toOscalAssessmentPlan(framework, {
        now: SAMPLE_NOW,
        newId: makeCounterIds(),
      });
      const real = realToOscalAssessmentPlan(framework, {
        now: SAMPLE_NOW,
        newId: makeCounterIds(),
      });
      expect(mirror).toEqual(real);
    });
  }

  test("identical inputs produce an identical document", () => {
    const framework = SAMPLE_FRAMEWORKS[0];
    expect(framework).toBeDefined();
    const build = () =>
      toOscalAssessmentPlan(framework!, {
        now: SAMPLE_NOW,
        newId: makeCounterIds(),
      });
    expect(build()).toEqual(build());
  });

  test("an invalid clock fails closed like the real package", () => {
    const framework = SAMPLE_FRAMEWORKS[0];
    expect(framework).toBeDefined();
    expect(() =>
      toOscalAssessmentPlan(framework!, {
        now: new Date(Number.NaN),
        newId: makeCounterIds(),
      }),
    ).toThrow(/valid `now` instant/);
    expect(() =>
      realToOscalAssessmentPlan(framework!, {
        now: new Date(Number.NaN),
        newId: makeCounterIds(),
      }),
    ).toThrow(/valid `now` instant/);
  });
});
