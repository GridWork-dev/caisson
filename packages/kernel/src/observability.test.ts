import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evalResultSchema,
  evidencePackSchema,
  usageMeteringSchema,
} from "./observability.ts";

const samples = JSON.parse(
  readFileSync(
    join(import.meta.dir, "__golden__", "observability-samples.json"),
    "utf8",
  ),
) as {
  evidencePack: unknown;
  usageMetering: unknown;
  evalResult: unknown;
};

describe("observability schemas (ADR-0075)", () => {
  test("the evidence-pack sample parses and round-trips", () => {
    const parsed = evidencePackSchema.parse(samples.evidencePack);
    // `samples.X` is `unknown` (raw JSON); make it the receiver so `toEqual` types check.
    expect(samples.evidencePack).toEqual(parsed);
  });

  test("the usage-metering sample parses and round-trips", () => {
    const parsed = usageMeteringSchema.parse(samples.usageMetering);
    expect(parsed.quantity).toBe(3);
    expect(samples.usageMetering).toEqual(parsed);
  });

  test("the eval-result sample parses and round-trips", () => {
    const parsed = evalResultSchema.parse(samples.evalResult);
    expect(parsed.score).toBeCloseTo(0.97);
    expect(samples.evalResult).toEqual(parsed);
  });

  test("every schema rejects an unknown field (.strict())", () => {
    expect(
      evidencePackSchema.safeParse({
        ...(samples.evidencePack as object),
        rogue: 1,
      }).success,
    ).toBe(false);
    expect(
      usageMeteringSchema.safeParse({
        ...(samples.usageMetering as object),
        rogue: 1,
      }).success,
    ).toBe(false);
    expect(
      evalResultSchema.safeParse({
        ...(samples.evalResult as object),
        rogue: 1,
      }).success,
    ).toBe(false);
  });

  test("integer-only quantities reject a float (ADR-0007)", () => {
    expect(
      usageMeteringSchema.safeParse({
        ...(samples.usageMetering as object),
        quantity: 3.5,
      }).success,
    ).toBe(false);
  });

  test("a non-hex artifact checksum is rejected", () => {
    expect(
      evidencePackSchema.safeParse({
        ...(samples.evidencePack as object),
        chainTipHash: "not-a-hash",
      }).success,
    ).toBe(false);
  });
});
