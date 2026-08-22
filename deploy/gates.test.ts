import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const GATES = fileURLToPath(new URL("./gates.sh", import.meta.url));
const PREPARE_BUILD = fileURLToPath(
  new URL("./prepare-build.sh", import.meta.url),
);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function runGates(failOn?: string): Promise<{
  exitCode: number;
  commands: string[];
}> {
  const directory = await mkdtemp(join(tmpdir(), "caisson-deploy-gates-"));
  temporaryDirectories.push(directory);
  const logPath = join(directory, "commands.log");
  const bunPath = join(directory, "bun");
  const gitPath = join(directory, "git");
  await writeFile(
    bunPath,
    [
      "#!/usr/bin/env bash",
      'printf "%s\\n" "$*" >> "$GATE_TEST_LOG"',
      'if [[ "${GATE_FAIL_ON:-}" == "$*" ]]; then exit 23; fi',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  await chmod(bunPath, 0o700);
  await writeFile(
    gitPath,
    [
      "#!/usr/bin/env bash",
      'printf "git %s\\n" "$*" >> "$GATE_TEST_LOG"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  await chmod(gitPath, 0o700);

  const child = Bun.spawn(["bash", GATES], {
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH ?? ""}`,
      GATE_TEST_LOG: logPath,
      ...(failOn === undefined ? {} : { GATE_FAIL_ON: failOn }),
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await child.exited;
  const commands = await readFile(logPath, "utf8")
    .then((contents) => contents.trim().split("\n").filter(Boolean))
    .catch(() => []);
  return { exitCode, commands };
}

describe("repository deployment gates", () => {
  test("ships the required explicit no-op build preparation hook", async () => {
    expect(await readFile(PREPARE_BUILD, "utf8")).toBe(
      ": # Caisson requires no host-side build-context preparation.\n",
    );
    expect((await stat(PREPARE_BUILD)).mode & 0o111).not.toBe(0);
  });

  test("runs repository standards, registry provenance, and code gates in order", async () => {
    expect(await runGates()).toEqual({
      exitCode: 0,
      commands: [
        "run tooling/standards-gate/src/cli.ts",
        "run lint:repo",
        "run lint:canary",
        "tooling/standards-gate/src/dependency-graph-guard.ts",
        "test registry/schema registry/scripts registry/worker",
        "registry/scripts/build-index.ts",
        "git diff --exit-code registry/index.json",
        "run lint",
        "run typecheck",
        "run test",
      ],
    });
  });

  test("stops immediately and preserves a failing gate status", async () => {
    expect(await runGates("run lint:canary")).toEqual({
      exitCode: 23,
      commands: [
        "run tooling/standards-gate/src/cli.ts",
        "run lint:repo",
        "run lint:canary",
      ],
    });
  });
});
