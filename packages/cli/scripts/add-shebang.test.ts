// Tests for the post-tsc shebang hook (ADR-0092/0111). The published `create-caisson` bin
// (`./dist/cli.js`) must carry `#!/usr/bin/env node` on line 1 so `npx`/`node` can exec it; tsc
// does not emit one. Covers: prepend, idempotency (no stacked shebangs across repeated builds),
// and fail-closed on a missing build artifact. Pure file IO against a throwaway temp dir.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SHEBANG, ensureShebang } from "./add-shebang.ts";

let dir: string;
let target: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "caisson-shebang-"));
  target = join(dir, "cli.js");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("ensureShebang (ADR-0092/0111)", () => {
  test("prepends the node shebang to a freshly compiled file", () => {
    writeFileSync(target, "import { run } from './index.js';\nrun();\n");
    const added = ensureShebang(target);
    expect(added).toBe(true);
    const body = readFileSync(target, "utf8");
    expect(body.split("\n")[0]).toBe(SHEBANG);
    expect(body).toContain("run();");
  });

  test("is idempotent — a second run does not stack a second shebang", () => {
    writeFileSync(target, "run();\n");
    expect(ensureShebang(target)).toBe(true);
    expect(ensureShebang(target)).toBe(false); // already present
    const body = readFileSync(target, "utf8");
    // Exactly one shebang occurrence, and it is line 1.
    expect(body.match(/#!\/usr\/bin\/env node/g)?.length).toBe(1);
    expect(body.startsWith(`${SHEBANG}\n`)).toBe(true);
  });

  test("fail-closed: a missing build artifact throws (hook must run after tsc)", () => {
    expect(() => ensureShebang(join(dir, "does-not-exist.js"))).toThrow(
      /not found/,
    );
  });
});
