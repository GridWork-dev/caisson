// Scanner TEST for the demo-excerpts manifest (CAISSON-110 T3). Not a runtime scanner — a test
// that fails red if either invariant breaks:
//   1. every manifest entry's embedded content is clean per detectSecretShape (no credential shape).
//   2. every manifest entry's embedded content matches its declared sourcePath's real file content,
//      byte-for-byte (drift between the frozen manifest copy and the live source = red).
//
// ponytail: reads sourcePath straight off the worktree rather than `git show <sourceCommit>:<path>`
// — these source files are owned by other packages and aren't touched by this task, so the worktree
// content already equals HEAD for them. Upgrade to a `git show` comparison if that stops holding.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_EXCERPTS } from "../../apps/site/lib/demo-excerpts/manifest.ts";
import { detectSecretShape } from "./detect-shapes.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");

describe("demo-excerpts manifest", () => {
  test("has at least 2 entries", () => {
    expect(DEMO_EXCERPTS.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_EXCERPTS.length).toBeLessThanOrEqual(3);
  });

  for (const entry of DEMO_EXCERPTS) {
    describe(entry.id, () => {
      test("passes the credential-shape scan", () => {
        expect(detectSecretShape(entry.content)).toBeUndefined();
      });

      test("matches its sourcePath content at HEAD byte-for-byte", () => {
        const real = readFileSync(join(REPO_ROOT, entry.sourcePath), "utf8");
        expect(entry.content).toBe(real);
      });

      test("carries the fixed manifest shape", () => {
        expect(entry.approvedBy).toBe("operator");
        expect(entry.licensePosture).toBe("Apache-2.0");
        expect(entry.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
        expect(entry.content.length).toBeGreaterThan(0);
      });
    });
  }
});
