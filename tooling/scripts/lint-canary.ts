/**
 * The lint canary (ADR-0408 constraint 1) — the tripwire for oxlint's ALPHA `jsPlugins` API.
 *
 * The failure this exists for is silent: if a JS plugin stops loading or its visitors stop
 * matching, oxlint reports nothing, and a lint run that reports nothing is indistinguishable from
 * a clean tree. Every other gate in the repo would stay green while the anti-slop rule (ADR-0101
 * gate #3) and the storybook rules quietly stopped enforcing anything.
 *
 * So this asserts PRESENCE, not absence: three fixture files that MUST each produce a finding.
 * Zero findings in any lane fails loudly.
 *
 *   boundary  — eslint/no-restricted-imports on a base package importing a provider SDK.
 *               Not a jsPlugins lane; it replaces the ESLint-era boundaries.test.ts so the
 *               ADR-0011/0022 Gate-2 negative test survives the swap.
 *   slop      — caisson-slop/no-slop from a LOCAL plugin file (./slop-plugin.js).
 *   storybook — storybook/* from an NPM plugin package. A distinct resolution path from the
 *               local file, so it gets its own arm.
 *
 * A gate that cannot fail is a defect, so this is mutation-verified: break slop-plugin.js (e.g.
 * empty the `rules` object, or rename the export) and re-run — the slop lane must report 0 and
 * this must exit 1. `lint-policy.test.ts` also pins the canary config against the root config so
 * the two cannot drift apart.
 *
 * Usage: bun tooling/scripts/lint-canary.ts
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { z } from "zod";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const CONFIG = join(
  REPO_ROOT,
  "tooling",
  "lint-policy",
  "canary.oxlintrc.json",
);
const FIXTURES = join(REPO_ROOT, "tooling", "lint-policy", "__fixtures__");

/** Each lane names the rule-code PREFIX its fixture must produce at least one finding under. */
const LANES = [
  {
    id: "boundary",
    prefix: "eslint(no-restricted-imports)",
    why: "the ADR-0011/0022 provider-SDK boundary stopped firing",
  },
  {
    id: "slop",
    prefix: "caisson-slop(",
    why: "the LOCAL jsPlugin stopped loading or its visitors stopped matching (ADR-0101 gate #3 is now inert)",
  },
  {
    id: "storybook",
    prefix: "storybook(",
    why: "the NPM jsPlugin stopped resolving (the storybook rules are now inert)",
  },
] as const;

const DiagnosticsSchema = z
  .object({
    diagnostics: z.array(
      z
        .object({
          code: z.string(),
          filename: z.string(),
        })
        .catchall(z.unknown()),
    ),
  })
  .catchall(z.unknown());

function runOxlint(): z.infer<typeof DiagnosticsSchema> {
  let stdout: string;
  try {
    // oxlint exits non-zero whenever it reports an error — which is the EXPECTED state here, so
    // the exit code is not the signal. Only a genuine crash (no parseable stdout) is fatal.
    stdout = execFileSync(
      join(REPO_ROOT, "node_modules", ".bin", "oxlint"),
      ["-c", CONFIG, "-f", "json", FIXTURES],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    stdout = e.stdout ?? "";
    if (!stdout.trim()) {
      throw new Error(
        `oxlint produced no output — the canary cannot verify anything.\n${e.stderr ?? String(err)}`,
      );
    }
  }
  // oxlint prints config-load failures ("Failed to parse oxlint configuration file", "Failed to
  // load JS plugin: …") as PLAIN TEXT on this stream, not as JSON. Surfacing that as a raw
  // SyntaxError would bury the one line that says what actually broke, so it is reported as what
  // it is: the canary could not run.
  try {
    return DiagnosticsSchema.parse(JSON.parse(stdout));
  } catch {
    throw new Error(
      `oxlint did not return diagnostics JSON — the canary could not run. Raw output:\n${stdout.trim()}`,
    );
  }
}

const { diagnostics } = runOxlint();
const missing: string[] = [];

for (const lane of LANES) {
  const hits = diagnostics.filter((d) => d.code.startsWith(lane.prefix));
  if (hits.length === 0) {
    missing.push(`  ✗ ${lane.id}: 0 findings — ${lane.why}`);
  } else {
    const files = new Set(
      hits.map((d) => d.filename.replace(dirname(REPO_ROOT) + "/", "")),
    );
    console.log(
      `  ✓ ${lane.id}: ${hits.length} finding(s) across ${files.size} file(s)`,
    );
  }
}

if (missing.length > 0) {
  console.error(
    [
      "",
      "lint-canary FAILED — an enforcement lane went silent.",
      ...missing,
      "",
      "This is the alpha-jsPlugins tripwire (ADR-0408). A lane reporting zero findings does NOT",
      "mean the tree is clean: these fixtures exist to violate. Fix the plugin wiring, or if a",
      "lane was retired on purpose, remove its arm here in the same commit.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(
  `lint-canary OK — ${LANES.length}/${LANES.length} enforcement lanes live.`,
);
