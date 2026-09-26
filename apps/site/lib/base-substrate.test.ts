import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  BASE_CAPABILITIES,
  BASE_PACKAGES,
  BASE_SUBSTRATE_PACKAGES,
  baseSubstrateList,
} from "./base-substrate";
import { MODULES } from "./catalog";

// The honesty guard for the base-substrate SOT: every listed package exists on disk and is
// Apache-2.0 (every package is), and the prose and capability tiles never drift from the list.
// apps/site/lib -> repo root is three levels up.
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
describe("base substrate SOT", () => {
  test("every base package is SPDX Apache-2.0 on disk", () => {
    for (const p of BASE_PACKAGES) {
      const pkg = JSON.parse(
        readFileSync(join(REPO_ROOT, "packages", p, "package.json"), "utf8"),
      ) as { license?: string };
      expect(pkg.license).toBe("Apache-2.0");
    }
  });

  // THE PROSE ARM, and the reason the two set guards above were not enough (ADR-0412 SHIP review).
  // Both of those compare CODE to DISK. The docs tree is neither: `apps/site/content/**` is
  // hand-written MDX that enumerates the base set in prose, and `docs/cli/create-caisson.mdx` was
  // still rendering the pre-ds-manifest fifteen AFTER the set guards landed — a buyer-facing page
  // that states affirmatively what is free to install. It is not inert copy either: the docs RAG
  // corpus is assembled from this exact tree (`services/docs/src/corpus.ts`), so the support-bot
  // answers "what's free?" from it, and `/llms.txt` re-emits the index.
  //
  // The rule is deliberately mechanical rather than fuzzy: a passage naming ENOUGH_TO_BE_A_LIST of
  // the base packages is enumerating the set, so it has to name all of them. That is checkable
  // without deciding what "enumerates" means in general.
  //
  // Why a guard instead of deriving the list from BASE_PACKAGES in MDX: the RAG corpus indexes the
  // RAW MDX text, so a rendered `{baseSubstrateList()}` component would be INVISIBLE to the corpus
  // and would make the support-bot's answer worse, not better. The literal names have to be in the
  // file; this keeps them right.
  test("no docs page enumerates the base set and leaves a package out", () => {
    const ENOUGH_TO_BE_A_LIST = 8;
    const CONTENT_ROOT = join(REPO_ROOT, "apps", "site", "content");

    const mdx: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".mdx")) mdx.push(full);
      }
    };
    walk(CONTENT_ROOT);
    // Guard the guard: a walk that finds nothing would make this vacuously green.
    expect(mdx.length).toBeGreaterThan(20);

    // A passage may legitimately enumerate EITHER half-set: base/index.mdx lists the 13 substrate
    // packages and names the three generator-tooling ones in the paragraph after it, which is a
    // correct page, not a partial list. So a passage passes if it is complete against either the
    // substrate set or the full set — and drops `ds-manifest` (or anything else) out of both.
    const COMPLETE_SETS: readonly (readonly string[])[] = [
      BASE_SUBSTRATE_PACKAGES,
      BASE_PACKAGES,
    ];

    const offenders: string[] = [];
    for (const file of mdx) {
      const body = readFileSync(file, "utf8").replace(
        /^---\n[\s\S]*?\n---\n/,
        "",
      );
      // Paragraph-scoped: a whole-file scan would union unrelated mentions across a long page and
      // report a list nobody wrote. Blank lines separate MDX blocks.
      for (const para of body.split(/\n\s*\n/)) {
        const named = new Set<string>(
          BASE_PACKAGES.filter((pkg) => new RegExp(`\\b${pkg}\\b`).test(para)),
        );
        if (named.size < ENOUGH_TO_BE_A_LIST) continue;
        if (COMPLETE_SETS.some((set) => set.every((pkg) => named.has(pkg))))
          continue;
        // Report against whichever set it came closest to — the actionable diff.
        const closest = COMPLETE_SETS.map((set) =>
          set.filter((pkg) => !named.has(pkg)),
        ).sort((a, b) => a.length - b.length)[0];
        offenders.push(
          `${file.slice(REPO_ROOT.length + 1)}: names ${String(named.size)}, missing ${(closest ?? []).join(", ")}`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no base package is a commercial SKU", () => {
    const commercial = new Set(MODULES.map((m) => m.id));
    for (const p of BASE_PACKAGES) {
      expect(commercial.has(p)).toBe(false);
    }
  });

  test("every capability tile names only real base packages", () => {
    const base = new Set<string>(BASE_PACKAGES);
    for (const c of BASE_CAPABILITIES) {
      for (const p of c.packages) {
        expect(base.has(p)).toBe(true);
      }
    }
  });

  test("the capability tiles partition every base package exactly once", () => {
    const covered = BASE_CAPABILITIES.flatMap((c) => c.packages).sort();
    expect(covered).toEqual([...BASE_PACKAGES].sort());
  });

  test("the substrate prose list drops credits and keeps rate-limit", () => {
    expect(baseSubstrateList()).not.toContain("credits");
    expect(baseSubstrateList()).toContain("rate-limit");
  });
});
