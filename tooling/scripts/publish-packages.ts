// Publish step of .github/workflows/release.yml.
//
// `npm publish` cannot rewrite `workspace:*` ranges, and `bun publish` cannot authenticate through
// npm trusted publishing, so each package is packed with `bun pm pack` (which resolves workspace
// ranges to real versions) and the tarball goes to `npm publish`, which authenticates with the
// workflow's OIDC token and attaches provenance. Versions already on npm are skipped, so a re-run
// after a partial failure publishes only what is missing.
//
//   bun tooling/scripts/publish-packages.ts            # publish every unpublished version
//   bun tooling/scripts/publish-packages.ts --dry-run  # pack + verify only (CI runs this)
//
// NPM_TOKEN, when set, is used instead of OIDC. It exists only for the one-time bootstrap publish:
// trusted publishing can be configured on a package only after its first version exists. Those
// first versions still carry provenance (--provenance below).
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
}

const ROOT = join(import.meta.dir, "..", "..");
const dryRun = process.argv.includes("--dry-run");
const out = mkdtempSync(join(tmpdir(), "caisson-publish-"));

function publishable(): { dir: string; pkg: Manifest }[] {
  const found: { dir: string; pkg: Manifest }[] = [];
  for (const name of readdirSync(join(ROOT, "packages")).sort()) {
    const dir = join(ROOT, "packages", name);
    const path = join(dir, "package.json");
    if (!existsSync(path)) continue;
    const pkg = JSON.parse(readFileSync(path, "utf8")) as Manifest;
    if (pkg.private !== true) found.push({ dir, pkg });
  }
  return found;
}

/** True when name@version is already on npm; a 404 means not yet published. */
function isPublished(name: string, version: string): boolean {
  try {
    const shown = execFileSync(
      "npm",
      ["view", `${name}@${version}`, "version"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return shown.trim() === version;
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? "");
    if (stderr.includes("E404")) return false;
    throw error;
  }
}

/** Pack one package and refuse a tarball whose manifest still carries a workspace range. */
function pack(dir: string, pkg: Manifest): string {
  const before = new Set(readdirSync(out));
  execFileSync("bun", ["pm", "pack", "--destination", out, "--quiet"], {
    cwd: dir,
    stdio: "inherit",
  });
  const tarball = readdirSync(out).find((f) => !before.has(f));
  if (tarball === undefined)
    throw new Error(`bun pm pack produced no tarball for ${pkg.name}`);
  const path = join(out, tarball);
  const packed = execFileSync("tar", ["-xOzf", path, "package/package.json"], {
    encoding: "utf8",
  });
  if (packed.includes('"workspace:')) {
    throw new Error(
      `${pkg.name}: packed package.json still has a workspace: range`,
    );
  }
  return path;
}

const env = { ...process.env };
if (!dryRun && (process.env.NPM_TOKEN ?? "") !== "") {
  // npm expands ${NPM_TOKEN} from the environment, so the token itself never touches disk.
  const npmrc = join(out, "npmrc");
  writeFileSync(npmrc, "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n");
  env.NPM_CONFIG_USERCONFIG = npmrc;
}

const packages = publishable();
if (packages.length === 0)
  throw new Error("no publishable packages found under packages/");
let published = 0;
for (const { dir, pkg } of packages) {
  if (!dryRun && isPublished(pkg.name, pkg.version)) continue;
  const tarball = pack(dir, pkg);
  if (dryRun) continue;
  // --provenance: trusted publishing adds it on its own, but a token-authenticated publish (the
  // bootstrap) only attests when asked. The workflow's id-token permission covers both.
  execFileSync(
    "npm",
    ["publish", tarball, "--access", "public", "--provenance"],
    {
      stdio: "inherit",
      env,
    },
  );
  process.stdout.write(`published ${pkg.name}@${pkg.version}\n`);
  published++;
}
process.stdout.write(
  dryRun
    ? `dry run: packed and verified ${packages.length} packages\n`
    : `published ${published} of ${packages.length} packages\n`,
);
