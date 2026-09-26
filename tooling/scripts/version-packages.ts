// Version step of .github/workflows/release.yml: consume the pending changesets, then regenerate
// every committed file that embeds a workspace version, so the version PR carries final bytes.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

function run(
  cmd: string,
  args: string[],
  cwd = ROOT,
  extra: Record<string, string> = {},
): void {
  execFileSync(cmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extra },
  });
}

run("bunx", ["changeset", "version"]);
// The component manifest embeds @caisson-sh/ui's version.
run("bun", ["run", "--filter", "@caisson-sh/ui", "gen:manifest"]);
// The generator's framework template pins workspace versions, and its golden records them.
run("bun", ["tooling/scripts/sync-generator-template-pins.ts"]);
run(
  "bun",
  [
    "test",
    "./src/generate.test.ts",
    "-t",
    "framework=next composes the Next.js starter",
  ],
  join(ROOT, "packages", "cli"),
  { BLESS: "1" },
);
// The bumped workspace versions are recorded in bun.lock.
run("bun", ["install"]);
