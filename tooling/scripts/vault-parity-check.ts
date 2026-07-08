// Diffs the 1Password "Caisson Launch" vault against ~/.gridwork/caisson.env by NAME only —
// the parity check from SPEC §4 (outputs/specs/pre-launch-credential-sweep/), Fork-2 home.
//
// READ-ONLY, NAMES-ONLY CONTRACT (mirrors railway-env-sync.ts's header):
//   - `op item list --vault "Caisson Launch" --format json` — reads item TITLE + updated_at only.
//     ponytail: the `op` CLI over a custom 1Password SDK — already the operator's tool.
//   - `caisson.env` — reads var NAMES only (`export NAME=...` / `NAME=...` lines); never sources
//     the file, never reads a value.
//   - Never calls `op item create/edit/delete` or writes to caisson.env. The vault is the
//     recovery store, caisson.env is the SOT (ADR-0224 F6=A) — this tool only compares them.
//   - Prints NO values in any branch — every function here only ever handles a `title`/name
//     string or an ISO timestamp.
//
// Usage: bun tooling/scripts/vault-parity-check.ts [--vault "Caisson Launch"] [--rotated-after <ISO date>]
// Exit: 0 = no drift; 1 = missing/extra/stale names found, or `op` isn't authenticated.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const ENV_FILE_PATH = join(homedir(), ".gridwork", "caisson.env");
const DEFAULT_VAULT = "Caisson Launch";

// ============================================================================================
// Pure: caisson.env name extraction
// ============================================================================================

const NAME_LINE_RE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/;

/** Extract var NAMES only from an env file's text — never the values, never sourced/eval'd. */
export function extractEnvNames(text: string): string[] {
  const names = new Set<string>();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const m = NAME_LINE_RE.exec(line);
    if (m) names.add(m[1] as string);
  }
  return [...names].sort();
}

// ============================================================================================
// Pure: `op item list --format json` parsing
// ============================================================================================

// ponytail: no .strict() — this validates the 1Password CLI's JSON output, not our own API
// boundary; `op` is free to add fields we don't read.
const VaultItemSchema = z.object({
  title: z.string(),
  updated_at: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
const VaultListSchema = z.array(VaultItemSchema);

/** Vault items carrying this tag hold secrets that legitimately live OUTSIDE caisson.env
 *  (GitHub Actions secrets like MIRROR_PUSH_TOKEN, not-yet-provisioned placeholders) — they are
 *  excluded from the name diff instead of reported as "in vault, missing from env". */
export const NON_ENV_TAG = "non-env";

export interface VaultItem {
  title: string;
  updatedAt: string | null;
  tags: string[];
}

/** Parse `op item list --format json` output into {title, updatedAt, tags} — no other field is
 *  ever read, so no value can leak through this path even if `op` includes one. */
export function parseVaultItems(raw: unknown): VaultItem[] {
  return VaultListSchema.parse(raw).map((i) => ({
    title: i.title,
    updatedAt: i.updated_at ?? null,
    tags: i.tags ?? [],
  }));
}

/** Drop items whose tags mark them as out-of-env by design (see `NON_ENV_TAG`). */
export function filterNonEnv(items: readonly VaultItem[]): VaultItem[] {
  return items.filter((i) => !i.tags.includes(NON_ENV_TAG));
}

// ============================================================================================
// Pure: the diff
// ============================================================================================

export interface ParityReport {
  missingFromVault: string[];
  missingFromEnv: string[];
  stale: string[];
}

/** Three-bucket name diff: env names with no vault item, vault items with no env name, and
 *  (when `rotatedAfter` is given) vault items whose `updated_at` predates it — a stale-rotation
 *  signal, not a missing/extra one. */
export function computeParity(
  envNames: readonly string[],
  vaultItems: readonly VaultItem[],
  rotatedAfter?: string,
): ParityReport {
  const envSet = new Set(envNames);
  const vaultTitles = new Set(vaultItems.map((i) => i.title));

  const missingFromVault = [...envSet]
    .filter((n) => !vaultTitles.has(n))
    .sort();
  const missingFromEnv = [...vaultTitles].filter((t) => !envSet.has(t)).sort();

  const stale = rotatedAfter
    ? vaultItems
        .filter(
          (i) =>
            i.updatedAt !== null &&
            Date.parse(i.updatedAt) < Date.parse(rotatedAfter),
        )
        .map((i) => i.title)
        .sort()
    : [];

  return { missingFromVault, missingFromEnv, stale };
}

export function isClean(report: ParityReport): boolean {
  return (
    report.missingFromVault.length === 0 &&
    report.missingFromEnv.length === 0 &&
    report.stale.length === 0
  );
}

/** The ONE place allowed to print the report. Every field is a name string or ISO date — there
 *  is no code path here that can print a secret value. */
export function printReport(
  report: ParityReport,
  write: (s: string) => void = (s) => process.stdout.write(s),
): void {
  write("\nvault-parity-check — Caisson Launch vault vs caisson.env\n");
  write(
    `  in env, missing from vault: ${report.missingFromVault.join(", ") || "(none)"}\n`,
  );
  write(
    `  in vault, missing from env: ${report.missingFromEnv.join(", ") || "(none)"}\n`,
  );
  write(
    `  stale (pre-rotated-after): ${report.stale.join(", ") || "(none)"}\n`,
  );
}

// ============================================================================================
// Pure: argv
// ============================================================================================

export interface ParsedArgs {
  vault: string;
  rotatedAfter?: string;
}

function readFlag(argv: readonly string[], flag: string): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === flag) return argv[i + 1];
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return undefined;
}

export function parseArgv(argv: readonly string[]): ParsedArgs {
  const vault = readFlag(argv, "--vault") ?? DEFAULT_VAULT;
  const rotatedAfter = readFlag(argv, "--rotated-after");
  if (rotatedAfter && Number.isNaN(Date.parse(rotatedAfter))) {
    throw new Error(
      `vault-parity-check: --rotated-after "${rotatedAfter}" is not a parseable date`,
    );
  }
  return { vault, rotatedAfter };
}

// ============================================================================================
// Impure: `op` CLI + filesystem
// ============================================================================================

/** Fail fast with guidance when `op` isn't signed in — every later call needs auth. */
export function preflightAuth(): void {
  try {
    execFileSync("op", ["account", "list"], { encoding: "utf8" });
  } catch {
    process.stderr.write(
      "vault-parity-check: not authenticated with the 1Password CLI. Run `op signin` first.\n",
    );
    process.exit(1);
  }
}

function fetchVaultItems(vault: string): unknown {
  const raw = execFileSync(
    "op",
    ["item", "list", "--vault", vault, "--format", "json"],
    { encoding: "utf8" },
  );
  return JSON.parse(raw);
}

function readEnvNames(): string[] {
  if (!existsSync(ENV_FILE_PATH)) {
    process.stderr.write(
      `vault-parity-check: ${ENV_FILE_PATH} not found — nothing to compare.\n`,
    );
    process.exit(1);
  }
  return extractEnvNames(readFileSync(ENV_FILE_PATH, "utf8"));
}

async function main(): Promise<void> {
  const { vault, rotatedAfter } = parseArgv(process.argv.slice(2));
  preflightAuth();

  const envNames = readEnvNames();
  const allItems = parseVaultItems(fetchVaultItems(vault));
  // Items tagged non-env (GH-Actions secrets, pre-provisioning placeholders) are out of the
  // env↔vault diff by design — count them so their exclusion is visible, never silent.
  const vaultItems = filterNonEnv(allItems);
  const excluded = allItems.length - vaultItems.length;
  const report = computeParity(envNames, vaultItems, rotatedAfter);

  printReport(report);
  if (excluded > 0) {
    // Titles, not just a count — an operator must be able to spot a REAL credential that was
    // wrongly tagged out of the diff at a glance. Titles are names by contract (never values).
    const excludedTitles = allItems
      .filter((i) => i.tags.includes(NON_ENV_TAG))
      .map((i) => i.title)
      .sort()
      .join(", ");
    process.stdout.write(`  excluded as "${NON_ENV_TAG}": ${excludedTitles}\n`);
  }

  if (!isClean(report)) {
    process.stderr.write("\nvault-parity-check: drift found — see above.\n");
    process.exit(1);
  }
  process.stdout.write(
    "\nvault-parity-check: clean — vault and caisson.env agree on names.\n",
  );
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    process.stderr.write(`vault-parity-check: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
