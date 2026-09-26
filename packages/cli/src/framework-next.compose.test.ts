// The ADR-0287 exit gate: the generated Next.js starter is not just golden-fixtured (generate.test.ts)
// — it is actually written to disk and typechecked with `tsc --noEmit` against REAL Next/React/pg/
// @caisson/* packages (the generator composition-test lineage). The run dir sits under
// `packages/cli/dist/` (gitignored) so Node/tsc module resolution walks UP to THIS
// package's own `node_modules` — which is why `next`/`react`/`react-dom`/`pg`/the seven
// base-substrate `@caisson/*` packages this template wires are real `devDependencies` of
// `@caisson/cli` (turbo's `test: { dependsOn: ["^build"] }` builds their `dist/` first).
import { afterEach, describe, test } from "bun:test";
import { execFile as execFileCb } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistryIndex } from "@caisson/registry-schema";
import { generate } from "./generate.ts";
import { createFileSetWriter } from "./writer.ts";

const REPO_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const RUN_PARENT = join(import.meta.dir, "..", "dist");

function execFileAsync(
  cmd: string,
  args: readonly string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFileCb(cmd, args, { cwd }, (error, stdout, stderr) => {
      if (error !== null) {
        reject(new Error(`${error.message}\n${stdout}\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

const manifest = (id: string, version: string) => ({
  id,
  version,
  license: "Apache-2.0" as const,
  dependencies: [] as never[],
  stability: "alpha" as const,
  description: "x",
});
const version = (v: string, id: string) => ({
  version: v,
  manifest: manifest(id, v),
  publishedAt: "2026-06-27T00:00:00.000Z",
  gateAttestation: "ci@x",
});

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson/field-crypto",
      latest: "0.1.0",
      versions: [version("0.1.0", "@caisson/field-crypto")],
    },
  ],
});

const SELECTION = {
  projectName: "acme-next-app",
  modules: [{ id: "@caisson/field-crypto", version: "0.1.0" }],
  framework: "next",
} as const;

let runDir: string | undefined;

afterEach(async () => {
  if (runDir !== undefined) {
    await rm(runDir, { recursive: true, force: true });
    runDir = undefined;
  }
});

describe("framework=next (ADR-0287) — exit gate: the generated app typechecks for real", () => {
  test("tsc --noEmit passes against the fully-generated tree", async () => {
    await mkdir(RUN_PARENT, { recursive: true });
    runDir = await mkdtemp(join(RUN_PARENT, ".next-template-run-"));

    const { files } = generate(INDEX, SELECTION);
    const write = createFileSetWriter();
    await write(runDir, files);

    const tsc = join(REPO_ROOT, "node_modules", ".bin", "tsc");
    await execFileAsync(tsc, ["--noEmit", "-p", "tsconfig.json"], runDir);
  }, 60_000);
});
