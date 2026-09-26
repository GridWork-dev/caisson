// This package has ONE entry point and it is browser-safe (ADR-0396): the whole `.` barrel —
// changeset capture included — reaches no node builtin, so a client bundle imports `@caisson-sh/
// local-sync` directly and no `./browser` subset entry exists to drift from it.
//
// Proven by a STATIC SOURCE-GRAPH WALK, never by a build: a bundler does not fail on a node
// builtin, it SUBSTITUTES one (turbopack swaps in crypto-browserify and the client chunk silently
// grows ~428KB, exit 0). The one edge that used to fail was `changeset.ts`'s replica-id mint; it
// now uses the WebCrypto global. `bun:sqlite` never appears because `Database` is a STATEMENT-LEVEL
// `import type`, erased at emit — asserted below rather than assumed.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";

const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const BARREL_ENTRY = join(import.meta.dir, "index.ts");
const CHANGESET_SRC = join(import.meta.dir, "changeset.ts");

describe("the `.` barrel is browser-safe", () => {
  const walk = nodeBuiltinTaint(BARREL_ENTRY, {
    workspaceRoot: WORKSPACE_ROOT,
  });

  test("no module reachable from src/index.ts imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("guard the guard: the walk really resolved a graph, including across packages", () => {
    expect(walk.files).toContain("packages/local-sync/src/changeset.ts");
    expect(walk.files).toContain("packages/local-sync/src/tombstone.ts");
    // The kernel edge is a BARE specifier — this is the assertion that fails if @caisson-sh/*
    // resolution goes blind and the zero-offender result becomes a walk over nothing.
    expect(walk.files).toContain("packages/kernel/src/errors.ts");
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // bun:sqlite is absent because it is type-only. A fourth entry here means a new runtime
    // dependency joined the graph — a review event, not a silent hole in the proof.
    expect(walk.external).toEqual(["zod"]);
  });

  test("the bun:sqlite edge is erased at emit, not merely unwalked", () => {
    const src = readFileSync(CHANGESET_SRC, "utf8");
    expect(src).toMatch(/^import type \{[^}]*\} from "bun:sqlite";$/m);
    // The inline `import { type X }` form — which the walker deliberately reports as a value edge
    // — is affirmatively absent, so erasure stays a compiler guarantee (verbatimModuleSyntax).
    expect(src).not.toMatch(
      /^import \{[^}]*\btype\b[^}]*\} from "bun:sqlite";$/m,
    );
  });

  test("positive control: the same walker reports real builtins on a tainted entry", () => {
    // @caisson-sh/kernel's node-only subpath — the walker's own dependency, so this control cannot
    // rot away independently of the graph under test.
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/kernel/src/node.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
  });
});
