import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { Embedder } from "@caisson/local-store";
import type { Corpus } from "./corpus.ts";
import { DocsIndex } from "./index-store.ts";
import { renderLlmsFull, renderLlmsTxt } from "./llms-txt.ts";
import { DocChunkSchema, DocKindSchema } from "./types.ts";

const ARTIFACT_SCHEMA_VERSION = 1;
const MANIFEST_FILE = "manifest.json";
const FTS_FLOOR_DIM = 1;
const DEFAULT_LOAD_TIMEOUT_MS = 5_000;
const MAX_MANIFEST_BYTES = 32 * 1024 * 1024;
const MAX_INDEX_BYTES = 256 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;
const INDEX_FILE = /^index-[a-f0-9]{64}\.sqlite$/;

const DocPageSchema = z
  .object({
    source: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    kind: DocKindSchema,
    pkg: z.string().min(1).optional(),
    license: z.string().min(1),
  })
  .strict();

const ArtifactBodySchema = z
  .object({
    schemaVersion: z.literal(ARTIFACT_SCHEMA_VERSION),
    index: z
      .object({
        file: z.string().regex(INDEX_FILE),
        sha256: z.string().regex(SHA256),
        bytes: z.number().int().positive().max(MAX_INDEX_BYTES),
        dim: z.number().int().positive(),
      })
      .strict(),
    chunks: z.array(DocChunkSchema).min(1),
    pages: z.array(DocPageSchema).min(1),
    llmsTxt: z.string().min(1),
    llmsFull: z.string().min(1),
  })
  .strict();

export const DocsArtifactManifestSchema = ArtifactBodySchema.extend({
  contentVersion: z.string().regex(SHA256),
}).strict();
export type DocsArtifactManifest = z.infer<typeof DocsArtifactManifestSchema>;

function sha256(data: string | ArrayBuffer | Uint8Array): string {
  const input =
    typeof data === "string"
      ? data
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  return createHash("sha256").update(input).digest("hex");
}

function bodyVersion(body: z.infer<typeof ArtifactBodySchema>): string {
  return sha256(JSON.stringify(body));
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} exceeded ${String(timeoutMs)}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export interface WriteDocsArtifactOptions {
  outputDir: string;
  corpus: Corpus;
  embedder?: Embedder;
  origin?: string;
  embedPhaseDeadlineMs?: number;
}

export async function writeDocsArtifact(
  opts: WriteDocsArtifactOptions,
): Promise<DocsArtifactManifest> {
  mkdirSync(opts.outputDir, { recursive: true });
  const buildId = randomUUID();
  const pendingIndex = join(opts.outputDir, `index-${buildId}.tmp`);
  const pendingManifest = join(
    opts.outputDir,
    `${MANIFEST_FILE}-${buildId}.tmp`,
  );

  const index = await DocsIndex.build(opts.corpus.chunks, opts.embedder, {
    storePath: pendingIndex,
    ...(opts.embedPhaseDeadlineMs !== undefined
      ? { embedPhaseDeadlineMs: opts.embedPhaseDeadlineMs }
      : {}),
  });
  index.close();

  const indexBytes = readFileSync(pendingIndex);
  if (indexBytes.byteLength > MAX_INDEX_BYTES) {
    throw new Error("docs index artifact exceeds the maximum size");
  }
  const indexSha256 = sha256(indexBytes);
  const indexFile = `index-${indexSha256}.sqlite`;
  const body = ArtifactBodySchema.parse({
    schemaVersion: ARTIFACT_SCHEMA_VERSION,
    index: {
      file: indexFile,
      sha256: indexSha256,
      bytes: indexBytes.byteLength,
      dim: opts.embedder?.dim ?? FTS_FLOOR_DIM,
    },
    chunks: opts.corpus.chunks,
    pages: opts.corpus.pages,
    llmsTxt: renderLlmsTxt(
      opts.corpus,
      opts.origin !== undefined ? { origin: opts.origin } : {},
    ),
    llmsFull: renderLlmsFull(opts.corpus),
  });
  const manifest = DocsArtifactManifestSchema.parse({
    ...body,
    contentVersion: bodyVersion(body),
  });

  renameSync(pendingIndex, join(opts.outputDir, indexFile));
  writeFileSync(pendingManifest, `${JSON.stringify(manifest)}\n`);
  renameSync(pendingManifest, join(opts.outputDir, MANIFEST_FILE));
  return manifest;
}

export interface LoadDocsArtifactOptions {
  manifestPath: string;
  queryEmbedder?: Embedder;
  timeoutMs?: number;
}

export interface LoadedDocsArtifact {
  contentVersion: string;
  index: DocsIndex;
  llmsTxt: string;
  llmsFull: string;
  close(): void;
}

export async function loadDocsArtifact(
  opts: LoadDocsArtifactOptions,
): Promise<LoadedDocsArtifact> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
  const manifestFile = Bun.file(opts.manifestPath);
  if (manifestFile.size > MAX_MANIFEST_BYTES) {
    throw new Error("docs artifact manifest exceeds the maximum size");
  }
  const rawManifest = await withTimeout(
    manifestFile.text(),
    timeoutMs,
    "docs artifact manifest load",
  );
  const manifest = DocsArtifactManifestSchema.parse(JSON.parse(rawManifest));
  const { contentVersion, ...body } = manifest;
  if (bodyVersion(ArtifactBodySchema.parse(body)) !== contentVersion) {
    throw new Error("docs artifact manifest checksum mismatch");
  }

  const indexPath = join(dirname(opts.manifestPath), manifest.index.file);
  const size = statSync(indexPath).size;
  if (size !== manifest.index.bytes || size > MAX_INDEX_BYTES) {
    throw new Error("docs artifact index size/checksum mismatch");
  }
  const indexBuffer = await withTimeout(
    Bun.file(indexPath).arrayBuffer(),
    timeoutMs,
    "docs artifact index load",
  );
  if (sha256(indexBuffer) !== manifest.index.sha256) {
    throw new Error("docs artifact index checksum mismatch");
  }

  const runtimePath = join(
    tmpdir(),
    `caisson-docs-${contentVersion}-${randomUUID()}.sqlite`,
  );
  await withTimeout(
    Bun.write(runtimePath, indexBuffer),
    timeoutMs,
    "docs artifact local copy",
  );
  const index = DocsIndex.load(
    manifest.chunks,
    runtimePath,
    manifest.index.dim,
    opts.queryEmbedder?.dim === manifest.index.dim
      ? opts.queryEmbedder
      : undefined,
  );
  return {
    contentVersion,
    index,
    llmsTxt: manifest.llmsTxt,
    llmsFull: manifest.llmsFull,
    close(): void {
      index.close();
      try {
        unlinkSync(runtimePath);
      } catch (error) {
        const code =
          error instanceof Error && "code" in error
            ? String(error.code)
            : "unknown";
        process.stderr.write(
          `[service-docs] artifact temp cleanup failed (${code})\n`,
        );
      }
    },
  };
}
