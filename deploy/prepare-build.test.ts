import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./prepare-build.sh", import.meta.url));
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});

async function prepare(ci: string, os: string, failure = "0") {
  const directory = await mkdtemp(join(tmpdir(), "caisson-prepare-test-"));
  temporary.push(directory);
  const log = join(directory, "calls");
  const output = join(directory, "github-env");
  // No destructive executable is invoked: the sudo stub only records argv.
  await writeFile(
    join(directory, "sudo"),
    [
      "#!/bin/bash",
      'printf "%s\\n" "$*" >> "$PREPARE_LOG"',
      'exit "$PREPARE_FAILURE"',
      "",
    ].join("\n"),
    { mode: 0o700 },
  );
  await writeFile(join(directory, "df"), "#!/bin/bash\nexit 0\n", {
    mode: 0o700,
  });
  const child = Bun.spawn(["bash", script], {
    env: {
      PATH: `${directory}:${process.env.PATH ?? ""}`,
      GITHUB_ACTIONS: ci,
      RUNNER_OS: os,
      RUNNER_TEMP: directory,
      GITHUB_ENV: output,
      PREPARE_LOG: log,
      PREPARE_FAILURE: failure,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const exit = await child.exited;
  return {
    exit,
    calls: await readFile(log, "utf8").catch(() => ""),
    output: await readFile(output, "utf8").catch(() => ""),
  };
}

test("does nothing outside GitHub Linux CI", async () => {
  expect(await prepare("", "Linux")).toEqual({
    exit: 0,
    calls: "",
    output: "",
  });
  expect(await prepare("true", "macOS")).toEqual({
    exit: 0,
    calls: "",
    output: "",
  });
});

test("removes only named unused SDKs and selects remote digest scanning", async () => {
  expect(await prepare("true", "Linux")).toEqual({
    exit: 0,
    calls:
      "rm -rf -- /usr/local/lib/android /usr/local/.ghcup /usr/local/swift /usr/share/dotnet\n",
    output: "TRIVY_IMAGE_SRC=remote\n",
  });
});

test("cleanup failure propagates without pretending preparation finished", async () => {
  const result = await prepare("true", "Linux", "23");
  expect(result.exit).toBe(23);
  expect(result.output).toBe("");
});
