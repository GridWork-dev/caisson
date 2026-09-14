import { afterEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runGate(failOn = "") {
  const directory = mkdtempSync(join(tmpdir(), "caisson-publish-gates-"));
  temporaryDirectories.push(directory);
  const calls = join(directory, "calls");
  // Deliberate command doubles: exercise the real shell control flow without running
  // repository gates recursively or accessing any external service.
  const stub = [
    "#!/usr/bin/env bash",
    'printf \'%s|%s|%s\\n\' "$(basename "$0")" "${TURBO_CONCURRENCY:-unset}" "$*" >> "$GATE_CALLS"',
    'if [[ -n "$GATE_FAIL_ON" && "$*" == "$GATE_FAIL_ON" ]]; then exit 29; fi',
    "",
  ].join("\n");
  for (const command of ["bun", "git"]) {
    writeFileSync(join(directory, command), stub, { mode: 0o700 });
  }
  const result = spawnSync("bash", [join(import.meta.dir, "gates.sh")], {
    cwd: join(import.meta.dir, ".."),
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH ?? ""}`,
      GATE_CALLS: calls,
      GATE_FAIL_ON: failOn,
      TURBO_CONCURRENCY: "99",
    },
    encoding: "utf8",
  });
  return {
    status: result.status,
    calls: readFileSync(calls, "utf8").trim().split("\n"),
  };
}

test("publication gates cap every Turbo invocation without dropping gate commands", () => {
  const result = runGate();
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    "bun|50%|run tooling/standards-gate/src/cli.ts",
    "bun|50%|run lint:repo",
    "bun|50%|run lint:canary",
    "bun|50%|tooling/standards-gate/src/dependency-graph-guard.ts",
    "bun|50%|test registry/schema registry/scripts registry/worker",
    "bun|50%|registry/scripts/build-index.ts",
    "git|50%|diff --exit-code registry/index.json",
    "bun|50%|run lint",
    "bun|50%|run typecheck",
    "bun|50%|run test",
  ]);
});

test("publication gates stop at the original failing command", () => {
  const result = runGate("run lint:repo");
  expect(result.status).toBe(29);
  expect(result.calls.map((line) => line.split("|").at(-1))).toEqual([
    "run tooling/standards-gate/src/cli.ts",
    "run lint:repo",
  ]);
});
