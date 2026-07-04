// Multi-harness emit golden test (ADR-0013 golden-first). The shared `matchGolden` harness pins a
// SINGLE file; an emit bundle is a TREE (`.claude/`, `AGENTS.md`, `.cursor/`), so this scaffold adds a
// tree-aware matcher with the same BLESS semantics: `BLESS=1` (re)writes `__golden__/emit/`, otherwise
// every produced file must exist + match byte-for-byte AND no stale file may linger (full-tree
// equivalence). GREEN after BLESS today (echo); enforces the emitter's output byte-for-byte once it lands.
import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { agentDevGolden, type EmittedBundle } from "./golden.ts";

function blessEnabled(): boolean {
  const v = process.env.BLESS;
  return (
    v !== undefined && v !== "" && v !== "0" && v.toLowerCase() !== "false"
  );
}

/** Every file under `root`, returned as POSIX bundle-relative paths, sorted (deterministic). */
function walkFiles(root: string, base: string = root): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, base));
    } else {
      out.push(relative(base, full).split(sep).join("/"));
    }
  }
  return out.sort();
}

describe("agent-dev multi-harness emit golden (ADR-0013 golden-first · ADR-0066)", () => {
  const emitCase = agentDevGolden.cases.find((c) => c.name === "emit");

  test("the emit golden case is declared", () => {
    expect(emitCase).toBeDefined();
  });

  test("emitted bundle matches the committed __golden__/emit/ tree", async () => {
    if (!emitCase) throw new Error("emit golden case missing");
    const bundle = (await emitCase.produce(emitCase.input)) as EmittedBundle;
    const emitDir = join(
      dirname(fileURLToPath(import.meta.url)),
      "__golden__",
      "emit",
    );

    if (blessEnabled()) {
      rmSync(emitDir, { recursive: true, force: true });
      for (const file of bundle.files) {
        const dest = join(emitDir, file.path);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, file.content);
      }
      return;
    }

    // Every produced file exists in the committed tree and matches byte-for-byte.
    for (const file of bundle.files) {
      const dest = join(emitDir, file.path);
      if (!existsSync(dest)) {
        throw new Error(
          `golden fixture missing: ${dest}\n  create it with:  BLESS=1 bun test ./packages/agent-dev`,
        );
      }
      expect(readFileSync(dest, "utf8")).toBe(file.content);
    }

    // No stale/extra file may linger beyond what the emitter produces (full-tree equivalence).
    expect(walkFiles(emitDir)).toEqual(bundle.files.map((f) => f.path).sort());
  });
});
