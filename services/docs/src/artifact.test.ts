import { afterEach, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Corpus } from "./corpus.ts";
import { FakeEmbedder } from "./embedder.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true });
});

const CORPUS: Corpus = {
  chunks: [
    {
      id: "billing-webhook",
      source: "apps/site/content/docs/base/billing.mdx",
      title: "Billing",
      section: "Webhooks",
      kind: "docs",
      license: "Apache-2.0",
      text: "Billing webhooks use a timing-safe signature check.",
    },
  ],
  pages: [
    {
      source: "apps/site/content/docs/base/billing.mdx",
      title: "Billing",
      description: "Billing primitives.",
      kind: "docs",
      license: "Apache-2.0",
    },
  ],
};

test("versioned checksummed artifact round-trips into a queryable index", async () => {
  const modulePath = `${import.meta.dir}/artifact.ts`;
  expect(await Bun.file(modulePath).exists()).toBe(true);
  const { loadDocsArtifact, writeDocsArtifact } = await import(modulePath);
  const outputDir = mkdtempSync(join(tmpdir(), "caisson-docs-artifact-test-"));
  tempDirs.push(outputDir);

  const manifest = await writeDocsArtifact({ outputDir, corpus: CORPUS });
  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.contentVersion).toMatch(/^[a-f0-9]{64}$/);
  expect(manifest.index.file).toBe(`index-${manifest.index.sha256}.sqlite`);

  const loaded = await loadDocsArtifact({
    manifestPath: join(outputDir, "manifest.json"),
  });
  try {
    expect(loaded.contentVersion).toBe(manifest.contentVersion);
    expect(loaded.llmsTxt).toContain("Billing");
    expect((await loaded.index.search("billing"))[0]?.id).toBe(
      "billing-webhook",
    );
  } finally {
    loaded.close();
  }
});

test("an FTS artifact upgrades to the runtime embedder dimension", async () => {
  const { loadDocsArtifact, writeDocsArtifact } = await import("./artifact.ts");
  const outputDir = mkdtempSync(join(tmpdir(), "caisson-docs-artifact-test-"));
  tempDirs.push(outputDir);
  const manifest = await writeDocsArtifact({ outputDir, corpus: CORPUS });
  expect(manifest.index.dim).toBe(1);

  const delegate = new FakeEmbedder(8);
  let embedCalls = 0;
  const loaded = await loadDocsArtifact({
    manifestPath: join(outputDir, "manifest.json"),
    queryEmbedder: {
      dim: delegate.dim,
      embed: async (text) => {
        embedCalls++;
        return delegate.embed(text);
      },
    },
  });
  try {
    expect(embedCalls).toBe(CORPUS.chunks.length);
    await loaded.index.search("billing webhook");
    expect(embedCalls).toBe(CORPUS.chunks.length + 1);
  } finally {
    loaded.close();
  }
});

test("artifact load rejects a partial or tampered SQLite index", async () => {
  const { loadDocsArtifact, writeDocsArtifact } = await import("./artifact.ts");
  const outputDir = mkdtempSync(join(tmpdir(), "caisson-docs-artifact-test-"));
  tempDirs.push(outputDir);
  const manifest = await writeDocsArtifact({ outputDir, corpus: CORPUS });
  appendFileSync(join(outputDir, manifest.index.file), "tampered");

  await expect(
    loadDocsArtifact({ manifestPath: join(outputDir, "manifest.json") }),
  ).rejects.toThrow("checksum");
});
