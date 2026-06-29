// ADR-0074: the registered feature-tag set is the single source of truth the base credit boundary
// validates against. A registered tag passes; anything else fails closed (a typo cannot mint a meter).
import { describe, expect, test } from "bun:test";
import {
  FeatureTagSchema,
  REGISTERED_FEATURE_TAGS,
  assertRegisteredFeatureTag,
} from "./feature-tags";

describe("registered feature tags (ADR-0074)", () => {
  test("the documented edition tags are registered", () => {
    const tags: readonly string[] = REGISTERED_FEATURE_TAGS;
    for (const tag of ["evidence_pack", "inference_call", "codegen_run"]) {
      expect(tags).toContain(tag);
    }
  });

  test("the schema accepts a registered tag and rejects anything else", () => {
    expect(FeatureTagSchema.safeParse("evidence_pack").success).toBe(true);
    expect(FeatureTagSchema.safeParse("not_a_tag").success).toBe(false);
    expect(FeatureTagSchema.safeParse("").success).toBe(false);
    expect(FeatureTagSchema.safeParse(42).success).toBe(false);
  });

  test("assertRegisteredFeatureTag narrows a registered tag and throws on an unregistered one", () => {
    expect(() => assertRegisteredFeatureTag("codegen_run")).not.toThrow();
    expect(() => assertRegisteredFeatureTag("nope")).toThrow();
  });
});
