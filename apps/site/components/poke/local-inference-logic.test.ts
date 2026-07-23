// Real-package parity for the local-inference poke's browser mirror (local-inference-logic.ts).
// No `packages/local-inference/src/__golden__` fixture dir exists (checked), so parity anchors
// directly against the real package's own functions, imported here by relative path — apps/site
// does not declare `@caisson/local-inference` / `@caisson/local-privacy` as workspace dependencies
// (see local-inference-logic.ts's header for why the mirror exists at all). Bun's test runtime is
// node-like, so the real package's node:crypto imports resolve fine here even though they cannot
// reach a browser bundle.
import { describe, expect, test } from "bun:test";

import { EMBEDDING_DIM as pkgEmbeddingDim } from "../../../../packages/local-inference/src/backend.ts";
import { DEFAULT_ONNX_MODEL as pkgDefaultOnnxModel } from "../../../../packages/local-inference/src/onnx-backend.ts";
import { StubInferenceBackend } from "../../../../packages/local-inference/src/stub.ts";
import { createEgressGuard } from "../../../../packages/local-privacy/src/egress-guard.ts";
import { localOnlyPolicy } from "../../../../packages/local-privacy/src/policy.ts";
import type { SanctionedSinkKind } from "../../../../packages/local-privacy/src/policy.ts";

import {
  DEFAULT_ONNX_MODEL,
  EMBEDDING_DIM,
  SAMPLE_PROMPT,
  SAMPLE_RENTED_HOST,
  evaluateEgress,
  isAllowlistedFor,
  normalizeBars,
  sampleEmbed,
  sparkBars,
} from "./local-inference-logic";

describe("mirrored constants — parity vs the real package", () => {
  test("EMBEDDING_DIM matches backend.ts's locked embedding width", () => {
    expect(EMBEDDING_DIM).toBe(pkgEmbeddingDim);
  });

  test("DEFAULT_ONNX_MODEL matches onnx-backend.ts's default model coordinates", () => {
    expect(DEFAULT_ONNX_MODEL).toEqual(pkgDefaultOnnxModel);
  });
});

describe("sampleEmbed — WebCrypto mirror parity vs the real StubInferenceBackend", () => {
  test("byte-identical to the real package's deterministic stub embed on the same input", async () => {
    const real = new StubInferenceBackend();
    const want = Array.from(await real.embed(SAMPLE_PROMPT));
    const got = Array.from(await sampleEmbed(SAMPLE_PROMPT));
    expect(got).toEqual(want);
  });

  test("byte-identical on a second, distinct input too", async () => {
    const real = new StubInferenceBackend();
    const text = "a wholly different prompt";
    expect(Array.from(await sampleEmbed(text))).toEqual(
      Array.from(await real.embed(text)),
    );
  });

  test("fixed at EMBEDDING_DIM and unit-norm", async () => {
    const vec = await sampleEmbed(SAMPLE_PROMPT);
    expect(vec.length).toBe(EMBEDDING_DIM);
    let sumSq = 0;
    for (const v of vec) sumSq += v * v;
    expect(Math.sqrt(sumSq)).toBeCloseTo(1, 5);
  });

  test("deterministic: identical input -> byte-identical vector", async () => {
    const a = await sampleEmbed(SAMPLE_PROMPT);
    const b = await sampleEmbed(SAMPLE_PROMPT);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  test("distinct input -> a distinct vector", async () => {
    const a = await sampleEmbed(SAMPLE_PROMPT);
    const b = await sampleEmbed("a completely unrelated prompt");
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe("sparkBars / normalizeBars — pure downsampling for the spark strip", () => {
  test("downsamples a full-dim vector to at most the requested bar count", () => {
    const vec = new Float32Array(EMBEDDING_DIM).fill(1);
    expect(sparkBars(vec, 48).length).toBeLessThanOrEqual(48);
    expect(sparkBars(vec, 48).length).toBeGreaterThan(0);
  });

  test("normalizeBars maps the range to exactly 0..100", () => {
    const norm = normalizeBars([1, 2, 3]);
    expect(Math.min(...norm)).toBe(0);
    expect(Math.max(...norm)).toBe(100);
  });

  test("normalizeBars never divides by zero on a flat input", () => {
    expect(normalizeBars([5, 5, 5])).toEqual([50, 50, 50]);
  });
});

describe("isAllowlistedFor — parity vs the real EgressGuard.assertAllowedFor", () => {
  const cases: {
    label: string;
    allow: { host: string; kind: SanctionedSinkKind }[];
    kind: SanctionedSinkKind;
  }[] = [
    {
      label: "zero-egress default (empty allowlist)",
      allow: [],
      kind: "rented-backend",
    },
    {
      label: "host allowlisted for the exact kind checked",
      allow: [{ host: SAMPLE_RENTED_HOST, kind: "rented-backend" }],
      kind: "rented-backend",
    },
    {
      label:
        "host allowlisted for a DIFFERENT sanctioned kind (purpose-binding)",
      allow: [{ host: SAMPLE_RENTED_HOST, kind: "model-fetch" }],
      kind: "rented-backend",
    },
  ];

  test("agrees with the real guard's allow/deny outcome on every allowlist shape", () => {
    for (const c of cases) {
      const guard = createEgressGuard(localOnlyPolicy(c.allow));
      let realAllowed = true;
      try {
        guard.assertAllowedFor(`https://${SAMPLE_RENTED_HOST}/embed`, c.kind);
      } catch {
        realAllowed = false;
      }
      expect(isAllowlistedFor(SAMPLE_RENTED_HOST, c.kind, c.allow)).toBe(
        realAllowed,
      );
    }
  });
});

describe("evaluateEgress — on-device stays local, rented is off by default", () => {
  test("on-device never egresses, independent of the allowlist state", () => {
    expect(evaluateEgress("on-device", false)).toEqual({
      outcome: "local",
      host: null,
      sinkKind: null,
      requests: 0,
      usage: null,
    });
    expect(evaluateEgress("on-device", true)).toEqual({
      outcome: "local",
      host: null,
      sinkKind: null,
      requests: 0,
      usage: null,
    });
  });

  test("rented + not opted in blocks (the control's failure/deny path)", () => {
    const reading = evaluateEgress("rented", false);
    expect(reading.outcome).toBe("blocked");
    expect(reading.requests).toBe(0);
    expect(reading.usage).toBeNull();
  });

  test("rented + opted in crosses the boundary: one request, one metered usage record", () => {
    const reading = evaluateEgress("rented", true);
    expect(reading.outcome).toBe("egressed");
    expect(reading.host).toBe(SAMPLE_RENTED_HOST);
    expect(reading.sinkKind).toBe("rented-backend");
    expect(reading.requests).toBe(1);
    expect(reading.usage).toEqual({ unit: "token", quantity: 128 });
  });
});
