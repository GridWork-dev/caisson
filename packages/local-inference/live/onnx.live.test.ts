// live/onnx.live.test.ts — LIVE proof of the on-device ONNX backend (ADR-0201 §3, over the
// ADR-0064 seam). Lives OUTSIDE ./src (never in the default
// suite / CI / tarball path; runs via `bun run test:live` only) and is availability-gated TWO ways,
// per ADR-0201: `@huggingface/transformers` stays deliberately UNINSTALLED (~270 MB of native deps),
// so the file probes for the module with a NON-LITERAL dynamic import (the onnx-backend.ts
// `TRANSFORMERS_MODULE` trick — tsc never resolves the specifier) AND additionally requires the
// CAISSON_ONNX_LIVE env opt-in.
//
// Three legs:
//   (a) TAMPER — a deliberately wrong SHA-256 pin for the model file must fail closed with the
//       integrity-mismatch InternalError; the error's `file` detail doubles as runtime discovery of
//       whichever .onnx file the installed transformers version actually fetches.
//   (b) REAL — SELF-PIN: fetch the discovered model file once via the plain kernel chokepoint and
//       hash it, then run the full guarded + pinned pipeline to a unit-norm Float32Array(384).
//       This proves the pipeline/guard/pin MECHANICS and the 384 geometry — it does NOT prove
//       third-party integrity (a self-pin trusts the same origin it verifies); production pins must
//       be operator-published values.
//   (c) EGRESS BLOCK — a backend whose sole sanctioned modelHost is example.com must reject the
//       huggingface.co fetch (host-not-allowlisted, fail-closed-to-offline).
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "bun:test";
import {
  AuthzError,
  InternalError,
  fetchWithTimeout,
} from "@caisson-sh/kernel";
import {
  DEFAULT_ONNX_MODEL,
  EMBEDDING_DIM,
  OnnxEmbeddingBackend,
  createEgressGuard,
  localOnlyPolicy,
} from "../src/index.ts";

// Non-literal specifier ⇒ tsc never resolves the (deliberately uninstalled) optional peer.
const TRANSFORMERS_MODULE = "@huggingface/transformers";
const transformersAvailable = await import(TRANSFORMERS_MODULE).then(
  () => true,
  () => false,
);
const LIVE = transformersAvailable && Boolean(process.env.CAISSON_ONNX_LIVE);

/** Valid-format, guaranteed-wrong SHA-256 pin for the tamper leg. */
const WRONG_PIN = "f".repeat(64);
/**
 * Candidate model filenames across transformers dtype defaults — the tamper leg pins ALL of them
 * wrong, so whichever one the installed version fetches trips the integrity gate; the error's
 * `file` detail then names it (runtime discovery, no version assumptions).
 */
const ONNX_CANDIDATES = [
  "model.onnx",
  "model_quantized.onnx",
  "model_fp16.onnx",
  "model_q8.onnx",
  "model_int8.onnx",
  "model_uint8.onnx",
  "model_q4.onnx",
  "model_q4f16.onnx",
  "model_bnb4.onnx",
];
/** First-run model download over real network — generous deadlines. */
const DOWNLOAD_TIMEOUT_MS = 300_000;

const tempDirs: string[] = [];
async function freshCache(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "caisson-onnx-live-"));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

/** Walk `err` + its `cause` chain for an error of `ctor` (transformers may wrap throws). */
function findError<T>(err: unknown, ctor: new (...a: never[]) => T): T | null {
  let current: unknown = err;
  for (let depth = 0; depth < 8 && current != null; depth++) {
    if (current instanceof ctor) return current;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** The runtime-discovered model filename, harvested by the tamper leg for the real-proof leg. */
let discoveredFile: string | null = null;

describe("OnnxEmbeddingBackend — LIVE (skips without @huggingface/transformers + CAISSON_ONNX_LIVE)", () => {
  test.skipIf(!LIVE)(
    "(a) tamper: a wrong hash-pin fails closed with the integrity-mismatch InternalError",
    async () => {
      const backend = new OnnxEmbeddingBackend({
        ...DEFAULT_ONNX_MODEL,
        cacheDir: await freshCache(),
        integrity: Object.fromEntries(
          ONNX_CANDIDATES.map((file) => [file, WRONG_PIN]),
        ),
      });
      let caught: unknown = null;
      try {
        await backend.embed("caisson tamper probe");
      } catch (err) {
        caught = err;
      }
      // A resolve here means the fetched model file matched NO wrong-pinned candidate — the
      // integrity gate never ran, which is itself a finding (extend ONNX_CANDIDATES).
      expect(caught).not.toBeNull();
      const ie = findError(caught, InternalError);
      expect(ie).not.toBeNull();
      if (!ie) throw new Error("expected the integrity-mismatch InternalError");
      expect(ie.message).toContain("integrity");
      const file = ie.details?.file;
      expect(typeof file).toBe("string");
      discoveredFile = file as string;
    },
    DOWNLOAD_TIMEOUT_MS,
  );

  test.skipIf(!LIVE)(
    "(b) real proof: self-pinned model embeds to a unit-norm Float32Array(384)",
    async () => {
      const file = discoveredFile ?? "model_quantized.onnx";
      // SELF-PIN (see the file header): one plain fetch through the kernel chokepoint to hash the
      // exact bytes the guarded pipeline will re-fetch and verify.
      const res = await fetchWithTimeout(
        `https://${DEFAULT_ONNX_MODEL.modelHost}/${DEFAULT_ONNX_MODEL.modelId}/resolve/${DEFAULT_ONNX_MODEL.revision}/onnx/${file}`,
        {},
        { timeoutMs: DOWNLOAD_TIMEOUT_MS },
      );
      expect(res.ok).toBe(true);
      const pin = createHash("sha256")
        .update(new Uint8Array(await res.arrayBuffer()))
        .digest("hex");

      const backend = new OnnxEmbeddingBackend({
        ...DEFAULT_ONNX_MODEL,
        cacheDir: await freshCache(),
        integrity: { [file]: pin },
      });
      const vec = await backend.embed("caisson worm proof");
      expect(vec).toBeInstanceOf(Float32Array);
      expect(vec.length).toBe(EMBEDDING_DIM);
      // normalize:true mean-pooling ⇒ unit-norm-ish (float32 rounding tolerance).
      let sumSq = 0;
      for (const v of vec) sumSq += v * v;
      expect(Math.abs(1 - sumSq)).toBeLessThan(0.05);
    },
    DOWNLOAD_TIMEOUT_MS,
  );

  test.skipIf(!LIVE)(
    "(c) egress block: a backend sanctioned only for example.com is blocked at the SHARED guard",
    async () => {
      const backend = new OnnxEmbeddingBackend({
        ...DEFAULT_ONNX_MODEL,
        modelHost: "example.com",
        cacheDir: await freshCache(),
        // ≥1 pin is required by config validation; never reached — the host gate fires first.
        integrity: { "model.onnx": WRONG_PIN },
      });
      let caught: unknown = null;
      try {
        await backend.embed("caisson egress probe");
      } catch (err) {
        caught = err;
      }
      expect(caught).not.toBeNull();
      // F2=B: the block is now the shared EgressGuard's fail-closed AuthzError (host-not-allowlisted
      // at the model-fetch sink), NOT the old backend-inline InternalError — the unification proof.
      const ae = findError(caught, AuthzError);
      expect(ae).not.toBeNull();
      if (!ae) throw new Error("expected the shared-guard AuthzError block");
      expect(ae.message).toContain("blocked");
      expect(ae.details?.host).toBe(DEFAULT_ONNX_MODEL.modelHost);
    },
    DOWNLOAD_TIMEOUT_MS,
  );

  // (d) SHARED-GUARD leg (F2=B, ADR-0221) — mirrors rented.live.test.ts's `liveGuard()`: build the
  // exact guard the backend now constructs internally (modelHost allowlisted ONLY as a `model-fetch`
  // sink) and prove the fail-closed, purpose-bound decision at the shared-policy layer. Pure (no
  // network, no transformers), so it runs even without the peer install — the CI-free unification
  // proof the backend inherits.
  test("(d) shared guard: model-fetch sink is purpose-bound and fails closed off-allowlist", () => {
    const guard = createEgressGuard(
      localOnlyPolicy([
        { host: DEFAULT_ONNX_MODEL.modelHost, kind: "model-fetch" },
      ]),
    );
    const modelUrl = `https://${DEFAULT_ONNX_MODEL.modelHost}/${DEFAULT_ONNX_MODEL.modelId}/resolve/${DEFAULT_ONNX_MODEL.revision}/onnx/model.onnx`;

    // The sanctioned model-fetch request passes.
    expect(guard.assertAllowedFor(modelUrl, "model-fetch").hostname).toBe(
      DEFAULT_ONNX_MODEL.modelHost,
    );

    // Purpose-binding: the model host may NOT serve a rented-backend request (a Bearer never crosses).
    try {
      guard.assertAllowedFor(modelUrl, "rented-backend");
      throw new Error("expected a purpose-binding AuthzError");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthzError);
      const details: Record<string, unknown> =
        (err as AuthzError).details ?? {};
      expect(details.required).toBe("rented-backend");
      expect(details.actual).toBe("model-fetch");
    }

    // A non-allowlisted host is refused (fail-closed-to-offline, no silent fallback).
    expect(() =>
      guard.assertAllowedFor("https://evil.example.com/x", "model-fetch"),
    ).toThrow(AuthzError);
  });
});
