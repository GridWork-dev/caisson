// Argv-contract + ADR-0262 arming-rule regression tests (previously untested surface). Two
// concerns:
//  1. Pin `parseArgs`/`parseSampleArgs`/`runCli`/`HELP` — the CLI's public argv contract.
//  2. Lock the interactive arming rule via dependency injection: `resolveSampleProjectName` and
//     `resolveLicensed` take an injectable `loadInteractive` (real dynamic `import("./interactive.ts")`
//     by default) so a test can assert it is NEVER called on a non-interactive path — a spy that
//     THROWS if invoked, so an accidental interactive-path regression fails loudly instead of
//     silently passing.
import { describe, expect, mock, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { loadRegistryIndex } from "@caisson/registry-schema";
import {
  HELP,
  type LicensedResolution,
  parseArgs,
  parseSampleArgs,
  resolveDemoProjectName,
  resolveLicensed,
  resolveSampleProjectName,
  runCli,
} from "./cli.ts";
import type { RawSelection } from "./generate.ts";
import type * as InteractiveModule from "./interactive.ts";

const manifest = (id: string, version: string) => ({
  id,
  version,
  kind: "primitive" as const,
  editions: [] as never[],
  tier: "paid" as const,
  priceCents: 100,
  license: "LicenseRef-Caisson-Commercial" as const,
  dependencies: [] as never[],
  entry: "src/index.ts",
  agents: "AGENTS.md",
  golden: null,
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
      id: "@caisson/kernel",
      latest: "0.3.0",
      versions: [version("0.3.0", "@caisson/kernel")],
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

  test("--edition + a scoped --module id@version", () => {
    expect(
      parseArgs(["--edition", "compliance", "--module", "@caisson/x@1.2.3"]),
    ).toEqual({
      edition: "compliance",
      modules: [{ id: "@caisson/x", version: "1.2.3" }],
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
    const raw = parseArgs([
      "--module",
      "@caisson/a@1.0.0",
      "--module",
      "@caisson/b@2.0.0",
    ]) as RawSelection;
    expect(raw.modules).toEqual([
      { id: "@caisson/a", version: "1.0.0" },
      { id: "@caisson/b", version: "2.0.0" },
    ]);
  });

  test("--module without an @version throws", () => {
    expect(() => parseArgs(["--module", "@caisson/x"])).toThrow(
      /--module expects/,
    );
  });

  test("an unknown flag throws", () => {
    expect(() => parseArgs(["--bogus"])).toThrow(/unknown argument/);
  });
});

describe("parseSampleArgs — the free-sample argv contract", () => {
  test("no flags → {}", () => {
    expect(parseSampleArgs([])).toEqual({});
  });

  test("--name only", () => {
    expect(parseSampleArgs(["--name", "acme"])).toEqual({
      projectName: "acme",
    });
  });

  test("an unknown flag throws (no --edition/--module here)", () => {
    expect(() => parseSampleArgs(["--edition", "compliance"])).toThrow(
      /unknown argument/,
    );
  });
});

describe("runCli — argv → generation plan (unchanged by ADR-0262/ADR-0268)", () => {
  test("equals generate(index, parseArgs(argv))", () => {
    const argv = ["--name", "acme-app", "--module", "@caisson/kernel@0.3.0"];
    const { selection, files } = runCli(argv, { index: INDEX });
    expect(selection.projectName).toBe("acme-app");
    expect(selection.modules).toEqual([
      { id: "@caisson/kernel", version: "0.3.0" },
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

  test("documents the six-bundle vocabulary + the legacy edition aliases (ADR-0257/0258)", () => {
    for (const bundle of [
      "compliance",
      "ai-production",
      "local-first",
      "agentic-dev",
      "provenance",
      "everything",
    ]) {
      expect(HELP).toContain(bundle);
    }
    expect(HELP).toContain("ai-kit");
    expect(HELP).toContain("local-ai");
    expect(HELP).toContain("agent-dev");
  });

  test("documents --demo (ADR-0274 §1)", () => {
    expect(HELP).toContain("--demo");
    expect(HELP).toContain("no license");
  });
});

describe("resolveSampleProjectName — ADR-0262 arming rule (--sample path)", () => {
  test("projectName already given → returns it, interactive.ts NEVER loaded (even if isTTY)", async () => {
    forbiddenImport.mockClear();
    const name = await resolveSampleProjectName(
      ["--name", "acme"],
      /* isTTY */ true,
      forbiddenImport,
    );
    expect(name).toBe("acme");
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("projectName missing + non-TTY → throws the pre-ADR-0262 error, interactive.ts NEVER loaded", async () => {
    forbiddenImport.mockClear();
    await expect(
      resolveSampleProjectName([], /* isTTY */ false, forbiddenImport),
    ).rejects.toThrow(/--sample requires --name/);
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("projectName missing + isTTY → prompts via the injected interactive module", async () => {
    const fakeLoad = mock(async () => ({
      promptSampleProjectName: async () => "prompted-name",
      runWizard: async () => {
        throw new Error("not exercised in this test");
      },
      DEFAULT_SAMPLE_ID: "eu-ai-act-sample",
    }));
    const name = await resolveSampleProjectName(
      [],
      true,
      fakeLoad as unknown as () => Promise<typeof InteractiveModule>,
    );
    expect(name).toBe("prompted-name");
    expect(fakeLoad).toHaveBeenCalledTimes(1);
  });
});

describe("resolveDemoProjectName — ADR-0274 arming rule (--demo path)", () => {
  test("projectName already given → returns it, interactive.ts NEVER loaded (even if isTTY)", async () => {
    forbiddenImport.mockClear();
    const name = await resolveDemoProjectName(
      ["--name", "acme"],
      /* isTTY */ true,
      forbiddenImport,
    );
    expect(name).toBe("acme");
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("projectName missing + non-TTY → throws a clear error, interactive.ts NEVER loaded", async () => {
    forbiddenImport.mockClear();
    await expect(
      resolveDemoProjectName([], /* isTTY */ false, forbiddenImport),
    ).rejects.toThrow(/--demo requires --name/);
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("projectName missing + isTTY → prompts via the injected interactive module", async () => {
    const fakeLoad = mock(async () => ({
      promptSampleProjectName: async () => "prompted-name",
      runWizard: async () => {
        throw new Error("not exercised in this test");
      },
      DEFAULT_SAMPLE_ID: "eu-ai-act-sample",
    }));
    const name = await resolveDemoProjectName(
      [],
      true,
      fakeLoad as unknown as () => Promise<typeof InteractiveModule>,
    );
    expect(name).toBe("prompted-name");
    expect(fakeLoad).toHaveBeenCalledTimes(1);
  });
});

describe("resolveLicensed — ADR-0262/ADR-0268 arming rule (licensed path)", () => {
  const argv = (extra: string[] = []) => [
    "--name",
    "acme-app",
    "--module",
    "@caisson/kernel@0.3.0",
    ...extra,
  ];

  test("all required fields present + isTTY → zero prompt code, raw === parseArgs(argv)", async () => {
    forbiddenImport.mockClear();
    const expected = parseArgs(argv());
    const resolved = await resolveLicensed(
      argv(),
      INDEX,
      /* isTTY */ true,
      forbiddenImport,
    );
    expect(resolved).toEqual({ kind: "licensed", raw: expected });
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("non-TTY stdin, even with a gap (missing --name) → zero prompt code", async () => {
    forbiddenImport.mockClear();
    const partial = ["--module", "@caisson/kernel@0.3.0"];
    const expected = parseArgs(partial);
    const resolved = await resolveLicensed(
      partial,
      INDEX,
      /* isTTY */ false,
      forbiddenImport,
    );
    expect(resolved).toEqual({ kind: "licensed", raw: expected });
    expect(forbiddenImport).not.toHaveBeenCalled();
  });

  test("a partial invocation (--edition alone) gap-fills via the wizard WITHOUT a pure run", async () => {
    let seenPureRun: boolean | undefined;
    const fakeLoad = mock(async () => ({
      promptSampleProjectName: async () => {
        throw new Error("not exercised in this test");
      },
      runWizard: async (
        _index: unknown,
        flags: { pureRun: boolean },
      ): Promise<LicensedResolution & { kind: "licensed" }> => {
        seenPureRun = flags.pureRun;
        return {
          kind: "licensed",
          raw: {
            projectName: "wizard-name",
            edition: "compliance",
            modules: [],
          },
        };
      },
      DEFAULT_SAMPLE_ID: "eu-ai-act-sample",
    }));
    const resolved = await resolveLicensed(
      ["--edition", "compliance"],
      INDEX,
      true,
      fakeLoad as unknown as () => Promise<typeof InteractiveModule>,
    );
    expect(seenPureRun).toBe(false);
    expect(resolved).toEqual({
      kind: "licensed",
      raw: { projectName: "wizard-name", edition: "compliance", modules: [] },
    });
  });

  test("--framework alone (ADR-0287) arms a non-pure-run gap-fill and is forwarded to the wizard", async () => {
    let seenFlags:
      { pureRun: boolean; framework?: string; modules: unknown[] } | undefined;
    const fakeLoad = mock(async () => ({
      promptSampleProjectName: async () => {
        throw new Error("not exercised in this test");
      },
      runWizard: async (
        _index: unknown,
        flags: { pureRun: boolean; framework?: string; modules: unknown[] },
      ): Promise<LicensedResolution & { kind: "licensed" }> => {
        seenFlags = flags;
        return {
          kind: "licensed",
          raw: {
            projectName: "wizard-name",
            modules: [],
            framework: flags.framework,
          },
        };
      },
      DEFAULT_SAMPLE_ID: "eu-ai-act-sample",
    }));
    const resolved = await resolveLicensed(
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
      kind: "licensed",
      raw: { projectName: "wizard-name", modules: [], framework: "next" },
    });
  });

  test("zero selection flags at all → pureRun=true; the wizard may resolve to the sample branch", async () => {
    let seenPureRun: boolean | undefined;
    const fakeLoad = mock(async () => ({
      promptSampleProjectName: async () => {
        throw new Error("not exercised in this test");
      },
      runWizard: async (_index: unknown, flags: { pureRun: boolean }) => {
        seenPureRun = flags.pureRun;
        return { kind: "sample" as const, projectName: "picked-sample" };
      },
      DEFAULT_SAMPLE_ID: "eu-ai-act-sample",
    }));
    const resolved = await resolveLicensed(
      [],
      INDEX,
      true,
      fakeLoad as unknown as () => Promise<typeof InteractiveModule>,
    );
    expect(seenPureRun).toBe(true);
    expect(resolved).toEqual({
      kind: "sample",
      sampleId: "eu-ai-act-sample",
      projectName: "picked-sample",
    });
  });

  test("zero selection flags at all → the wizard may resolve to the demo branch (ADR-0274)", async () => {
    const fakeLoad = mock(async () => ({
      promptSampleProjectName: async () => {
        throw new Error("not exercised in this test");
      },
      runWizard: async () => ({
        kind: "demo" as const,
        projectName: "picked-demo",
      }),
      DEFAULT_SAMPLE_ID: "eu-ai-act-sample",
    }));
    const resolved = await resolveLicensed(
      [],
      INDEX,
      true,
      fakeLoad as unknown as () => Promise<typeof InteractiveModule>,
    );
    expect(resolved).toEqual({ kind: "demo", projectName: "picked-demo" });
  });
});

describe("end-to-end: a real non-interactive invocation never touches a TTY-only prompt", () => {
  test("a fully-specified, non-TTY invocation dry-runs with unchanged stdout and exit 0", async () => {
    const registryPath = fileURLToPath(
      new URL("../../../registry/index.json", import.meta.url),
    );
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        fileURLToPath(new URL("./cli.ts", import.meta.url)),
        "--name",
        "acme-app",
        "--module",
        "@caisson/kernel@0.3.0",
        "--dry-run",
      ],
      {
        env: { ...process.env, CAISSON_REGISTRY_INDEX: registryPath },
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
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain(
      'create-caisson: dry-run — 10 files for "acme-app"',
    );
  });

  test("--sample with a missing name + non-TTY stdin fails fast (no hang, no prompt)", async () => {
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        fileURLToPath(new URL("./cli.ts", import.meta.url)),
        "--sample",
        "eu-ai-act-sample",
      ],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const [stderr, exitCode] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toBe("create-caisson: --sample requires --name <slug>\n");
  });

  test("--demo against the REAL registry index dry-runs: no license, commercial ids stubbed (ADR-0274)", async () => {
    const registryPath = fileURLToPath(
      new URL("../../../registry/index.json", import.meta.url),
    );
    const index = (
      await import("@caisson/registry-schema")
    ).loadRegistryIndexFromFile(registryPath);
    const paidCount = index.modules.filter(
      (m) =>
        m.versions.find((v) => v.version === m.latest)?.manifest.tier ===
        "paid",
    ).length;

    const proc = Bun.spawn(
      [
        "bun",
        "run",
        fileURLToPath(new URL("./cli.ts", import.meta.url)),
        "--demo",
        "--name",
        "acme-demo",
        "--dry-run",
      ],
      {
        env: { ...process.env, CAISSON_REGISTRY_INDEX: registryPath },
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
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain(
      `${paidCount} of ${index.modules.length} modules stubbed`,
    );
    expect(stdout).toContain("DEMO.md");
    // F1: .npmrc is emitted (tokenless scope mapping) — never deleted, never absent (demo.test.ts
    // pins the exact tokenless content; this just locks the file plan includes it).
    expect(stdout).toContain(".npmrc");
  });

  test("--demo and --sample together fail fast with a clear error", async () => {
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        fileURLToPath(new URL("./cli.ts", import.meta.url)),
        "--demo",
        "--sample",
        "eu-ai-act-sample",
        "--name",
        "acme",
      ],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const [stderr, exitCode] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "create-caisson: --sample and --demo are mutually exclusive\n",
    );
  });

  test('P2-5: --sample immediately followed by --demo does NOT greedily swallow "--demo" as the template id', async () => {
    const proc = Bun.spawn(
      [
        "bun",
        "run",
        fileURLToPath(new URL("./cli.ts", import.meta.url)),
        "--sample",
        "--demo",
        "--name",
        "acme",
      ],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const [stderr, exitCode] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(1);
    // Before the fix this produced "unknown sample template id: --demo" — a misleading error from
    // --sample silently consuming the NEXT flag as its value.
    expect(stderr).toBe("create-caisson: --sample requires a template id\n");
  });
});
