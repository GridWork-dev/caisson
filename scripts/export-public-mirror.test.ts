import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertMirrorOutDirHasNoSymlinkAncestors,
  DROP_COMMERCIAL_DEV_DEPS,
  EXCLUDE_TEST_FILES,
  MIRROR_ASSET_FILES,
  MIRROR_WORKSPACES,
  resolveMirrorOutDir,
  resolveCatalogSpec,
  rewriteProseMentions,
  sanitizeAdrCitations,
  sanitizeSourceComments,
  stripAdrIds,
} from "./export-public-mirror.ts";

const MIRROR_ASSETS_DIR = join(import.meta.dir, "mirror-assets");
const REPO_ROOT = join(import.meta.dir, "..");

describe("resolveMirrorOutDir", () => {
  const repoRoot = "/workspace/caisson";

  test("allows only the dedicated mirror-out tree", () => {
    expect(resolveMirrorOutDir(repoRoot, "mirror-out")).toBe(
      join(repoRoot, "mirror-out"),
    );
    expect(resolveMirrorOutDir(repoRoot, "mirror-out/probe")).toBe(
      join(repoRoot, "mirror-out/probe"),
    );
    expect(() =>
      assertMirrorOutDirHasNoSymlinkAncestors(
        join(repoRoot, "mirror-out"),
        join(repoRoot, "mirror-out/probe"),
      ),
    ).not.toThrow();
  });

  test("rejects destructive or out-of-root destinations", () => {
    for (const output of [
      ".",
      "..",
      "packages/kernel",
      "mirror-outside",
      "/tmp/caisson-mirror",
      "mirror-out/../mirror-out",
      "mirror-out/../../packages/kernel",
      "mirror-out/\0bad",
    ]) {
      expect(() => resolveMirrorOutDir(repoRoot, output)).toThrow(
        /inside the dedicated mirror-out directory/,
      );
    }
  });

  test("rejects a symlinked ancestor immediately before deletion", () => {
    const realRepoRoot = mkdtempSync(join(tmpdir(), "caisson-mirror-root-"));
    const externalDir = mkdtempSync(join(tmpdir(), "caisson-mirror-external-"));
    const allowedRoot = join(realRepoRoot, "mirror-out");
    mkdirSync(allowedRoot);
    symlinkSync(externalDir, join(allowedRoot, "linked"), "dir");

    try {
      expect(() =>
        assertMirrorOutDirHasNoSymlinkAncestors(
          allowedRoot,
          join(allowedRoot, "linked", "victim"),
        ),
      ).toThrow(/must not contain symlinks/);
    } finally {
      rmSync(realRepoRoot, { recursive: true, force: true });
      rmSync(externalDir, { recursive: true, force: true });
    }
  });
});

test("the mirror root exposes workspace globs to its module-graph tooling", () => {
  expect(MIRROR_WORKSPACES.packages).toEqual(["packages/*", "tooling/*"]);
});

describe("commercial integration fixture exclusions", () => {
  test("relocated commercial fixtures stay out of the Apache mirror", () => {
    expect(
      EXCLUDE_TEST_FILES.has("packages/cli/src/generate.integration.test.ts"),
    ).toBe(true);
    expect(
      EXCLUDE_TEST_FILES.has(
        "packages/mcp-server/src/base-composition.integration.test.ts",
      ),
    ).toBe(true);
  });

  test("their commercial-only dev dependencies are stripped", () => {
    expect(
      DROP_COMMERCIAL_DEV_DEPS.get("@caisson/cli")?.has("@caisson/credits"),
    ).toBe(true);
    expect(DROP_COMMERCIAL_DEV_DEPS.get("@caisson/mcp-server")).toEqual(
      new Set(["@caisson/billing-orchestration", "@caisson/credits"]),
    );
  });
});

describe("rewriteProseMentions", () => {
  const open = new Set(["kernel", "ai-config", "license-verify"]);

  test("renames an open mention mid-sentence", () => {
    expect(rewriteProseMentions("use @caisson/kernel here", open)).toBe(
      "use @caisson-sh/kernel here",
    );
  });

  test("renames a sentence-final open mention WITHOUT swallowing the period", () => {
    // The bug: `[\w.-]+` captured `kernel.`, missed the allowlist, shipped @caisson/kernel. as-is.
    expect(rewriteProseMentions("built on @caisson/kernel.", open)).toBe(
      "built on @caisson-sh/kernel.",
    );
    expect(rewriteProseMentions("see @caisson/license-verify.", open)).toBe(
      "see @caisson-sh/license-verify.",
    );
  });

  test("leaves a commercial (non-open) mention at @caisson/*", () => {
    expect(rewriteProseMentions("needs @caisson/compliance.", open)).toBe(
      "needs @caisson/compliance.",
    );
  });

  test("preserves the hyphen inside a kebab slug", () => {
    expect(rewriteProseMentions("@caisson/ai-config, then done", open)).toBe(
      "@caisson-sh/ai-config, then done",
    );
  });
});

describe("sanitizeAdrCitations", () => {
  test("strips a single bare ADR-id parenthetical", () => {
    expect(
      sanitizeAdrCitations(
        "any path is constructed or any subprocess spawned (ADR-0021).",
      ),
    ).toBe("any path is constructed or any subprocess spawned.");
  });

  test("strips a multi-id parenthetical (slash-separated)", () => {
    expect(
      sanitizeAdrCitations("a different discipline (ADR-0010/0015)."),
    ).toBe("a different discipline.");
  });

  test("strips a parenthetical with a short internal phase code plus ids", () => {
    expect(
      sanitizeAdrCitations("the credit ledger (P6, ADR-0089/0017) closes."),
    ).toBe("the credit ledger closes.");
  });

  test("leaves a parenthetical that mixes prose with an ADR id untouched", () => {
    const text = "read the invariant (see ADR-0072 for details) first.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("leaves a non-ADR parenthetical untouched", () => {
    const text =
      "Asymmetric (Ed25519 license) verification is NOT here: it uses crypto.verify.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("collapses the double space left by a removed mid-sentence parenthetical", () => {
    expect(
      sanitizeAdrCitations("debits once (ADR-0024)  — safe to retry."),
    ).toBe("debits once — safe to retry.");
  });

  test("is a no-op on prose with no parentheticals", () => {
    const text = "Validate every input with Zod at the API boundary.";
    expect(sanitizeAdrCitations(text)).toBe(text);
  });

  test("leaves unrelated markdown list-continuation indentation untouched", () => {
    const text = [
      "- **Allowlist BEFORE side effects.** Always go through `generate`: every module",
      "  id + version is validated against the registry index (ADR-0021).",
      "  Never build a path from an unvalidated id/version.",
    ].join("\n");
    const after = sanitizeAdrCitations(text);
    expect(after).toContain("\n  id + version is validated");
    expect(after).toContain("\n  Never build a path");
    expect(after).not.toContain("ADR-0021");
  });

  // Regression: two whole-document cleanup passes (empty-parens strip, space-before-punct strip)
  // used to run after the citation removal and silently corrupted any real `()` call or
  // space-before-punctuation ANYWHERE in the text — not just next to a stripped citation. Fixed by
  // moving the cleanup inside the removal callback, scoped to only the removal site.
  test("leaves real API syntax with empty parens intact when nowhere near a citation", () => {
    const cases = [
      "Validate every input with `z.object().strict()` at the boundary.",
      "IDs come from `crypto.randomUUID()`, never Math.random.",
      "Call `initObservability()` once at process start.",
      "The teardown hook runs `cleanup()` before exit.",
      "The lint pass covers every source file (not .tsx files, those are excluded).",
    ];
    for (const text of cases) {
      expect(sanitizeAdrCitations(text)).toBe(text);
    }
  });

  test("strips a real ADR citation while leaving unrelated () syntax elsewhere in the same text intact", () => {
    const text =
      "Debit before spend (ADR-0049/0007). Validate with `z.object().strict()` and `crypto.randomUUID()` for ids.";
    const after = sanitizeAdrCitations(text);
    expect(after).toBe(
      "Debit before spend. Validate with `z.object().strict()` and `crypto.randomUUID()` for ids.",
    );
  });
});

describe("resolveCatalogSpec", () => {
  const catalogConfig = {
    catalog: { zod: "^3.23.8", typescript: "^5.7.3" },
    catalogs: { zod4: { zod: "^4.0.0" } },
  };

  test("passes a non-catalog specifier through unchanged", () => {
    expect(resolveCatalogSpec("zod", "^3.23.0", catalogConfig)).toBe("^3.23.0");
  });

  test("resolves the default catalog specifier to its concrete range", () => {
    expect(resolveCatalogSpec("zod", "catalog:", catalogConfig)).toBe(
      "^3.23.8",
    );
  });

  test("resolves a named catalog specifier (catalog:<name>)", () => {
    expect(resolveCatalogSpec("zod", "catalog:zod4", catalogConfig)).toBe(
      "^4.0.0",
    );
  });

  test("throws on a default catalog specifier with no matching entry", () => {
    expect(() =>
      resolveCatalogSpec("left-pad", "catalog:", catalogConfig),
    ).toThrow(/Unresolvable catalog specifier/);
  });

  test("throws on a named catalog specifier with no matching table", () => {
    expect(() =>
      resolveCatalogSpec("zod", "catalog:missing", catalogConfig),
    ).toThrow(/Unresolvable catalog specifier/);
  });
});

describe("sanitizeSourceComments", () => {
  test("sanitizes a bare ADR-id parenthetical inside a line comment only", () => {
    const code = [
      "// Asymmetric (Ed25519 license) verification is NOT here: it uses `crypto.verify`, a different",
      "// discipline (ADR-0010/0015).",
      "import { createHash, timingSafeEqual } from 'node:crypto';",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain("// Asymmetric (Ed25519 license) verification");
    expect(after).toContain("// discipline.");
    expect(after).not.toContain("ADR-0010");
    // Code outside the comment is untouched.
    expect(after).toContain(
      "import { createHash, timingSafeEqual } from 'node:crypto';",
    );
  });

  test("sanitizes inside a block comment without touching adjacent code", () => {
    const code = [
      "/**",
      " * Debit before spend (ADR-0049/0007).",
      " */",
      "export function run(): void {}",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain(" * Debit before spend.");
    expect(after).toContain("export function run(): void {}");
  });

  test("moves punctuation left by a citation-only JSDoc line onto the prior line", () => {
    const code = [
      "/**",
      " * Computes one value",
      " * (ADR-0007). Then renders it.",
      " */",
    ].join("\n");
    expect(sanitizeSourceComments(code)).toContain(
      " * Computes one value.\n * Then renders it.",
    );
  });

  test("never mistakes a https:// URL string for a line comment", () => {
    const code = 'const DOCS_URL = "https://caisson.sh/docs"; // stable link';
    expect(sanitizeSourceComments(code)).toBe(code);
  });

  test("never mistakes a string literal's raw comment-lookalike text for a real comment", () => {
    // Regression: a string literal containing `*/`/`/*` used to be misread as spanning into the
    // next real block comment, and the empty-parens cleanup then stripped `()` out of real code
    // caught in that false span (found live in packages/cli/src/demo.test.ts's hostile-string
    // fixture: `expect(stub).toBeDefined();` was corrupted to `expect(stub).toBeDefined;`).
    const code = [
      "const injected = '*/ throw new Error(\"INJECTED\"); /*';",
      "/**",
      " * Debit before spend (ADR-0049).",
      " */",
      "expect(stub).toBeDefined();",
    ].join("\n");
    const after = sanitizeSourceComments(code);
    expect(after).toContain(
      "const injected = '*/ throw new Error(\"INJECTED\"); /*';",
    );
    expect(after).toContain(" * Debit before spend.");
    expect(after).toContain("expect(stub).toBeDefined();");
  });
});

describe("MIRROR_ASSET_FILES", () => {
  test("every listed source file exists under scripts/mirror-assets/", () => {
    for (const { src } of MIRROR_ASSET_FILES) {
      expect(existsSync(join(MIRROR_ASSETS_DIR, src))).toBe(true);
    }
  });

  // Pins the presentation-punch-list additions actually land in the export wiring, not just on
  // disk under mirror-assets/ (an asset never added to this table is silently never exported).
  test("ships the community-health + presentation assets at the expected mirror path", () => {
    const dests = MIRROR_ASSET_FILES.map((f) => f.dest);
    expect(dests).toContain("SECURITY.md");
    expect(dests).toContain("SUPPORT.md");
    expect(dests).toContain("CODE_OF_CONDUCT.md");
    expect(dests).toContain(".github/ISSUE_TEMPLATE/bug_report.md");
  });

  test("keeps generator-owned artifacts out of mirror formatting", () => {
    // oxfmt reads .prettierignore natively (ADR-0408), so the exemption file is unchanged even
    // though the formatter behind it swapped.
    const prettierIgnore = readFileSync(
      join(MIRROR_ASSETS_DIR, ".prettierignore"),
      "utf8",
    );
    expect(prettierIgnore).toContain(
      "packages/ds-manifest/src/base-manifest.json",
    );
  });

  test("the shipped mirror lint config carries the source repo's rule floor verbatim", () => {
    // The mirror config is the root config minus the overrides whose targets do not ship. Its
    // `rules` block must stay byte-equal to the root's, or the open packages would be linted to a
    // quietly weaker standard than the private tree that produced them — and the provider-SDK
    // denylist in particular is the one rule a base package can violate.
    const readJsonc = (p: string) =>
      JSON.parse(readFileSync(p, "utf8").replace(/^\s*\/\/.*$/gm, "")) as {
        rules: Record<string, unknown>;
      };
    const root = readJsonc(join(REPO_ROOT, ".oxlintrc.json"));
    const mirror = readJsonc(join(MIRROR_ASSETS_DIR, "oxlintrc.json"));
    expect(mirror.rules).toEqual(root.rules);
    expect(MIRROR_ASSET_FILES.map((f) => f.dest)).toContain(".oxlintrc.json");
  });
});

describe("stripAdrIds", () => {
  // The safety property this function exists to hold. An earlier draft ran a document-wide
  // `/\(\s*\)/g` cleanup and turned `z.object().strict()` into `z.object.strict` — real empty
  // calls are only safe because paren collapsing is decided from the interior that was just
  // emptied, never by scanning for `()`.
  test("never touches code that has no citation in it", () => {
    const code = [
      "const schema = z.object().strict();",
      "expect(stub).toBeDefined();",
      "const empty = foo();",
      "if (a) return bar(); // no citation here",
    ].join("\n");
    expect(stripAdrIds(code)).toBe(code);
  });

  test.each([
    // rule 3 — id leads a parenthetical that carries real prose
    [
      "design foundation (ADR-0042 palette+type)",
      "design foundation (palette+type)",
    ],
    // a phase code rides with the id
    ["the seam (ADR-0249 G3 rider 2) holds", "the seam (rider 2) holds"],
    // rule 1 — the citation verb is meaningless once the id goes
    ["fail-closed (see ADR-0072 for details)", "fail-closed (for details)"],
    // rule 2 — the id was the sentence's subject
    ["integer units as ADR-0007 requires", "integer units as required"],
    ["ADR-0005 forbids a float here", "the standard forbids a float here"],
    // rule 4 — id fused into a noun phrase
    ["the ADR-0013 harness runs first", "the harness runs first"],
    // rule 5 — standalone id, repaired against its own surroundings only
    ["Blacksmith per ADR-0365, fleet-only.", "Blacksmith, fleet-only."],
    ["one dynamic app (ADR-0114/0115)", "one dynamic app"],
    ["locked ADR-0100 F3", "locked"],
    // rule 0 — internal doc paths are the same class of dead citation
    ["see outputs/specs/gw-v4/SPEC.md for the rest", "for the rest"],
    ["tracked in docs/state/outstanding-work.md", "tracked in"],
  ])("strips %j", (input, expected) => {
    expect(stripAdrIds(input)).toBe(expected);
  });

  test("leaves no residue the export gate would flag, and is idempotent", () => {
    const corpus = [
      "Blacksmith per ADR-0365 (fleet-only sweep; the push token accepted here).",
      "// ADR-0318 F2/F3 — the mirror APPENDS; never force-push.",
      "Full convention: docs/ops/parallel-session-waves.md (ADR-0328 D6).",
      "* ThemeToggle — an ICON control, single button. (ADR-0100 F3)",
    ].join("\n");
    const once = stripAdrIds(corpus);
    expect(once).not.toContain("ADR-");
    expect(once).not.toContain("docs/state/");
    expect(stripAdrIds(once)).toBe(once);
  });
});

describe("stripAdrIds — punctuation and line structure", () => {
  test.each([
    // A citation that OPENS a line owns the punctuation right after it.
    ["// ADR-0257: the bundle model.", "// the bundle model."],
    [
      "// per ADR-0201: transformers stays UNINSTALLED",
      "// transformers stays UNINSTALLED",
    ],
    ["// (ADR-0371). Schema cases run first", "// Schema cases run first"],
    [
      " * (ADR-0011): only `ai-config` may import",
      " * only `ai-config` may import",
    ],
    // Mid-sentence, the punctuation is the host sentence's own and stays put.
    ["spawned (ADR-0021). Next sentence.", "spawned. Next sentence."],
    // A `·`-separated run of citation-plus-title IS the sentence it sits in.
    [
      "stand on. ADR-0043 (per-tenant keys) · ADR-0046 (envelope).",
      "stand on.",
    ],
    // Closing a string literal: no space may survive inside the quotes. This is what keeps
    // base-manifest.json byte-identical to what its generator produces from the same JSDoc.
    ['"pinned loads. (ADR-0100 F3)",', '"pinned loads.",'],
  ])("strips %j", (input, expected) => {
    expect(stripAdrIds(input)).toBe(expected);
  });

  // Regression: `\(([^()]*)\)` matched across a newline, so re-emitting the stripped interior on one
  // line WELDED two source lines together — in a wrapped `//` comment that produced
  // "lock (// row 57), composing…". No rule may move text between lines.
  test("never joins two lines, even when a citation spans the break", () => {
    const wrapped = [
      "// producer-side dedup via a transaction-scoped advisory lock (ADR-0229",
      "// row 57), composing the SKIP-LOCKED consumer of ADR-0211. Next.",
      "const x = 1;",
    ].join("\n");
    const out = stripAdrIds(wrapped);
    expect(out.split("\n")).toHaveLength(3);
    expect(out.split("\n")[2]).toBe("const x = 1;");
    expect(out).not.toContain("ADR-");
  });

  test("leaves no trailing whitespace on a line a citation used to end", () => {
    const out = stripAdrIds("## Golden (ADR-0013)\n\nbody text\n");
    expect(out).toBe("## Golden\n\nbody text\n");
  });
});
