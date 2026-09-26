// Argv-contract + ADR-0262 arming-rule regression tests. Two concerns:
//  1. Pin `parseArgs`/`runCli`/`HELP` — the CLI's public argv contract.
//  2. Lock the interactive arming rule via dependency injection: `resolveSelection` takes an
//     injectable `loadInteractive` (real dynamic `import("./interactive.ts")` by default) so a test
//     can assert it is NEVER called on a non-interactive path — a spy that THROWS if invoked, so an
//     accidental interactive-path regression fails loudly instead of silently passing.
import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistryIndex } from "@caisson-sh/registry-schema";
import { HELP, parseArgs, resolveSelection, runCli } from "./cli.ts";
import type { RawSelection } from "./generate.ts";
import type * as InteractiveModule from "./interactive.ts";

const manifest = (id: string, version: string) => ({
  id,
  version,
  license: "Apache-2.0" as const,
  dependencies: [] as never[],
  stability: "alpha" as const,
  description: "x",
});
const version = (v: string, id: string) => ({
  version: v,
  manifest: manifest(id, v),
  publishedAt: "2026-06-27T00:00:00.000Z",
  gateAttestation: "ci@x",
});

const INDEX = loadRegistryIndex({
  schemaVersion: 1,
  modules: [
    {
      id: "@caisson-sh/kernel",
      latest: "0.3.0",
      versions: [version("0.3.0", "@caisson-sh/kernel")],
    },
  ],
});

/** A spy `loadInteractive` that throws if invoked — the "never loaded on this path" assertion. */
function neverImport(): Promise<typeof InteractiveModule> {
  throw new Error(
    "interactive.ts must NOT be loaded on a non-interactive path",
  );
}
const forbiddenImport = mock(neverImport);

// The spawned CLI reads the fixture catalog above, not the build's workspace catalog, so these
// end-to-end tests stay independent of the real package versions.
const INDEX_DIR = mkdtempSync(join(tmpdir(), "caisson-cli-index-"));
const REGISTRY_PATH = join(INDEX_DIR, "registry-index.json");
writeFileSync(REGISTRY_PATH, JSON.stringify(INDEX));
afterAll(() => rmSync(INDEX_DIR, { recursive: true, force: true }));

/** Spawn the real `create-caisson` entry non-interactively and collect its output. */
async function spawnCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(
    [
      "bun",
      "run",
      fileURLToPath(new URL("./cli.ts", import.meta.url)),
      ...args,
    ],
    {
      env: { ...process.env, CAISSON_REGISTRY_INDEX: REGISTRY_PATH },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

describe("parseArgs — the argv contract", () => {
  test("no flags → an empty modules array, no other keys", () => {
    expect(parseArgs([])).toEqual({ modules: [] });
  });

  test("--name only", () => {
    expect(parseArgs(["--name", "acme"])).toEqual({
      projectName: "acme",
      modules: [],
    });
  });

  test("a scoped --module id@version", () => {
    expect(parseArgs(["--module", "@caisson-sh/x@1.2.3"])).toEqual({
      modules: [{ id: "@caisson-sh/x", version: "1.2.3" }],
    });
  });

  test("--deploy (ADR-0268)", () => {
    expect(parseArgs(["--deploy", "railway"])).toEqual({
      deployTarget: "railway",
      modules: [],
    });
  });

  test("--framework (ADR-0287)", () => {
    expect(parseArgs(["--framework", "next"])).toEqual({
      framework: "next",
      modules: [],
    });
  });

  test("repeatable --module, last @ split keeps a scoped id intact", () => {
    const raw: RawSelection = parseArgs([
      "--module",
      "@caisson-sh/a@1.0.0",
      "--module",
      "@caisson-sh/b@2.0.0",
    ]);
    expect(raw.modules).toEqual([
      { id: "@caisson-sh/a", version: "1.0.0" },
      { id: "@caisson-sh/b", version: "2.0.0" },
    ]);
  });

  test("--module without an @version throws", () => {
    expect(() => parseArgs(["--module", "@caisson-sh/x"])).toThrow(
      /--module expects/,
    );
  });

  test("an unknown flag throws", () => {
    expect(() => parseArgs(["--bogus"])).toThrow(/unknown argument/);
  });

  test("the retired --edition flag is an unknown argument", () => {
    expect(() => parseArgs(["--edition", "compliance"])).toThrow(
      /unknown argument/,
    );
  });

  test("G2: a leading bare positional is the project name (bunx create-caisson my-app)", () => {
    expect(parseArgs(["my-app"])).toEqual({
      projectName: "my-app",
      modules: [],
    });
  });

  test("G2: a positional combines with other flags", () => {
    expect(parseArgs(["my-app", "--module", "@caisson-sh/x@1.2.3"])).toEqual({
      projectName: "my-app",
      modules: [{ id: "@caisson-sh/x", version: "1.2.3" }],
    });
  });

  test("G2: an explicit --name wins over a positional, regardless of argv order", () => {
    expect(parseArgs(["my-app", "--name", "flag-name"])).toEqual({
      projectName: "flag-name",
      modules: [],
    });
    expect(parseArgs(["--name", "flag-name", "my-app"])).toEqual({
      projectName: "flag-name",
      modules: [],
    });
  });

  test("G2: a second bare positional still throws (only the leading one is accepted)", () => {
    expect(() => parseArgs(["my-app", "extra"])).toThrow(/unknown argument/);
  });
});

describe("runCli — argv → generation plan", () => {
  test("equals generate(index, parseArgs(argv))", () => {
    const argv = ["--name", "acme-app", "--module", "@caisson-sh/kernel@0.3.0"];
    const { selection, files } = runCli(argv, { index: INDEX });
    expect(selection.projectName).toBe("acme-app");
    expect(selection.modules).toEqual([
      { id: "@caisson-sh/kernel", version: "0.3.0" },
    ]);
    expect(files.length).toBeGreaterThan(0);
  });
});

describe("HELP text", () => {
  test("documents --deploy and interactive mode (ADR-0262/ADR-0268)", () => {
    expect(HELP).toContain("--deploy <target>");
    expect(HELP).toContain("railway | fly | vercel");
    expect(HELP).toContain("Interactive mode");
  });

  test("documents --framework (ADR-0287)", () => {
    expect(HELP).toContain("--framework <target>");
    expect(HELP).toContain("next");
  });

  test("G2: documents the leading-positional shorthand", () => {
    expect(HELP).toContain("<name>");
    expect(HELP).toContain("shorthand for --name");
  });

  test("points installs at public npm and names no license token or retired flag", () => {
    expect(HELP).toContain("public npm registry");
    expect(HELP).not.toMatch(/_TOKEN\b/);
    for (const retired of ["license key", "--edition", "--sample", "--demo"]) {
      expect(HELP).not.toContain(retired);
    }
  });
});

describe("resolveSelection — ADR-0262/ADR-0268 arming rule", () => {
  const argv = (extra: string[] = []) => [
    "--name",
    "acme-app",
    "--module",
    "@caisson-sh/kernel@0.3.0",
    ...extra,
  ];

  test("all required fields present + isTTY → zero prompt code, raw === parseArgs(argv)", async () => {
    forbiddenImport.mockClear();
    const resolved = await resolveSelection(
      argv(),
      INDEX,
      /* isTTY */ true,
      forbiddenImport,
    );
    expect(resolved).toEqual(parseArgs(argv()));
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("non-TTY stdin, even with a gap (missing --name) → zero prompt code", async () => {
    forbiddenImport.mockClear();
    const partial = ["--module", "@caisson-sh/kernel@0.3.0"];
    const resolved = await resolveSelection(
      partial,
      INDEX,
      /* isTTY */ false,
      forbiddenImport,
    );
    expect(resolved).toEqual(parseArgs(partial));
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("--framework alone (ADR-0287) arms a non-pure-run gap-fill and is forwarded to the wizard", async () => {
    let seenFlags:
      | { pureRun: boolean; framework?: string; modules: unknown[] }
      | undefined;
    const fakeLoad = mock(async () => ({
      runWizard: async (
        _index: unknown,
        flags: { pureRun: boolean; framework?: string; modules: unknown[] },
      ): Promise<RawSelection> => {
        seenFlags = flags;
        return {
          projectName: "wizard-name",
          modules: [],
          ...(flags.framework !== undefined
            ? { framework: flags.framework }
            : {}),
        };
      },
    }));
    const resolved = await resolveSelection(
      ["--framework", "next"],
      INDEX,
      true,
      fakeLoad as unknown as () => Promise<typeof InteractiveModule>,
    );
    expect(seenFlags).toEqual({
      pureRun: false,
      framework: "next",
      modules: [],
    });
    expect(resolved).toEqual({
      projectName: "wizard-name",
      modules: [],
      framework: "next",
    });
  });

  test("zero selection flags at all → pureRun=true", async () => {
    let seenPureRun: boolean | undefined;
    const fakeLoad = mock(async () => ({
      runWizard: async (
        _index: unknown,
        flags: { pureRun: boolean },
      ): Promise<RawSelection> => {
        seenPureRun = flags.pureRun;
        return { projectName: "picked", modules: [] };
      },
    }));
    const resolved = await resolveSelection(
      [],
      INDEX,
      true,
      fakeLoad as unknown as () => Promise<typeof InteractiveModule>,
    );
    expect(seenPureRun).toBe(true);
    expect(resolved).toEqual({ projectName: "picked", modules: [] });
  });
});

describe("end-to-end: a real non-interactive invocation never touches a TTY-only prompt", () => {
  test("a fully-specified, non-TTY invocation dry-runs with exit 0 and no .npmrc", async () => {
    const { stdout, stderr, exitCode } = await spawnCli([
      "--name",
      "acme-app",
      "--module",
      "@caisson-sh/kernel@0.3.0",
      "--dry-run",
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain(
      'create-caisson: dry-run — 9 files for "acme-app"',
    );
    // Modules install from public npm: no registry-scope .npmrc is ever emitted.
    expect(stdout).not.toContain(".npmrc");
  });

  test("G2: the advertised `create-caisson my-app` quickstart command dry-runs cleanly", async () => {
    const { stdout, stderr, exitCode } = await spawnCli([
      "acme-app", // leading positional — no --name
      "--module",
      "@caisson-sh/kernel@0.3.0",
      "--dry-run",
    ]);
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain(
      'create-caisson: dry-run — 9 files for "acme-app"',
    );
  });

  test("the retired --sample/--demo/--edition flags fail fast as unknown arguments", async () => {
    for (const args of [
      ["--sample", "eu-ai-act-sample", "--name", "acme"],
      ["--demo", "--name", "acme"],
      ["--name", "acme", "--edition", "compliance"],
    ]) {
      const { stderr, exitCode } = await spawnCli(args);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("create-caisson: unknown argument");
    }
  });

  test("P2-5: --out immediately followed by another flag does NOT swallow it as the directory", async () => {
    const { stderr, exitCode } = await spawnCli([
      "--out",
      "--dry-run",
      "--name",
      "acme",
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toBe("create-caisson: --out requires a directory\n");
  });
});
