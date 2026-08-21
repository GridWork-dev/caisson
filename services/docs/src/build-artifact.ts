// Finite build/Cloud Run Job entrypoint: produce the versioned, checksummed docs retrieval artifact.
// Vector construction is explicit (`DOCS_INDEX_EMBED=true`) so an inherited runtime key can never
// turn a normal local/image build into an accidental paid network job. FTS is the default artifact.
import { join } from "node:path";
import { writeDocsArtifact } from "./artifact.ts";
import { buildCorpus, loadPricingFacts } from "./corpus.ts";
import { createOpenRouterEmbedder } from "./openrouter-embedder.ts";

function embedPhaseDeadlineMs(
  env: Record<string, string | undefined>,
): number | undefined {
  const raw = env.DOCS_EMBED_PHASE_DEADLINE_MS?.trim() ?? "";
  if (raw === "") return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1_000 || parsed > 1_800_000) {
    throw new Error(
      "DOCS_EMBED_PHASE_DEADLINE_MS must be an integer from 1000 to 1800000",
    );
  }
  return parsed;
}

export async function main(
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const pricingFacts = await loadPricingFacts().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[service-docs] pricing facts unavailable — docs-only artifact: ${message}\n`,
    );
    return null;
  });
  const corpus = buildCorpus(pricingFacts !== null ? { pricingFacts } : {});
  const embedFlag = env.DOCS_INDEX_EMBED?.trim() ?? "";
  if (embedFlag !== "" && embedFlag !== "true" && embedFlag !== "false") {
    throw new Error("DOCS_INDEX_EMBED must be true, false, or unset");
  }
  const embedRequested = embedFlag === "true";
  const key = env.OPENROUTER_API_KEY?.trim() ?? "";
  if (embedRequested && key === "") {
    throw new Error(
      "OPENROUTER_API_KEY is required when DOCS_INDEX_EMBED=true",
    );
  }
  const outputDir =
    env.DOCS_INDEX_ARTIFACT_DIR?.trim() ||
    join(import.meta.dir, "..", "artifact");
  const deadline = embedPhaseDeadlineMs(env);
  const manifest = await writeDocsArtifact({
    outputDir,
    corpus,
    ...(embedRequested
      ? { embedder: createOpenRouterEmbedder({ apiKey: key }) }
      : {}),
    ...(env.DOCS_SITE_ORIGIN !== undefined
      ? { origin: env.DOCS_SITE_ORIGIN }
      : {}),
    ...(deadline !== undefined ? { embedPhaseDeadlineMs: deadline } : {}),
  });
  process.stderr.write(
    `[service-docs] built artifact ${manifest.contentVersion} (${String(manifest.chunks.length)} chunks, ${String(manifest.index.bytes)} bytes)\n`,
  );
}

if (import.meta.main) await main();
