// Asserts the COMMITTED demo-preview artifacts (apps/site/public/demo-preview/*.json) parse and
// carry their expected sections. Does NOT re-run generate.ts (that hits the network and a real
// registry) — this is the "does the shared artifact still look sane" smoke test the /demo page's
// prebuilt preview pane (PLAN T2 §b) depends on.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { PreviewSchema } from "../../apps/site/components/demo/preview-schema";
import { previewOutput } from "./generate";

const DIR = join(import.meta.dir, "../../apps/site/public/demo-preview");

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await Bun.file(join(DIR, name)).text());
}

describe("demo-preview committed artifacts", () => {
  test("failed steps retain stderr before bounded stdout", () => {
    const stderr = "terminal failure";
    const output = previewOutput({
      exitCode: 1,
      stderr,
      stdout: "x".repeat(20_000),
    });
    expect(output.startsWith(stderr)).toBe(true);
    expect(output.length).toBe(20_000);
  });

  test("manifest.json parses and carries a nonempty tree + step results", async () => {
    const manifest = (await readJson("manifest.json")) as {
      projectName: string;
      tree: { path: string; bytes: number }[];
      totalTreeBytes: number;
      steps: Record<string, { exitCode: number | null } | null>;
    };
    expect(manifest.projectName).toBe("caisson-demo");
    expect(Array.isArray(manifest.tree)).toBe(true);
    expect(manifest.tree.length).toBeGreaterThan(0);
    expect(manifest.totalTreeBytes).toBeGreaterThan(0);
    expect(manifest.totalTreeBytes).toBeLessThanOrEqual(400_000);
    for (const entry of manifest.tree) {
      expect(typeof entry.path).toBe("string");
      expect(entry.path.length).toBeGreaterThan(0);
      expect(typeof entry.bytes).toBe("number");
    }
    expect(manifest.steps.install).not.toBeNull();
    expect(manifest.steps.build).not.toBeNull();
    expect(manifest.steps.test).not.toBeNull();
  });

  test("preview.json satisfies the T2 reader contract with every step passing", async () => {
    // THE seam guard (writer: tools/demo-preview/generate.ts · reader: apps/site/components/demo/
    // preview-data.ts): the committed file must parse against the READER's schema — a shape drift
    // here is exactly the class that shipped a permanently-dark preview pane. All steps must be
    // ok:true — a failing install/build/test transcript is a real product finding that must never
    // render as the "proof it runs" pane; regenerate against a healthy registry instead.
    const preview = PreviewSchema.parse(await readJson("preview.json"));
    expect(preview.steps.length).toBeGreaterThanOrEqual(3);
    for (const s of preview.steps) {
      expect(`${s.label}: ${s.ok ? "ok" : "FAILED"}`).toBe(`${s.label}: ok`);
    }
    expect(preview.fileManifest.length).toBeGreaterThan(0);
  });

  test("no committed artifact leaks an absolute /home or /Users path", async () => {
    for (const name of ["preview.json", "manifest.json"]) {
      const raw = await Bun.file(join(DIR, name)).text();
      expect(raw).not.toMatch(/\/(?:home|Users)\/[^/\s"]+/);
    }
  });
});
