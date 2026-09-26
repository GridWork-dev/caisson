// CAISSON-12: proves the root bunfig.toml keeps stale compiled dist/**.test.js output from ever
// shadowing src/ tests again (repro under two service packages and tooling/testing — a bare
// `bun test` from the repo root discovered dist/ copies alongside src/).
// A failing assert here means the config regressed or was deleted.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("root bunfig.toml ignores dist/ during test discovery", () => {
  const raw = readFileSync(
    join(import.meta.dir, "../../../bunfig.toml"),
    "utf8",
  );
  expect(raw).toMatch(/pathIgnorePatterns\s*=\s*\[[^\]]*"\*\*\/dist\/\*\*"/);
});
