// src/server.ts — the runnable entrypoint (ADR-0096). Builds the corpus + index ONCE at boot, renders
// the llms artifacts, and serves the router over Bun.serve. Fail-closed: a missing DOCS_SERVICE_TOKEN
// aborts startup rather than serving an open /query.
//
// Retrieval mode is chosen at boot by the presence of OPENROUTER_API_KEY (the ADR-0096 DEPLOY wire):
//   • key present → the live OpenRouter `qwen3-embedding-8b` embedder lights up the hybrid vector leg
//     (semantic recall). A failure building that leg (OpenRouter down / bad key / dim drift) DEGRADES to
//     the FTS5 floor rather than crash-looping the service — the floor is the honest degraded mode.
//   • no key (CI / local / offline) → the deterministic FTS5 floor alone: a natural-language sentence
//     with no exact match returns [] rather than a confidently-wrong chunk.
import { join } from "node:path";
import { initObservability } from "@caisson/observability";
import { createApp, SECURITY_HEADERS } from "./app.ts";
import { buildCorpus, loadPricingFacts } from "./corpus.ts";
import { CachedEmbedder } from "./embed-cache.ts";
import { DocsIndex } from "./index-store.ts";
import { renderLlmsFull, renderLlmsTxt } from "./llms-txt.ts";
import {
  createOpenRouterEmbedder,
  OPENROUTER_EMBED_MODEL,
} from "./openrouter-embedder.ts";
import { loadRateLimitConfig, TokenBucketLimiter } from "./rate-limit.ts";
import type { DocChunk } from "./types.ts";

const DEFAULT_PORT = 8788;

const WARMUP_HEADERS: Record<string, string> = {
  ...SECURITY_HEADERS,
  "content-type": "application/json",
  "Cache-Control": "no-store",
};

/** Served on every route while the corpus/index is still building. A real listener answering a
 * deterministic 503 replaces what used to be nothing bound to the port yet — the gap a Railway
 * redeploy of a growing corpus actually hit: the fronting proxy sees a refused/reset connection
 * and reports it as a 502 for the whole boot-embedding phase, indistinguishable from a crash. */
function warmupHandler(req: Request): Response {
  const path = new URL(req.url).pathname;
  const body =
    path === "/health"
      ? { ok: false, warming: true }
      : { error: "service warming up" };
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: WARMUP_HEADERS,
  });
}

/**
 * Build the retrieval index. Wires the live OpenRouter embedder when OPENROUTER_API_KEY is set (hybrid
 * semantic + FTS5), else the deterministic FTS5 floor. A throw while building the vector leg (provider
 * outage, bad key, dim drift) is caught and degraded to the floor — a degraded answer beats a crash-loop.
 * (Per-chunk embed failures never reach this throw at all — DocsIndex.build degrades those internally,
 * both on individual failure and once its own embed-phase deadline passes; this catch covers a hard
 * failure before/outside that loop, e.g. the store itself failing to open.)
 */
/** Durable cache-file location: explicit `DOCS_EMBED_CACHE_PATH` wins; else the Railway volume
 *  (Railway injects `RAILWAY_VOLUME_MOUNT_PATH` when one is attached); else no persistence —
 *  the pre-cache behavior, every boot re-embeds. */
function embedCachePath(): string | undefined {
  const explicit = process.env.DOCS_EMBED_CACHE_PATH ?? "";
  if (explicit.length > 0) return explicit;
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? "";
  if (volume.length > 0) return join(volume, "embed-cache.json");
  return undefined;
}

/** Optional `DOCS_EMBED_PHASE_DEADLINE_MS` override — the 180s default plus a cold cache covers
 *  only ~80 of the corpus's chunks per boot (2026-07-10 prod finding: 77/489 embedded, the vec
 *  leg stuck on the alphabetically-first chunks). Bounded 1s..30min; junk falls back to default. */
function embedPhaseDeadlineMs(): number | undefined {
  const raw = process.env.DOCS_EMBED_PHASE_DEADLINE_MS ?? "";
  if (raw.length === 0) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 1_800_000) {
    process.stderr.write(
      `[service-docs] ignoring invalid DOCS_EMBED_PHASE_DEADLINE_MS: ${raw}\n`,
    );
    return undefined;
  }
  return parsed;
}

async function buildIndex(chunks: DocChunk[]): Promise<DocsIndex> {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  if (key.length === 0) {
    process.stderr.write(
      "[service-docs] no OPENROUTER_API_KEY — FTS5 floor only\n",
    );
    return DocsIndex.build(chunks);
  }
  process.stderr.write(
    `[service-docs] embedding ${String(chunks.length)} chunks (OpenRouter qwen3-embedding-8b)...\n`,
  );
  try {
    // Content-hash cache between boots (embed-cache.ts): only chunks whose text/model/dim changed
    // pay a network call — an unchanged-corpus redeploy costs zero embedding calls.
    const cachePath = embedCachePath();
    const embedder =
      cachePath !== undefined
        ? new CachedEmbedder(
            createOpenRouterEmbedder({ apiKey: key }),
            cachePath,
            OPENROUTER_EMBED_MODEL,
          )
        : createOpenRouterEmbedder({ apiKey: key });
    const deadline = embedPhaseDeadlineMs();
    const index = await DocsIndex.build(
      chunks,
      embedder,
      deadline !== undefined ? { embedPhaseDeadlineMs: deadline } : undefined,
    );
    if (embedder instanceof CachedEmbedder) {
      // save() is internally fail-soft, but guard here too: a cache-persist problem must never
      // send an already-successfully-built semantic index down the FTS-floor catch below.
      try {
        embedder.save();
        process.stderr.write(
          `[service-docs] embed cache: ${String(embedder.hits)} hits / ${String(embedder.misses)} misses (${cachePath ?? ""})\n`,
        );
      } catch {
        // losing a cache write only costs a future re-embed
      }
    }
    process.stderr.write(
      "[service-docs] semantic index built (OpenRouter qwen3-embedding-8b, 1024-dim)\n",
    );
    return index;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[service-docs] embedder build failed — degrading to FTS5 floor: ${msg}\n`,
    );
    return DocsIndex.build(chunks);
  }
}

export async function startServer(): Promise<{
  port: number;
  stop: () => void;
}> {
  // ADR-0117: wired first, before any other boot work — instrumentation must be live before the
  // modules it patches (node:http, pg) are first required. Env-gated: a no-op when
  // OTEL_EXPORTER_OTLP_ENDPOINT is unset (CI / local / no OTLP sink configured).
  initObservability({ serviceName: "service-docs" });

  const token = process.env.DOCS_SERVICE_TOKEN ?? "";
  if (token.length === 0) {
    throw new Error(
      "DOCS_SERVICE_TOKEN is required (POST /query is fail-closed) — refusing to start.",
    );
  }
  // `||` not `??`: a blank PORT="" must fall back to the default, not coerce to Number("")=0 (ephemeral).
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const origin = process.env.DOCS_SITE_ORIGIN;

  // Bind the port BEFORE the (potentially minutes-long, on a large/degraded-provider corpus) build
  // below, so a health check or the fronting proxy sees a real, immediate 503 the whole time instead
  // of a refused connection reported upstream as a 502. `.reload()` swaps in the real handler in
  // place once ready — no restart, no port gap.
  // maxRequestBodySize caps every route BEFORE buffering (CWE-770, Kickoff-K defense-in-depth): Bun's
  // 128 MiB default is far above any real /query body. reload() below swaps only the fetch handler, not
  // this server-level option, so the cap persists once the real handler is live. 512 KiB matches the
  // license issuer's cap and the repo's MAX_BODY_BYTES idiom.
  const server = Bun.serve({
    port,
    fetch: warmupHandler,
    maxRequestBodySize: 512 * 1024,
  });
  process.stderr.write(
    `[service-docs] listening on :${server.port} (warming up)\n`,
  );

  // ADR-0234 F4: fold the pricing/edition/module facts into the corpus, rendered from the pricebook/
  // catalog source of truth. Fail-soft — a missing/malformed SOT degrades to the docs-only corpus
  // (a pricing gap is better than a crash-loop), matching the embedder-degrade posture below.
  const pricingFacts = await loadPricingFacts().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[service-docs] pricing facts unavailable — docs-only corpus: ${msg}\n`,
    );
    return null;
  });
  const corpus = buildCorpus(pricingFacts !== null ? { pricingFacts } : {});
  const index = await buildIndex(corpus.chunks);
  const llmsTxt = renderLlmsTxt(corpus, origin !== undefined ? { origin } : {});
  const llmsFull = renderLlmsFull(corpus);

  // Per-IP token-bucket limiter (hardening #1). Config is Zod-validated from env with safe defaults; a
  // present-but-invalid limit fails startup closed rather than serving with a silently-wrong budget.
  const limiter = new TokenBucketLimiter(loadRateLimitConfig());
  const handler = createApp({ index, llmsTxt, llmsFull, token, limiter });
  server.reload({ fetch: handler });
  process.stderr.write(
    `[service-docs] serving ${corpus.chunks.length} chunks on :${server.port}\n`,
  );
  return { port: server.port ?? port, stop: () => server.stop(true) };
}

if (import.meta.main) {
  await startServer();
}
