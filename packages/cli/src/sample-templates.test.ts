// Tests for the free, Apache-2.0 evaluation-sample engine (ADR-0095 W3). Three concerns:
//   (1) the allowlist gate — an unknown sample id throws before any path is touched,
//   (2) the materialized file set — deterministic, Apache-2.0, no commercial dependency,
//   (3) the emitted sample, ACTUALLY RUN from a real generated directory, verifies end to end.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  SAMPLE_TEMPLATES,
  assertKnownSample,
  materializeSample,
} from "./sample-templates.ts";
import { createFileSetWriter } from "./writer.ts";

// Run dir lives under `dist/` (already gitignored, ADR-0068-adjacent housekeeping) INSIDE
// `packages/cli` rather than the OS tmpdir: the generated sample's `import { ... } from
// "@caisson/kernel"` is resolved the same way a real `bun install` would resolve it in a buyer's
// clone — by walking up from the file's directory to the nearest `node_modules` — and that walk
// only finds `@caisson/kernel` (a Bun workspace symlink) inside this package's own tree.
const RUN_PARENT = join(import.meta.dir, "..", "dist");
let runDir: string | undefined;

afterEach(async () => {
  if (runDir !== undefined) {
    await rm(runDir, { recursive: true, force: true });
    runDir = undefined;
  }
});

/** The shape of `evidence-path.ts`'s default export this test relies on — kept local + minimal
 *  rather than importing the template's own types (this test exercises the GENERATED output, not
 *  the in-repo template source). */
interface EvidencePathModule {
  runEvidencePathDemo: () => {
    chain: readonly unknown[];
    chainVerification: { valid: boolean; brokenAt: number | null };
    signature: string;
    signatureValid: boolean;
  };
}

describe("eu-ai-act-sample (ADR-0095 W3) — free Apache-2.0 evidence-path sample", () => {
  test("the allowlist carries exactly the one shipped sample", () => {
    expect(SAMPLE_TEMPLATES).toEqual(["eu-ai-act-sample"]);
  });

  test("an unknown sample id throws BEFORE any path is touched", () => {
    expect(() => materializeSample("nope", "demo-project")).toThrow(
      /unknown sample template id/,
    );
    expect(() => assertKnownSample("nope")).toThrow(
      /unknown sample template id/,
    );
  });

  test("a bad project name (Zod .strict() slug rule) is rejected", () => {
    expect(() => materializeSample("eu-ai-act-sample", "Bad Name")).toThrow();
  });

  test("materializes the expected, deterministic file set", () => {
    const files = materializeSample("eu-ai-act-sample", "demo-project");
    const paths = files.map((f) => f.path);
    expect(paths).toEqual([
      ".github/workflows/ci.yml",
      ".gitignore",
      "AGENTS.md",
      "LICENSE",
      "README.md",
      "eslint.config.js",
      "package.json",
      "src/evidence-path.test.ts",
      "src/evidence-path.ts",
      "tsconfig.json",
    ]);
    // Deterministic + sorted (a re-run is byte-identical).
    expect(materializeSample("eu-ai-act-sample", "demo-project")).toEqual(
      files,
    );
  });

  test("package.json is Apache-2.0, names the project, and depends on NO commercial package", async () => {
    const files = materializeSample("eu-ai-act-sample", "acme-eval");
    const pkg = files.find((f) => f.path === "package.json");
    const parsed = JSON.parse(pkg?.content ?? "{}") as {
      name?: string;
      license?: string;
      dependencies?: Record<string, string>;
    };
    expect(parsed.name).toBe("acme-eval");
    expect(parsed.license).toBe("Apache-2.0");
    // ponytail: asserts the monorepo-native (source-level) specifier — correct here, since this
    // test materializes straight from the in-repo template. The public mirror's
    // export-public-mirror.ts rewriteCliTemplates step rewrites the ON-DISK copy of this same
    // template to @caisson-sh/kernel for buyers installing from public npm; the source template
    // itself stays @caisson/kernel, so this expectation is unaffected by that rewrite.
    //
    // The pin must track the REAL workspace kernel version (W1 sandbox finding L-C4, 2026-07-10:
    // the template shipped a hardcoded ^0.1.0 against kernel 0.4.2 — an unsatisfiable range that
    // broke the flagship no-license sample's `bun install`). Reading the version here makes
    // staleness LOUD: any kernel version bump (including a changeset version cut) fails this test
    // until the template pin rides along in the same change.
    const kernelVersion = (
      JSON.parse(
        await Bun.file(
          join(import.meta.dir, "../../kernel/package.json"),
        ).text(),
      ) as { version: string }
    ).version;
    expect(parsed.dependencies).toEqual({
      "@caisson/kernel": `^${kernelVersion}`,
    });
  });

  test("the LICENSE file is the Apache-2.0 text", () => {
    const files = materializeSample("eu-ai-act-sample", "acme-eval");
    const license = files.find((f) => f.path === "LICENSE");
    expect(license?.content).toContain("Apache License");
    expect(license?.content).toContain("Version 2.0");
  });

  test("the emitted tree imports NOTHING from @caisson/compliance (ADR-0095 firewall)", () => {
    // Docs (AGENTS.md/README.md) NAME the commercial edition to explain the open/commercial line —
    // that is documentation, not an import. The firewall is on actual import/require statements
    // and on `package.json` dependencies; check those specifically rather than banning the string
    // everywhere (which would also forbid explaining the boundary to the buyer).
    const files = materializeSample("eu-ai-act-sample", "acme-eval");
    const IMPORT_PATTERNS = [
      /from\s+["']@caisson\/compliance["']/,
      /require\(\s*["']@caisson\/compliance["']\s*\)/,
      /import\(\s*["']@caisson\/compliance["']\s*\)/,
    ];
    for (const f of files) {
      for (const rx of IMPORT_PATTERNS) {
        expect(f.content).not.toMatch(rx);
      }
      if (f.path === "package.json") {
        const parsed = JSON.parse(f.content) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        expect(Object.keys(parsed.dependencies ?? {})).not.toContain(
          "@caisson/compliance",
        );
        expect(Object.keys(parsed.devDependencies ?? {})).not.toContain(
          "@caisson/compliance",
        );
      }
    }
  });

  test("the emitted sample's verify step (chain + signature) PASSES when actually run", async () => {
    await mkdir(RUN_PARENT, { recursive: true });
    runDir = await mkdtemp(join(RUN_PARENT, ".sample-run-"));

    const files = materializeSample("eu-ai-act-sample", "acme-eval");
    const write = createFileSetWriter();
    await write(runDir, files);

    const mod = (await import(
      pathToFileURL(join(runDir, "src/evidence-path.ts")).href
    )) as EvidencePathModule;
    const result = mod.runEvidencePathDemo();

    expect(result.chain).toHaveLength(3);
    expect(result.chainVerification).toEqual({ valid: true, brokenAt: null });
    expect(result.signature).toMatch(/^[0-9a-f]{128}$/);
    expect(result.signatureValid).toBe(true);
  });
});
