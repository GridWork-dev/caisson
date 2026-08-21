// Runtime entrypoint: validate and load the prebuilt local artifact, then bind once ready. Corpus
// discovery, FTS construction, and document embedding belong to build-artifact.ts, never cold start.
import { join } from "node:path";
import { loadOriginGateConfig } from "@caisson/kernel/node";
import { initObservability } from "@caisson/observability";
import { createApp } from "./app.ts";
import { loadDocsArtifact } from "./artifact.ts";
import { createOpenRouterEmbedder } from "./openrouter-embedder.ts";
import { loadRateLimitConfig, TokenBucketLimiter } from "./rate-limit.ts";

const DEFAULT_PORT = 8788;

function artifactLoadTimeoutMs(
  env: Record<string, string | undefined>,
): number | undefined {
  const raw = env.DOCS_ARTIFACT_LOAD_TIMEOUT_MS?.trim() ?? "";
  if (raw === "") return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 30_000) {
    throw new Error(
      "DOCS_ARTIFACT_LOAD_TIMEOUT_MS must be an integer from 1000 to 30000",
    );
  }
  return parsed;
}

export async function startServer(): Promise<{
  port: number;
  stop: () => void;
}> {
  initObservability({ serviceName: "service-docs" });
  const originGate = loadOriginGateConfig(process.env);
  const token = process.env.DOCS_SERVICE_TOKEN ?? "";
  if (token.length === 0) {
    throw new Error(
      "DOCS_SERVICE_TOKEN is required (POST /query is fail-closed) — refusing to start.",
    );
  }

  const port = Number(process.env.PORT || DEFAULT_PORT);
  const manifestPath =
    process.env.DOCS_INDEX_ARTIFACT_PATH?.trim() ||
    join(import.meta.dir, "..", "artifact", "manifest.json");
  const key = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  const timeoutMs = artifactLoadTimeoutMs(process.env);
  const artifact = await loadDocsArtifact({
    manifestPath,
    ...(key !== ""
      ? { queryEmbedder: createOpenRouterEmbedder({ apiKey: key }) }
      : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  });
  const handler = createApp({
    index: artifact.index,
    llmsTxt: artifact.llmsTxt,
    llmsFull: artifact.llmsFull,
    token,
    limiter: new TokenBucketLimiter(loadRateLimitConfig()),
    originGate,
  });

  try {
    const server = Bun.serve({
      port,
      fetch: handler,
      maxRequestBodySize: 512 * 1024,
    });
    process.stderr.write(
      `[service-docs] serving artifact ${artifact.contentVersion} (${String(artifact.index.size)} chunks) on :${server.port}\n`,
    );
    return {
      port: server.port ?? port,
      stop: () => {
        server.stop(true);
        artifact.close();
      },
    };
  } catch (error) {
    artifact.close();
    throw error;
  }
}

if (import.meta.main) await startServer();
