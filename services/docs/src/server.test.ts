import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Corpus } from "./corpus.ts";
import { writeDocsArtifact } from "./artifact.ts";
import { startServer } from "./server.ts";

test("runtime server only loads a prebuilt artifact", async () => {
  const source = await Bun.file(`${import.meta.dir}/server.ts`).text();
  expect(source).not.toContain("DocsIndex.build");
  expect(source).not.toContain("buildCorpus");
  expect(source).not.toContain("RAILWAY_VOLUME_MOUNT_PATH");
  expect(source).not.toContain("warmupHandler");
  expect(source).toContain("loadDocsArtifact");
});

test("image builds the artifact before switching to the non-root runtime", async () => {
  const entry = `${import.meta.dir}/build-artifact.ts`;
  expect(await Bun.file(entry).exists()).toBe(true);
  const buildSource = await Bun.file(entry).text();
  expect(buildSource).toContain("DOCS_INDEX_EMBED");
  const dockerfile = await Bun.file(`${import.meta.dir}/../Dockerfile`).text();
  expect(dockerfile).toContain("RUN bun services/docs/src/build-artifact.ts");
  expect(dockerfile).toContain("USER bun");
  expect(dockerfile).not.toContain("entrypoint.sh");
  const dockerignore = await Bun.file(
    `${import.meta.dir}/../../../.dockerignore`,
  ).text();
  expect(dockerignore).toContain("services/docs/artifact");
});

test("server binds ready with real responses immediately after loading a prebuilt artifact", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "caisson-docs-server-test-"));
  const corpus: Corpus = {
    chunks: [
      {
        id: "ready-doc",
        source: "apps/site/content/docs/index.mdx",
        title: "Caisson",
        section: "Ready",
        kind: "docs",
        license: "LicenseRef-Caisson-Commercial",
        text: "The prebuilt artifact is ready.",
      },
    ],
    pages: [
      {
        source: "apps/site/content/docs/index.mdx",
        title: "Caisson",
        description: "Prebuilt docs.",
        kind: "docs",
        license: "LicenseRef-Caisson-Commercial",
      },
    ],
  };
  await writeDocsArtifact({ outputDir, corpus });
  const previous = {
    token: process.env.DOCS_SERVICE_TOKEN,
    path: process.env.DOCS_INDEX_ARTIFACT_PATH,
    port: process.env.PORT,
    cloudRun: process.env.K_SERVICE,
  };
  process.env.DOCS_SERVICE_TOKEN = "test-docs-token";
  process.env.DOCS_INDEX_ARTIFACT_PATH = join(outputDir, "manifest.json");
  process.env.PORT = "0";
  delete process.env.K_SERVICE;

  let server: Awaited<ReturnType<typeof startServer>> | undefined;
  try {
    server = await startServer();
    const response = await fetch(
      `http://127.0.0.1:${String(server.port)}/ready`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ready: true });
  } finally {
    server?.stop();
    if (previous.token === undefined) delete process.env.DOCS_SERVICE_TOKEN;
    else process.env.DOCS_SERVICE_TOKEN = previous.token;
    if (previous.path === undefined)
      delete process.env.DOCS_INDEX_ARTIFACT_PATH;
    else process.env.DOCS_INDEX_ARTIFACT_PATH = previous.path;
    if (previous.port === undefined) delete process.env.PORT;
    else process.env.PORT = previous.port;
    if (previous.cloudRun === undefined) delete process.env.K_SERVICE;
    else process.env.K_SERVICE = previous.cloudRun;
    rmSync(outputDir, { recursive: true });
  }
});
