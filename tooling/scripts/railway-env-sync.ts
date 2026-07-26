// Mirrors Railway project env vars into a local file for offline/editor use. Scripted version of
// a manual `railway variables` mirror (two CLI workarounds below justified writing this down).
//
// READ-ONLY CONTRACT: this script only calls `railway whoami`, `railway status`, `railway
// variables`, and the fixed `railway ssh` presence probes below — all reads. It never calls
// `railway variables set`, `railway up`, or any deploy/mutate command. Railway is the source of
// truth; this file is a mirror of it, never the reverse.
//
// CAISSON-38 CLEARED: admin.caisson.sh lost its HOSTNAME Railway variable and 502'd; this script
// was investigated as the suspect ("env-sync prune"). It has no code path that can remove a
// Railway variable — see the READ-ONLY CONTRACT above and the pinning tests in
// railway-env-sync.test.ts. The real cause was Railway/Docker re-populating the reserved
// `HOSTNAME` name at container boot; fixed durably in apps/admin/Dockerfile (`ENV HOSTNAME=0.0.0.0`,
// PR #151), independent of this or any Railway-side variable sync tool.
//
// Usage:
//   bun tooling/scripts/railway-env-sync.ts --generated-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
//   bun tooling/scripts/railway-env-sync.ts --configured-probe
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";

const ENV_FILE_PATH = join(homedir(), ".gridwork", "caisson.env");
const GRIDWORK_ENV_PATH = join(homedir(), ".gridwork", "env");
const REPO_ROOT = join(import.meta.dir, "..", "..");
const LOCAL_ONLY_MARKER = "# === local-only (not on Railway) ===";
const ASK_AI_SERVICE = "caisson-site";
const ASK_AI_ENVIRONMENT = "production";
export const ASK_AI_REQUIRED_VARIABLES = [
  "DOCS_SERVICE_TOKEN",
  "DOCS_QUERY_URL",
] as const;
type AskAiRequiredVariable = (typeof ASK_AI_REQUIRED_VARIABLES)[number];
// Prefixes worth mirroring names-only from ~/.gridwork/env + repo .env.local files when they are
// NOT already sourced from Railway (secrets/config caisson product code actually reads).
const RELEVANT_PREFIX_RE =
  /^(CAISSON|PADDLE|NEXT_PUBLIC|DISCORD|LINEAR|GRAFANA|CLOUDFLARE|PLAUSIBLE|POSTHOG|OTEL|BETTER_AUTH|LICENSE|SUPPORT_BOT|BILLING|GUILD|OPENROUTER|AWS|AZURE)/;

// ============================================================================================
// railway status --json parsing
// ============================================================================================

// ponytail: no .strict() here. This validates a third-party CLI's JSON output, not our own API
// boundary — Railway is free to add fields we don't read, and .strict() would break every sync
// the moment they do. We only assert the shape we depend on.
const RailwayStatusSchema = z.object({
  name: z.string(),
  environments: z.object({
    edges: z.array(
      z.object({
        node: z.object({
          name: z.string(),
          serviceInstances: z.object({
            edges: z.array(
              z.object({
                node: z.object({ serviceName: z.string() }),
              }),
            ),
          }),
        }),
      }),
    ),
  }),
});

export interface RailwayEnvironment {
  name: string;
  services: string[];
}

export interface RailwayProjectStatus {
  projectName: string;
  environments: RailwayEnvironment[];
}

/** Parse `railway status --json` output. Never hardcode the service/environment list — this is
 *  the one place that enumerates them. */
export function parseRailwayStatus(raw: unknown): RailwayProjectStatus {
  const status = RailwayStatusSchema.parse(raw);
  const environments = status.environments.edges.map((e) => {
    const names = e.node.serviceInstances.edges.map(
      (si) => si.node.serviceName,
    );
    return { name: e.node.name, services: [...new Set(names)].sort() };
  });
  return { projectName: status.name, environments };
}

// ============================================================================================
// Pure: variable parsing, quoting, collision resolution
// ============================================================================================

/** Parse `railway variables --kv` output (`NAME=VALUE` per line; VALUE may itself contain `=`,
 *  so split on the FIRST `=` only). Malformed lines (no `=`) are skipped, not thrown on — CLI
 *  banners can land in stdout too. */
export function parseKv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.length === 0) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    out[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return out;
}

const NEEDS_QUOTE_RE = /[\s"'$`\\]/;

/** Shell-quote a value for an `export NAME=VALUE` line. Single-quoting is sufficient and safe for
 *  every byte except a literal single quote, which is closed/escaped/reopened the POSIX way. */
export function shellQuote(value: string): string {
  if (value.length > 0 && !NEEDS_QUOTE_RE.test(value)) return value;
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function uppercaseServiceKey(service: string): string {
  return service.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

export interface ServiceVars {
  service: string;
  vars: Record<string, string>;
}

export interface Collision {
  name: string;
  services: string[];
}

export interface ResolvedVar {
  service: string;
  originalName: string;
  exportName: string;
  value: string;
}

/** Same NAME, different values across services within one environment → every colliding
 *  occurrence is renamed to `<SERVICE>__NAME`. Same NAME + same value stays plain. */
export function resolveCollisions(services: readonly ServiceVars[]): {
  resolved: ResolvedVar[];
  collisions: Collision[];
} {
  const byName = new Map<string, Map<string, string>>();
  for (const s of services) {
    for (const [name, value] of Object.entries(s.vars)) {
      const svcMap = byName.get(name) ?? new Map<string, string>();
      svcMap.set(s.service, value);
      byName.set(name, svcMap);
    }
  }

  const collisionNames = new Set<string>();
  for (const [name, svcMap] of byName) {
    if (new Set(svcMap.values()).size > 1) collisionNames.add(name);
  }

  const collisions: Collision[] = [...collisionNames].sort().map((name) => ({
    name,
    services: [...(byName.get(name) as Map<string, string>).keys()].sort(),
  }));

  const resolved: ResolvedVar[] = [];
  for (const s of services) {
    const names = Object.keys(s.vars).sort();
    for (const name of names) {
      const value = s.vars[name] as string;
      const exportName = collisionNames.has(name)
        ? `${uppercaseServiceKey(s.service)}__${name}`
        : name;
      resolved.push({
        service: s.service,
        originalName: name,
        exportName,
        value,
      });
    }
  }
  return { resolved, collisions };
}

// ============================================================================================
// Pure: file assembly
// ============================================================================================

export function buildServiceSection(
  service: string,
  resolved: readonly ResolvedVar[],
  collisions: readonly Collision[],
): string {
  const collisionByName = new Map(collisions.map((c) => [c.name, c]));
  const lines = [`# === service: ${service} ===`];
  const forService = resolved
    .filter((v) => v.service === service)
    .sort((a, b) =>
      a.exportName < b.exportName ? -1 : a.exportName > b.exportName ? 1 : 0,
    );
  for (const v of forService) {
    const collision = collisionByName.get(v.originalName);
    if (collision) {
      lines.push(
        `# COLLISION: ${v.originalName} differs across services (${collision.services.join(", ")}) — renamed per-service`,
      );
    }
    lines.push(`export ${v.exportName}=${shellQuote(v.value)}`);
  }
  return lines.join("\n");
}

export function buildEnvironmentSection(
  environmentName: string,
  servicesVars: readonly ServiceVars[],
): { body: string; resolved: ResolvedVar[]; collisions: Collision[] } {
  const { resolved, collisions } = resolveCollisions(servicesVars);
  const serviceNames = [...servicesVars.map((s) => s.service)].sort();
  const sections = serviceNames.map((svc) =>
    buildServiceSection(svc, resolved, collisions),
  );
  const body = [
    `# ===== environment: ${environmentName} =====`,
    ...sections,
  ].join("\n\n");
  return { body, resolved, collisions };
}

export function buildHeader(projectName: string, generatedAt: string): string {
  return [
    "# ~/.gridwork/caisson.env — mirrored from the Railway project, never hand-edited above the",
    `# local-only tail. Project: "${projectName}".`,
    "# Railway is the SOURCE OF TRUTH for every export above the local-only tail below — hand",
    "# edits there are clobbered on the next sync (the local-only tail is the sole exception).",
    `# generated-at: ${generatedAt}`,
    '# re-sync: bun tooling/scripts/railway-env-sync.ts --generated-at "$(date -u +%Y-%m-%dT%H:%M:%SZ)"',
  ].join("\n");
}

// ============================================================================================
// Pure: existing-file parsing (tail preservation + drift)
// ============================================================================================

export interface ParsedExistingFile {
  sectionNames: Map<string, Set<string>>;
  localOnlyTail: string | null;
}

const SERVICE_HEADER_RE = /^# === service: (.+) ===$/;
const EXPORT_LINE_RE = /^export ([A-Za-z_][A-Za-z0-9_]*)=/;

/** Parse a previously-written file: which export names existed per service section, and the
 *  verbatim local-only tail (from the marker to EOF), if present.
 *  ponytail: sections are keyed by service name only, not (environment, service) — fine while
 *  production is the sole environment; a second environment sharing a service name would need
 *  env-scoped keys, add that when a second environment actually ships. */
export function parseExistingFile(text: string): ParsedExistingFile {
  const markerIdx = text.indexOf(LOCAL_ONLY_MARKER);
  const body = markerIdx < 0 ? text : text.slice(0, markerIdx);
  const localOnlyTail = markerIdx < 0 ? null : text.slice(markerIdx).trimEnd();

  const sectionNames = new Map<string, Set<string>>();
  let currentService: string | null = null;
  for (const line of body.split("\n")) {
    const header = SERVICE_HEADER_RE.exec(line);
    if (header) {
      currentService = header[1] as string;
      if (!sectionNames.has(currentService))
        sectionNames.set(currentService, new Set());
      continue;
    }
    const exp = EXPORT_LINE_RE.exec(line);
    if (exp && currentService)
      sectionNames.get(currentService)?.add(exp[1] as string);
  }
  return { sectionNames, localOnlyTail };
}

export interface ServiceDrift {
  service: string;
  missingLocally: string[];
  localOnly: string[];
}

export interface DriftReport {
  environment: string;
  services: ServiceDrift[];
  collisions: readonly Collision[];
}

/** Diff this run's resolved export names against the PREVIOUS file's section for each service:
 *  missing-locally = new on Railway since the last sync; local-only = was in the old file, gone
 *  from Railway now (or the service itself is gone). */
export function computeDrift(
  environmentName: string,
  resolved: readonly ResolvedVar[],
  collisions: readonly Collision[],
  existing: ParsedExistingFile,
): DriftReport {
  const newByService = new Map<string, Set<string>>();
  for (const v of resolved) {
    const set = newByService.get(v.service) ?? new Set<string>();
    set.add(v.exportName);
    newByService.set(v.service, set);
  }
  const allServices = new Set<string>([
    ...newByService.keys(),
    ...existing.sectionNames.keys(),
  ]);
  const services: ServiceDrift[] = [...allServices].sort().map((service) => {
    const newNames = newByService.get(service) ?? new Set<string>();
    const oldNames = existing.sectionNames.get(service) ?? new Set<string>();
    return {
      service,
      missingLocally: [...newNames].filter((n) => !oldNames.has(n)).sort(),
      localOnly: [...oldNames].filter((n) => !newNames.has(n)).sort(),
    };
  });
  return { environment: environmentName, services, collisions };
}

/** The ONE place allowed to print drift data. Every parameter is a name (string), never a value —
 *  there is no code path here that can print a secret. */
export function printDriftReport(
  report: DriftReport,
  write: (s: string) => void = (s) => process.stdout.write(s),
): void {
  write(`\nDrift report — environment: ${report.environment}\n`);
  for (const svc of report.services) {
    write(`  service: ${svc.service}\n`);
    write(
      `    missing-locally: ${svc.missingLocally.join(", ") || "(none)"}\n`,
    );
    write(`    local-only: ${svc.localOnly.join(", ") || "(none)"}\n`);
  }
  write(
    `  collisions: ${report.collisions.map((c) => c.name).join(", ") || "(none)"}\n`,
  );
}

// ============================================================================================
// Pure: local-only tail generation (first sync only — later syncs preserve it verbatim)
// ============================================================================================

/** Extract variable NAMES (never values) from a bash-sourced env file: `[export ]NAME=...`,
 *  skipping blanks/comments. */
export function extractEnvVarNames(text: string): string[] {
  const names: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    if (m) names.push(m[1] as string);
  }
  return names;
}

export function filterRelevantNames(
  names: readonly string[],
  onRailway: ReadonlySet<string>,
): string[] {
  const out = new Set<string>();
  for (const n of names) {
    if (RELEVANT_PREFIX_RE.test(n) && !onRailway.has(n)) out.add(n);
  }
  return [...out].sort();
}

export function buildLocalOnlyTail(names: readonly string[]): string {
  return [
    LOCAL_ONLY_MARKER,
    "# Names only — no values echoed here (see ~/.gridwork/env or the repo's .env.local files).",
    "# Generated once on first sync from ~/.gridwork/env + repo .env.local files (caisson-relevant",
    "# prefixes absent from Railway); preserved VERBATIM on every re-sync after that. Hand-edit",
    "# this list freely — the sync script never rewrites it once it exists.",
    ...names.map((n) => `# ${n}`),
  ].join("\n");
}

// ============================================================================================
// Impure: Railway CLI + filesystem
// ============================================================================================

/** The read-only contract (CAISSON-38), enforced at the single subprocess choke point: this
 *  script mirrors Railway state and must never mutate it. An allowlist of read verbs — not a
 *  denylist of write ones — so a future `up`/`redeploy`/`run` call cannot slip in unnoticed. */
const READ_ONLY_RAILWAY_VERBS = new Set(["whoami", "status", "variables"]);

/** Build the only Railway SSH commands this script permits. `${NAME+x}` asks the remote shell
 * whether NAME exists without expanding, reading, comparing, measuring, or printing its value. */
export function buildConfiguredProbeArgs(variable: string): string[] {
  if (!ASK_AI_REQUIRED_VARIABLES.includes(variable as AskAiRequiredVariable)) {
    throw new Error(
      `railway-env-sync configured probe refuses unknown variable name: ${variable}`,
    );
  }
  return [
    "ssh",
    "--service",
    ASK_AI_SERVICE,
    "--environment",
    ASK_AI_ENVIRONMENT,
    "sh",
    "-c",
    `test "\${${variable}+x}" = x`,
  ];
}

function isConfiguredProbeArgs(args: readonly string[]): boolean {
  return ASK_AI_REQUIRED_VARIABLES.some((variable) => {
    const allowed = buildConfiguredProbeArgs(variable);
    return (
      args.length === allowed.length &&
      args.every((arg, index) => arg === allowed[index])
    );
  });
}

export function assertReadOnlyRailwayArgs(args: readonly string[]): void {
  const verb = args[0];
  if (verb === "ssh") {
    if (isConfiguredProbeArgs(args)) return;
    throw new Error(
      "railway-env-sync is a read-only mirror; refusing non-presence Railway SSH command",
    );
  }
  if (verb === undefined || !READ_ONLY_RAILWAY_VERBS.has(verb)) {
    throw new Error(
      `railway-env-sync is a read-only mirror; refusing non-read railway verb: ${String(verb)}`,
    );
  }
  // `variables` is a read ONLY without its write flag (`railway variables --set KEY=VAL`).
  if (args.includes("--set")) {
    throw new Error(
      "railway-env-sync is a read-only mirror; refusing railway variables --set",
    );
  }
}

function railway(args: string[]): string {
  assertReadOnlyRailwayArgs(args);
  return execFileSync("railway", args, { encoding: "utf8" });
}

export interface ConfiguredPresenceResult {
  variable: AskAiRequiredVariable;
  present: boolean;
}

/** Run the fixed Ask-AI presence probes. The injected runner returns only the command's boolean
 * status; no variable value can enter this function or its report type. */
export function checkConfiguredPresence(
  run: (args: string[]) => boolean,
): ConfiguredPresenceResult[] {
  return ASK_AI_REQUIRED_VARIABLES.map((variable) => ({
    variable,
    present: run(buildConfiguredProbeArgs(variable)),
  }));
}

export function printConfiguredPresence(
  report: readonly ConfiguredPresenceResult[],
  write: (text: string) => void = (text) => process.stdout.write(text),
): void {
  write(
    `\nAsk-AI configured probe — ${ASK_AI_SERVICE} [${ASK_AI_ENVIRONMENT}]\n`,
  );
  for (const result of report) {
    write(`  ${result.variable}: ${result.present ? "PRESENT" : "MISSING"}\n`);
  }
}

function runConfiguredPresenceProbe(): void {
  const report = checkConfiguredPresence((args) => {
    try {
      railway(args);
      return true;
    } catch {
      return false;
    }
  });
  printConfiguredPresence(report);
  const missing = report
    .filter((result) => !result.present)
    .map((result) => result.variable);
  if (missing.length > 0) {
    throw new Error(
      `Ask-AI configured probe failed on ${ASK_AI_SERVICE}; missing: ${missing.join(", ")}`,
    );
  }
  process.stdout.write(
    "Ask-AI configured probe: green — required variable names are present.\n",
  );
}

/** Fail fast with a clear message when not logged in — every later call needs auth. */
export function preflightAuth(): void {
  try {
    railway(["whoami"]);
  } catch {
    process.stderr.write(
      "railway-env-sync: not authenticated with the Railway CLI. Run `railway login` first.\n",
    );
    process.exit(1);
  }
}

function fetchStatus(): unknown {
  return JSON.parse(railway(["status", "--json"]));
}

/** Gotcha (2026-07-02): passing `--environment` when the project has exactly one environment has
 *  previously broken this CLI. Only pass it once multiple environments are enumerated — verified
 *  working against both code paths this session; kept defensive since a single-env project never
 *  exercises the flag anyway. */
function fetchServiceVars(
  service: string,
  environmentName: string,
  multiEnv: boolean,
): Record<string, string> {
  const args = ["variables", "--service", service, "--kv"];
  if (multiEnv) args.push("--environment", environmentName);
  return parseKv(railway(args));
}

function gatherLocalOnlyCandidateNames(): string[] {
  const names: string[] = [];
  if (existsSync(GRIDWORK_ENV_PATH)) {
    names.push(...extractEnvVarNames(readFileSync(GRIDWORK_ENV_PATH, "utf8")));
  }
  const glob = new Bun.Glob("**/.env.local");
  for (const file of glob.scanSync({
    cwd: REPO_ROOT,
    absolute: true,
    dot: true,
  })) {
    if (file.includes("/node_modules/") || file.includes("/.git/")) continue;
    names.push(...extractEnvVarNames(readFileSync(file, "utf8")));
  }
  return names;
}

/** Atomic write: open the temp file at mode 0o600 BEFORE any content lands (never a window where
 *  the file exists world/group-readable), write, then rename over the final path. */
function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${process.pid}`;
  const fd = openSync(tmpPath, "w", 0o600);
  try {
    writeSync(fd, content);
  } finally {
    closeSync(fd);
  }
  renameSync(tmpPath, path);
}

export type ParsedArgs =
  { mode: "sync"; generatedAt: string } | { mode: "configured-probe" };

export function parseArgv(argv: readonly string[]): ParsedArgs {
  if (argv.includes("--configured-probe")) {
    if (argv.length !== 1) {
      throw new Error(
        "railway-env-sync: --configured-probe cannot be combined with sync arguments",
      );
    }
    return { mode: "configured-probe" };
  }
  let generatedAt: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "--generated-at") {
      generatedAt = argv[i + 1];
      i++;
    } else if (arg.startsWith("--generated-at=")) {
      generatedAt = arg.slice("--generated-at=".length);
    }
  }
  if (!generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error(
      "railway-env-sync: --generated-at <ISO-8601 timestamp> is required — the script does not " +
        "trust its own clock (it may run under contexts without one), so the caller supplies it.",
    );
  }
  return { mode: "sync", generatedAt };
}

async function main(): Promise<void> {
  const parsed = parseArgv(process.argv.slice(2));
  preflightAuth();
  if (parsed.mode === "configured-probe") {
    runConfiguredPresenceProbe();
    return;
  }
  const { generatedAt } = parsed;

  const status = parseRailwayStatus(fetchStatus());
  const existingText = existsSync(ENV_FILE_PATH)
    ? readFileSync(ENV_FILE_PATH, "utf8")
    : "";
  const existing = parseExistingFile(existingText);

  const multiEnv = status.environments.length > 1;
  const envSections: string[] = [];
  const driftReports: DriftReport[] = [];
  const allRailwayNames = new Set<string>();

  for (const env of status.environments) {
    const servicesVars: ServiceVars[] = env.services.map((service) => {
      const vars = fetchServiceVars(service, env.name, multiEnv);
      for (const name of Object.keys(vars)) allRailwayNames.add(name);
      return { service, vars };
    });
    const { body, resolved, collisions } = buildEnvironmentSection(
      env.name,
      servicesVars,
    );
    envSections.push(body);
    driftReports.push(computeDrift(env.name, resolved, collisions, existing));
  }

  const localOnlyTail =
    existing.localOnlyTail ??
    buildLocalOnlyTail(
      filterRelevantNames(gatherLocalOnlyCandidateNames(), allRailwayNames),
    );

  const header = buildHeader(status.projectName, generatedAt);
  const fullText = `${[header, ...envSections, localOnlyTail].join("\n\n")}\n`;

  writeAtomic(ENV_FILE_PATH, fullText);

  for (const report of driftReports) printDriftReport(report);
  process.stdout.write(`\nrailway-env-sync: wrote ${ENV_FILE_PATH}\n`);
}

if (import.meta.main) {
  main().catch((err: unknown) => {
    process.stderr.write(`railway-env-sync: ${(err as Error).message}\n`);
    process.exit(1);
  });
}
