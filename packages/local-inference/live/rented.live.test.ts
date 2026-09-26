// live/rented.live.test.ts — LIVE proof of the OpenRouter rented transport (ADR-0201 §2, over the
// ADR-0064 rented-backend seam). This file lives OUTSIDE ./src so the default suite
// (`bun test ./src`), CI's secret-free runners, and the published tarball path never run it; it runs
// only via `bun run test:live` AND self-skips without the org OPENROUTER_API_KEY (the ADR-0201
// live-test convention, after the oscal-cli availability-probe precedent).
//
// What it proves that the unit doubles never could:
//   - the real wire accepts our request shapes (Bearer auth, Matryoshka `dimensions` truncation);
//   - qwen3-embedding-8b truncated to EMBEDDING_DIM (384) actually returns a 384-wide vector — a
//     width drift would fail-close at the backend's dim-guard, which would itself be a finding, so
//     the transport-level width is asserted FIRST to localize any failure;
//   - the metered lane stays integer end-to-end against real provider-reported usage (ADR-0007).
import { describe, expect, test } from "bun:test";
import type { UsageMetering } from "@caisson-sh/kernel";
import {
  EMBEDDING_DIM,
  RentedInferenceBackend,
  createEgressGuard,
  createOpenRouterRentedTransport,
  localOnlyPolicy,
} from "../src/index.ts";
import type { MeterSink, RentedTransport } from "../src/index.ts";

const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const LIVE = API_KEY !== "";
const COMPLETION_MODEL =
  process.env.CAISSON_LIVE_OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
const EMBEDDING_MODEL = "qwen/qwen3-embedding-8b";
const ENDPOINT = "https://openrouter.ai/api/v1";
const TIMEOUT_MS = 60_000;

/** The explicit deployer opt-in: openrouter.ai allowlisted as a `rented-backend` sink. */
function liveGuard() {
  return createEgressGuard(
    localOnlyPolicy([{ host: "openrouter.ai", kind: "rented-backend" }]),
  );
}

function liveTransport(guard = liveGuard()): RentedTransport {
  return createOpenRouterRentedTransport({
    guard,
    apiKey: API_KEY,
    completionModel: COMPLETION_MODEL,
    embeddingModel: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIM,
    timeoutMs: TIMEOUT_MS,
  });
}

function collectingMeter(): { records: UsageMetering[]; sink: MeterSink } {
  const records: UsageMetering[] = [];
  return {
    records,
    sink: (record) => {
      records.push(record);
    },
  };
}

function liveBackend(sink: MeterSink) {
  const guard = liveGuard();
  return new RentedInferenceBackend({
    endpoint: ENDPOINT,
    guard,
    transport: liveTransport(guard),
    meter: sink,
    tenantId: "live-proof",
    feature: "local-ai.rented-inference",
    model: `openrouter/${EMBEDDING_MODEL}`,
  });
}

describe("OpenRouter rented transport — LIVE (skips without OPENROUTER_API_KEY)", () => {
  test.skipIf(!LIVE)(
    "transport embed returns an EMBEDDING_DIM-wide vector (Matryoshka dimensions honored)",
    async () => {
      const res = await liveTransport().embed({
        text: "caisson live rented-transport proof",
      });
      // Asserted at the transport BEFORE the backend, so a provider-side width drift is localized
      // here instead of surfacing as the backend's dim-guard fail-close.
      expect(res.vector.length).toBe(EMBEDDING_DIM);
      expect(res.usage.unit).toBe("token");
      expect(Number.isInteger(res.usage.quantity)).toBe(true);
      expect(res.usage.quantity).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );

  test.skipIf(!LIVE)(
    "backend embed returns Float32Array(384) and meters exactly one integer record",
    async () => {
      const meter = collectingMeter();
      const vec = await liveBackend(meter.sink).embed(
        "caisson live rented-backend embed proof",
      );
      expect(vec).toBeInstanceOf(Float32Array);
      expect(vec.length).toBe(EMBEDDING_DIM);
      expect(meter.records).toHaveLength(1);
      const rec = meter.records[0];
      if (!rec) throw new Error("expected a metered record");
      expect(Number.isInteger(rec.quantity)).toBe(true);
      expect(rec.quantity).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );

  test.skipIf(!LIVE)(
    "backend complete returns non-empty text and meters exactly one integer record",
    async () => {
      const meter = collectingMeter();
      const out = await liveBackend(meter.sink).complete({
        prompt: "Reply with the single word: caisson",
        maxTokens: 16,
      });
      expect(out.text.trim().length).toBeGreaterThan(0);
      expect(meter.records).toHaveLength(1);
      const rec = meter.records[0];
      if (!rec) throw new Error("expected a metered record");
      expect(Number.isInteger(rec.quantity)).toBe(true);
      expect(rec.quantity).toBeGreaterThan(0);
    },
    TIMEOUT_MS,
  );
});
