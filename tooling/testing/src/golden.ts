// Golden-file regression harness (ADR-0013). A golden file is the serialized expected
// output committed at `__golden__/<name>.<ext>` next to the test. `matchGolden` diffs the
// actual against it and fails on drift; `BLESS=1 bun test` rewrites the fixtures so an update
// lands as a reviewable diff. This is the P0 exit-gate harness and the P2 compliance guard.
import { expect } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function blessEnabled(): boolean {
  const v = process.env.BLESS;
  return (
    v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false"
  );
}

/** Serialize an actual value deterministically: strings verbatim, everything else pretty JSON. */
function serialize(actual: unknown): { body: string; ext: "txt" | "json" } {
  if (typeof actual === "string") return { body: actual, ext: "txt" };
  return { body: `${JSON.stringify(actual, null, 2)}\n`, ext: "json" };
}

/**
 * Compare `actual` against the committed golden fixture `<name>` located in a `__golden__/`
 * directory next to the caller. Pass `import.meta.url` as the first argument so the fixture
 * resolves relative to the test file, not the cwd.
 *
 * With `BLESS=1` the fixture is (re)written instead of compared — the only sanctioned update path.
 */
export function matchGolden(
  metaUrl: string,
  name: string,
  actual: unknown,
): void {
  const { body, ext } = serialize(actual);
  const dir = join(dirname(fileURLToPath(metaUrl)), "__golden__");
  const file = join(dir, `${name}.${ext}`);

  if (blessEnabled()) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, body);
    return;
  }

  if (!existsSync(file)) {
    throw new Error(
      `golden fixture missing: ${file}\n  create it with:  BLESS=1 bun test   (then review the diff)`,
    );
  }
  expect(body).toBe(readFileSync(file, "utf8"));
}
