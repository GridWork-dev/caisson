// src/evidence/oscal-export-xml.ts — ADR-0180: JSON primary + oscal-cli-driven XML converter path.
//
// JSON is the canonical, byte-stable core-lib output (ADR-0058 `canonicalize`, unchanged). XML is a
// first-class *tooling* output produced by shelling out to NIST's `oscal-cli` — which runs the canonical
// `oscal_<model>_json-to-xml` XSLT. We NEVER hand-roll a TS XML serializer (research pitfall #7).
//
// `oscal-cli` is EXTERNAL tooling (Java/Docker), NOT a Bun/runtime dependency: the deterministic JSON
// path carries no new dep. It is invoked via `execFile` with an ARGUMENT ARRAY (never a shell string /
// template literal). When it is not on PATH, callers guard with `oscalCliAvailable()` and skip — so
// Java-less / credless CI stays green (the JSON path + golden gates still run).
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** The NIST OSCAL model slugs `oscal-cli` accepts as its first subcommand + names the XSLT converter. */
export type OscalModel = "assessment-results" | "poam";

const DEFAULT_BIN = "oscal-cli";
const DEFAULT_TIMEOUT_MS = 60_000;

export interface OscalCliOptions {
  /** The `oscal-cli` executable (default `oscal-cli`, resolved off PATH). */
  readonly binPath?: string;
  /** Hard wall-clock ceiling per invocation (ms). */
  readonly timeoutMs?: number;
}

/**
 * Args for `oscal-cli convert --to=xml <in> <out>` — the generic converter auto-detects the model from
 * the JSON root (the per-model subcommands `ar`/`poam` are deprecated in oscal-cli 3.x). Runs the NIST
 * `oscal_<model>_json-to-xml` XSLT. Arg array, never a shell string.
 */
export function buildConvertArgs(
  input: string,
  output: string,
): readonly string[] {
  return ["convert", "--to=xml", "--overwrite", input, output];
}

/**
 * Args for `oscal-cli validate --disable-constraint-validation <path>` — the NIST XSD-conformance gate
 * at the locked version. SCHEMA-only by design: Metaschema *constraint* validation resolves external
 * refs (e.g. our `import-ap` rlink to the published assessment-plan URL), which is a deploy-time concern,
 * not an export-well-formedness one. The offline gate proves the emitted doc is schema-valid at v1.2.2.
 */
export function buildValidateArgs(path: string): readonly string[] {
  return ["validate", "--disable-constraint-validation", path];
}

/**
 * Is `oscal-cli` runnable on this host? A cheap `--version` probe (arg array, no shell). Callers use it
 * to SKIP the XML path + the round-trip test on a Java-less/credless box so CI stays green (ADR-0180).
 */
export function oscalCliAvailable(binPath: string = DEFAULT_BIN): boolean {
  try {
    execFileSync(binPath, ["--version"], { stdio: "ignore", timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

async function runOscalCli(
  args: readonly string[],
  options: OscalCliOptions,
): Promise<void> {
  const bin = options.binPath ?? DEFAULT_BIN;
  await execFileAsync(bin, [...args], {
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}

/**
 * Convert an OSCAL JSON body to XML via `oscal-cli convert` (NIST XSLT). Writes the JSON to a temp file,
 * runs the converter, returns the XML text. Requires `oscal-cli` on PATH — guard with `oscalCliAvailable`.
 */
export async function convertJsonToXml(
  model: OscalModel,
  jsonBody: unknown,
  options: OscalCliOptions = {},
): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "caisson-oscal-"));
  const input = join(dir, `${model}.json`);
  const output = join(dir, `${model}.xml`);
  try {
    writeFileSync(input, JSON.stringify(jsonBody));
    await runOscalCli(buildConvertArgs(input, output), options);
    return readFileSync(output, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The CI round-trip gate (ADR-0180): JSON → XML (`oscal-cli convert`) → `oscal-cli validate` at the
 * locked version (ADR-0179). Throws if conversion or validation fails; returns the conformant XML.
 * Requires `oscal-cli` on PATH — guard with `oscalCliAvailable` and skip when absent.
 */
export async function convertAndValidate(
  model: OscalModel,
  jsonBody: unknown,
  options: OscalCliOptions = {},
): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "caisson-oscal-"));
  const input = join(dir, `${model}.json`);
  const output = join(dir, `${model}.xml`);
  try {
    writeFileSync(input, JSON.stringify(jsonBody));
    await runOscalCli(buildConvertArgs(input, output), options);
    await runOscalCli(buildValidateArgs(output), options);
    return readFileSync(output, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
