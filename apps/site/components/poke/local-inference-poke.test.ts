import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  nodeBuiltinTaint,
  nodeGlobalTaint,
} from "@caisson/testing/module-graph";
import {
  DEFAULT_ONNX_MODEL,
  EMBEDDING_DIM,
  StubInferenceBackend,
} from "@caisson/local-inference/browser";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "local-inference-poke.tsx");
const RETIRED_MIRROR = join(import.meta.dir, "local-inference-logic.ts");

describe("the local-inference poke runs the package's browser-safe stub", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("the client graph reaches the real browser entry without node taint", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
    expect(walk.files).toContain("packages/local-inference/src/browser.ts");
    expect(walk.files).toContain("packages/local-inference/src/stub.ts");
    expect(
      nodeGlobalTaint(walk.files, { workspaceRoot: WORKSPACE_ROOT }),
    ).toEqual([{ file: "packages/kernel/src/config.ts", spec: "process" }]);
    expect(walk.external).toEqual(["lucide-react", "radix-ui", "react", "zod"]);
  });

  test("the mirror is deleted and the component imports only the package browser entry", () => {
    const source = readFileSync(POKE_ENTRY, "utf8");
    expect(existsSync(RETIRED_MIRROR)).toBe(false);
    expect(source).toMatch(/from "@caisson\/local-inference\/browser";/);
    expect(source).not.toMatch(/from "\.\/local-inference-logic"/);
  });

  test("ONNX, rented transports, credentials, SigV4, and metering stay out", () => {
    for (const excluded of [
      "onnx-backend.ts",
      "rented-backend.ts",
      "openrouter-transport.ts",
      "azure-openai-transport.ts",
      "bedrock-transport.ts",
      "sigv4.ts",
    ]) {
      expect(walk.files).not.toContain(
        `packages/local-inference/src/${excluded}`,
      );
    }
  });

  test("the real stub preserves the package geometry, model coordinates, and golden", async () => {
    const stub = new StubInferenceBackend({ dim: 8 });
    expect(DEFAULT_ONNX_MODEL.dim).toBe(EMBEDDING_DIM);
    expect(stub.model).toBe("caisson-stub-embed");
    expect(Array.from(await stub.embed("offline-first"))).toEqual([
      0.13572371006011963, 0.40440019965171814, -0.6178563833236694,
      -0.30705133080482483, -0.25519251823425293, -0.04712666571140289,
      0.3809182941913605, -0.3599577844142914,
    ]);
  });
});
