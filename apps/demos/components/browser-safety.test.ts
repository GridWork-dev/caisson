// The whole demo app's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build.
//
// WHY NOT A BUILD: `next build` does not fail on a node builtin in a browser graph, it SUBSTITUTES
// one. A `node:crypto` import that reaches a client component makes the bundler swap in
// crypto-browserify and the chunk silently grows by ~428KB of polyfill, exit 0, no warning. So
// "the demos build is green" says nothing about this, and this file is the proof instead.
//
// WHY THIS FILE EXISTS ON TOP OF THE PER-POKE TESTS: each poke's own test walks its own entry, so
// a poke that ships with a test is already covered. This walk is keyed off POKE_IDS — the list the
// embed routes are generated from — so a poke added to the app WITHOUT its own test still gets
// walked here, and the app shell (layout, registry, frame chrome) that no per-poke test reaches
// gets walked at all. It is the app-level backstop, not a duplicate.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before this app consumes them.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";

import { POKE_IDS } from "./poke/ids";

const WORKSPACE_ROOT = join(import.meta.dir, "../../..");
const APP_DIR = join(import.meta.dir, "..");

/**
 * Every file the browser is asked to run: one entry per embed route, plus the client shell around
 * them. Each poke is listed BY PATH rather than reached through `registry.tsx`, because the walker
 * cannot follow `await import(...)` (its documented blind spot) and every registry entry is a
 * `next/dynamic` call — walking the registry alone would reach one file and report a clean graph.
 *
 * `app/layout.tsx` and the embed route are deliberately absent: both are server components that
 * ship no client JS, and both reach their imports through the `@/*` path alias, which this walker
 * classifies as an external package and does not follow. Listing them would look like coverage
 * while proving nothing.
 */
const CLIENT_ENTRIES: readonly string[] = [
  ...POKE_IDS.map((id) => join(APP_DIR, "components/poke", `${id}-poke.tsx`)),
  join(APP_DIR, "components/poke/registry.tsx"),
  join(APP_DIR, "components/poke/poke-rig.tsx"),
  join(APP_DIR, "components/media-frame.tsx"),
];

describe("every client entry in apps/demos is browser-safe", () => {
  test("each POKE_IDS entry resolves to a real component file", () => {
    // Guard the guard: the walk below reads each entry off disk, and a walker handed a path that
    // does not exist would throw rather than pass — but a TYPO'd id that happened to name another
    // real file would pass silently. Asserting the id→file mapping separately keeps the failure
    // legible, and pins the `<id>-poke.tsx` convention the embed routes depend on.
    for (const id of POKE_IDS) {
      const entry = join(APP_DIR, "components/poke", `${id}-poke.tsx`);
      expect(existsSync(entry), `${id}: no ${id}-poke.tsx`).toBe(true);
    }
    expect(POKE_IDS.length).toBeGreaterThan(20);
  });

  for (const entry of CLIENT_ENTRIES) {
    const label = entry.slice(APP_DIR.length + 1);

    test(`${label} reaches no node builtin, and skipped no edge`, () => {
      const walk = nodeBuiltinTaint(entry, { workspaceRoot: WORKSPACE_ROOT });
      expect(walk.offenders).toEqual([]);
      // An edge the resolver declined is indistinguishable from a clean one, so an unresolved
      // edge is a failure here, not a warning — otherwise the zero-offender claim above is only
      // provably true for the edges that happened to resolve.
      expect(walk.unresolved).toEqual([]);
    });
  }

  test("positive control: the walker still reports real builtins (it is not blind)", () => {
    // Walk a deliberately node-only entry. If this ever comes back clean, the walker has stopped
    // seeing `node:` specifiers and every assertion above is passing on nothing.
    const walk = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/kernel/src/node.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(walk.offenders.length).toBeGreaterThan(0);
  });
});
