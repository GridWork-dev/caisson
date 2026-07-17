// Asserts the COMMITTED demo-preview artifacts (apps/site/public/demo-preview/*.json) parse and
// carry their expected sections. Does NOT re-run generate.ts (that hits the network and a real
// registry) — this is the "does the shared artifact still look sane" smoke test the /demo page's
// prebuilt preview pane (PLAN T2 §b) depends on.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const DIR = join(import.meta.dir, "../../apps/site/public/demo-preview");

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await Bun.file(join(DIR, name)).text());
}

interface Transcript {
  command: string;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
}

function assertTranscriptShape(t: unknown): asserts t is Transcript {
  const x = t as Transcript;
  expect(typeof x.command).toBe("string");
  expect(x.command.length).toBeGreaterThan(0);
  expect(typeof x.exitCode === "number" || x.exitCode === null).toBe(true);
  expect(typeof x.durationMs).toBe("number");
  expect(typeof x.stdout).toBe("string");
  expect(typeof x.stderr).toBe("string");
}

describe("demo-preview committed artifacts", () => {
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

  test("no committed transcript leaks an absolute /home or /Users path", async () => {
    for (const name of [
      "transcript-install.json",
      "transcript-build.json",
      "transcript-test.json",
    ]) {
      const raw = await Bun.file(join(DIR, name)).text();
      expect(raw).not.toMatch(/\/(?:home|Users)\/[^/\s"]+/);
    }
  });

  test.each([
    "transcript-install.json",
    "transcript-build.json",
    "transcript-test.json",
  ])("%s parses to the expected transcript shape", async (name) => {
    const t = await readJson(name);
    assertTranscriptShape(t);
  });

  test("walkthrough.json parses — either a transcript or an honest absence marker", async () => {
    const w = (await readJson("walkthrough.json")) as {
      present?: boolean;
      reason?: string;
    };
    if (w.present === false) {
      expect(typeof w.reason).toBe("string");
      expect((w.reason ?? "").length).toBeGreaterThan(0);
    } else {
      assertTranscriptShape(w);
    }
  });
});
