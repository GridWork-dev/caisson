// Unit tests for the PURE functions only — no live `railway` CLI call anywhere in this file.
import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  ASK_AI_REQUIRED_VARIABLES,
  assertReadOnlyRailwayArgs,
  buildConfiguredProbeArgs,
  buildEnvironmentSection,
  buildLocalOnlyTail,
  buildServiceSection,
  checkConfiguredPresence,
  computeDrift,
  extractEnvVarNames,
  filterRelevantNames,
  parseArgv,
  parseExistingFile,
  parseKv,
  parseRailwayStatus,
  printDriftReport,
  resolveCollisions,
  shellQuote,
  uppercaseServiceKey,
  type ServiceVars,
} from "./railway-env-sync";

describe("parseKv", () => {
  test("parses NAME=VALUE lines", () => {
    expect(parseKv("FOO=bar\nBAZ=qux\n")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  test("splits only on the first `=` (values may contain `=`)", () => {
    expect(parseKv("URL=postgres://x?opt=1&y=2")).toEqual({
      URL: "postgres://x?opt=1&y=2",
    });
  });

  test("skips blank and malformed (no `=`) lines", () => {
    expect(parseKv("\nFOO=bar\n\nnot-a-kv-line\nBAZ=qux\n")).toEqual({
      FOO: "bar",
      BAZ: "qux",
    });
  });

  test("empty input yields an empty object", () => {
    expect(parseKv("")).toEqual({});
  });
});

describe("shellQuote", () => {
  test("plain values pass through unquoted", () => {
    expect(shellQuote("plain-value123")).toBe("plain-value123");
  });

  test("quotes values containing whitespace", () => {
    expect(shellQuote("has space")).toBe("'has space'");
  });

  test("quotes and escapes an embedded single quote", () => {
    expect(shellQuote("it's here")).toBe("'it'\\''s here'");
  });

  test("quotes values with $ ` and backslash", () => {
    expect(shellQuote("$HOME")).toBe("'$HOME'");
    expect(shellQuote("`cmd`")).toBe("'`cmd`'");
    expect(shellQuote("a\\b")).toBe("'a\\b'");
  });

  test("empty string is quoted (not left bare)", () => {
    expect(shellQuote("")).toBe("''");
  });
});

describe("uppercaseServiceKey", () => {
  test("uppercases and replaces non-alphanumerics with underscores", () => {
    expect(uppercaseServiceKey("caisson-support-bot")).toBe(
      "CAISSON_SUPPORT_BOT",
    );
    expect(uppercaseServiceKey("caisson.docs")).toBe("CAISSON_DOCS");
  });
});

describe("resolveCollisions", () => {
  test("same name + same value across services stays plain (no rename)", () => {
    const services: ServiceVars[] = [
      { service: "site", vars: { OPENROUTER_API_KEY: "sk-1" } },
      { service: "docs", vars: { OPENROUTER_API_KEY: "sk-1" } },
    ];
    const { resolved, collisions } = resolveCollisions(services);
    expect(collisions).toEqual([]);
    expect(resolved.map((r) => r.exportName)).toEqual([
      "OPENROUTER_API_KEY",
      "OPENROUTER_API_KEY",
    ]);
  });

  test("same name + different value across services renames every occurrence", () => {
    const services: ServiceVars[] = [
      { service: "site", vars: { DATABASE_URL: "postgres://a" } },
      { service: "license", vars: { DATABASE_URL: "postgres://b" } },
    ];
    const { resolved, collisions } = resolveCollisions(services);
    expect(collisions).toEqual([
      { name: "DATABASE_URL", services: ["license", "site"] },
    ]);
    const bySvc = Object.fromEntries(
      resolved.map((r) => [r.service, r.exportName]),
    );
    expect(bySvc.site).toBe("SITE__DATABASE_URL");
    expect(bySvc.license).toBe("LICENSE__DATABASE_URL");
  });

  test("a name unique to one service is never renamed", () => {
    const services: ServiceVars[] = [
      { service: "site", vars: { NEXT_PUBLIC_PADDLE_ENV: "sandbox" } },
    ];
    const { resolved, collisions } = resolveCollisions(services);
    expect(collisions).toEqual([]);
    expect(resolved[0]?.exportName).toBe("NEXT_PUBLIC_PADDLE_ENV");
  });
});

describe("buildServiceSection + buildEnvironmentSection", () => {
  test("renders a collision comment above the renamed export line", () => {
    const services: ServiceVars[] = [
      { service: "site", vars: { DATABASE_URL: "postgres://a" } },
      { service: "license", vars: { DATABASE_URL: "postgres://b" } },
    ];
    const { resolved, collisions } = resolveCollisions(services);
    const section = buildServiceSection("site", resolved, collisions);
    expect(section).toContain("# === service: site ===");
    expect(section).toContain(
      "# COLLISION: DATABASE_URL differs across services (license, site)",
    );
    expect(section).toContain("export SITE__DATABASE_URL=postgres://a");
  });

  test("assembles a full environment section across services, sorted", () => {
    const services: ServiceVars[] = [
      { service: "zeta", vars: { A: "1" } },
      { service: "alpha", vars: { B: "2" } },
    ];
    const { body } = buildEnvironmentSection("production", services);
    expect(body.indexOf("service: alpha")).toBeLessThan(
      body.indexOf("service: zeta"),
    );
    expect(body).toContain("# ===== environment: production =====");
  });
});

describe("parseExistingFile", () => {
  test("extracts export names per service section and the verbatim local-only tail", () => {
    const text = [
      "# header",
      "",
      "# ===== environment: production =====",
      "",
      "# === service: site ===",
      "export FOO=bar",
      "export BAZ=qux",
      "",
      "# === service: docs ===",
      "export ONE=1",
      "",
      "# === local-only (not on Railway) ===",
      "# LOCAL_SECRET",
    ].join("\n");
    const parsed = parseExistingFile(text);
    expect([...(parsed.sectionNames.get("site") ?? [])].sort()).toEqual([
      "BAZ",
      "FOO",
    ]);
    expect([...(parsed.sectionNames.get("docs") ?? [])].sort()).toEqual([
      "ONE",
    ]);
    expect(parsed.localOnlyTail).toContain("# LOCAL_SECRET");
    expect(parsed.localOnlyTail?.startsWith("# === local-only")).toBe(true);
  });

  test("no marker present yields a null tail", () => {
    const parsed = parseExistingFile(
      "# === service: site ===\nexport FOO=bar\n",
    );
    expect(parsed.localOnlyTail).toBeNull();
  });

  test("empty file yields no sections and a null tail", () => {
    const parsed = parseExistingFile("");
    expect(parsed.sectionNames.size).toBe(0);
    expect(parsed.localOnlyTail).toBeNull();
  });
});

describe("computeDrift", () => {
  test("categorizes new-on-Railway vs no-longer-on-Railway per service", () => {
    const services: ServiceVars[] = [
      { service: "site", vars: { NEW_VAR: "1", KEPT: "2" } },
    ];
    const { resolved, collisions } = resolveCollisions(services);
    const existing = parseExistingFile(
      ["# === service: site ===", "export KEPT=old", "export GONE=old"].join(
        "\n",
      ),
    );
    const report = computeDrift("production", resolved, collisions, existing);
    const site = report.services.find((s) => s.service === "site");
    expect(site?.missingLocally).toEqual(["NEW_VAR"]);
    expect(site?.localOnly).toEqual(["GONE"]);
  });

  test("a service present in the old file but absent from this sync is reported entirely local-only", () => {
    const existing = parseExistingFile(
      ["# === service: retired-service ===", "export X=1"].join("\n"),
    );
    const report = computeDrift("production", [], [], existing);
    const retired = report.services.find(
      (s) => s.service === "retired-service",
    );
    expect(retired?.localOnly).toEqual(["X"]);
    expect(retired?.missingLocally).toEqual([]);
  });
});

describe("printDriftReport — the value-safety guard", () => {
  test("never emits a value, only names, even when fed secret-shaped fixture data", () => {
    const secretValue = "sk-super-secret-token-should-never-print";
    const services: ServiceVars[] = [
      { service: "site", vars: { API_KEY: secretValue } },
    ];
    const { resolved, collisions } = resolveCollisions(services);
    const report = computeDrift(
      "production",
      resolved,
      collisions,
      parseExistingFile(""),
    );

    const chunks: string[] = [];
    printDriftReport(report, (s) => chunks.push(s));
    const output = chunks.join("");

    expect(output).toContain("API_KEY");
    expect(output).not.toContain(secretValue);
  });
});

describe("extractEnvVarNames", () => {
  test("extracts names from both `export NAME=` and bare `NAME=` forms", () => {
    const text = [
      "export FOO=1",
      "BAR=2",
      "# a comment",
      "",
      "  BAZ = should-not-match",
    ].join("\n");
    expect(extractEnvVarNames(text)).toEqual(["FOO", "BAR"]);
  });
});

describe("filterRelevantNames", () => {
  test("keeps caisson-relevant prefixes absent from Railway, drops the rest", () => {
    const names = [
      "CAISSON_FOO",
      "PADDLE_KEY",
      "RANDOM_UNRELATED",
      "GRAFANA_URL",
    ];
    const onRailway = new Set(["GRAFANA_URL"]);
    expect(filterRelevantNames(names, onRailway)).toEqual([
      "CAISSON_FOO",
      "PADDLE_KEY",
    ]);
  });
});

describe("buildLocalOnlyTail", () => {
  test("renders name-only comment lines under the marker", () => {
    const tail = buildLocalOnlyTail(["CAISSON_FOO", "PADDLE_KEY"]);
    expect(tail).toContain("# === local-only (not on Railway) ===");
    expect(tail).toContain("# CAISSON_FOO");
    expect(tail).toContain("# PADDLE_KEY");
  });
});

describe("parseArgv", () => {
  test("accepts --generated-at <value>", () => {
    expect(parseArgv(["--generated-at", "2026-07-02T00:00:00Z"])).toEqual({
      mode: "sync",
      generatedAt: "2026-07-02T00:00:00Z",
    });
  });

  test("accepts --generated-at=<value>", () => {
    expect(parseArgv(["--generated-at=2026-07-02T00:00:00Z"])).toEqual({
      mode: "sync",
      generatedAt: "2026-07-02T00:00:00Z",
    });
  });

  test("accepts the presence-only configured probe without a generated-at timestamp", () => {
    expect(parseArgv(["--configured-probe"])).toEqual({
      mode: "configured-probe",
    });
  });

  test("throws when the flag is missing", () => {
    expect(() => parseArgv([])).toThrow(/--generated-at/);
  });

  test("throws when the value is not a parseable date", () => {
    expect(() => parseArgv(["--generated-at", "not-a-date"])).toThrow(
      /--generated-at/,
    );
  });
});

describe("Ask-AI configured probe", () => {
  test("checks only presence on caisson-site and never requests variable values", () => {
    expect(ASK_AI_REQUIRED_VARIABLES).toEqual([
      "DOCS_SERVICE_TOKEN",
      "DOCS_QUERY_URL",
    ]);

    for (const variable of ASK_AI_REQUIRED_VARIABLES) {
      const args = buildConfiguredProbeArgs(variable);
      expect(args.slice(0, 5)).toEqual([
        "ssh",
        "--service",
        "caisson-site",
        "--environment",
        "production",
      ]);
      expect(args).not.toContain("variables");
      expect(args).not.toContain("--json");
      expect(args).not.toContain("--kv");
      expect(args.at(-1)).toBe(`test "\${${variable}+x}" = x`);
      expect(() => assertReadOnlyRailwayArgs(args)).not.toThrow();
    }
  });

  test("reports each configured name without reading, printing, or comparing a value", () => {
    const calls: string[][] = [];
    const report = checkConfiguredPresence((args) => {
      calls.push([...args]);
      return args.at(-1)?.includes("DOCS_SERVICE_TOKEN") ?? false;
    });

    expect(calls).toEqual(
      ASK_AI_REQUIRED_VARIABLES.map((variable) =>
        buildConfiguredProbeArgs(variable),
      ),
    );
    expect(report).toEqual([
      { variable: "DOCS_SERVICE_TOKEN", present: true },
      { variable: "DOCS_QUERY_URL", present: false },
    ]);
  });

  test("the Railway guard rejects every SSH command outside the fixed presence probes", () => {
    expect(() =>
      assertReadOnlyRailwayArgs([
        "ssh",
        "--service",
        "caisson-site",
        "sh",
        "-c",
        "env",
      ]),
    ).toThrow(/read-only mirror/);
  });
});

describe("parseRailwayStatus", () => {
  test("parses project name + per-environment deduped, sorted service names", () => {
    const raw = {
      name: "caisson-prod",
      environments: {
        edges: [
          {
            node: {
              name: "production",
              serviceInstances: {
                edges: [
                  { node: { serviceName: "caisson-site" } },
                  { node: { serviceName: "caisson-admin" } },
                  { node: { serviceName: "caisson-site" } },
                ],
              },
            },
          },
        ],
      },
      // Railway may add fields we don't read — parseRailwayStatus must not choke on them.
      workspace: { id: "unrelated" },
    };
    const status = parseRailwayStatus(raw);
    expect(status.projectName).toBe("caisson-prod");
    expect(status.environments).toEqual([
      { name: "production", services: ["caisson-admin", "caisson-site"] },
    ]);
  });
});

// CAISSON-38: admin.caisson.sh lost its HOSTNAME Railway variable and 502'd; this script was the
// suspect ("env-sync prune"). Investigation: the header above declares a READ-ONLY CONTRACT — the
// only `railway` subprocess calls in the file are `whoami`, `status --json`, and `variables --kv`
// (all reads); `computeDrift`/`printDriftReport` only ever PRINT a diagnostic, they never write to
// Railway or rewrite the local file's existing content (the local-only tail is preserved verbatim
// once it exists). CLEARED: there is no code path here capable of removing a Railway variable. The
// two tests below pin that finding so a future edit can't reintroduce a write path unnoticed, and
// prove a Railway-set var round-trips through the pure pipeline unchanged while one that vanishes
// from Railway is SURFACED in the drift report rather than silently dropped. The real root cause
// (docs/deploy/STATE.md, 2026-07-07 entry) was Railway/Docker re-populating the reserved
// `HOSTNAME` name at container boot, independent of any local tooling — fixed durably by baking
// `ENV HOSTNAME=0.0.0.0` straight into apps/admin/Dockerfile (PR #151), which survives regardless
// of what this (or any) Railway-side variable mirror does.
describe("CAISSON-38 — read-only contract (protected var survives a sync)", () => {
  test("the railway choke point refuses any non-read invocation (allowlist)", () => {
    for (const args of [
      ["whoami"],
      ["status", "--json"],
      ["variables", "--service", "caisson-admin", "--kv"],
    ]) {
      expect(() => assertReadOnlyRailwayArgs(args)).not.toThrow();
    }
    for (const args of [
      ["up"],
      ["redeploy"],
      ["run", "true"],
      ["unset"],
      ["environment", "delete"],
      ["variables", "--set", "HOSTNAME="],
      [],
    ]) {
      expect(() => assertReadOnlyRailwayArgs(args)).toThrow(/read-only mirror/);
    }
  });

  test("every railway subprocess call routes through the guarded choke point", () => {
    const source = readFileSync(
      new URL("./railway-env-sync.ts", import.meta.url),
      "utf8",
    );
    // Exactly one raw execFileSync("railway", ...) — the guarded railway() helper itself. Any
    // second spawn site would bypass the allowlist and fail here.
    expect(source.match(/execFileSync\(\s*"railway"/g)?.length).toBe(1);
  });

  test("a Railway-set var (HOSTNAME) round-trips into the generated file unchanged", () => {
    const services: ServiceVars[] = [
      {
        service: "caisson-admin",
        vars: { HOSTNAME: "0.0.0.0", PORT: "8080" },
      },
    ];
    const { body } = buildEnvironmentSection("production", services);
    expect(body).toContain("export HOSTNAME=0.0.0.0");
  });

  test("a var that disappears from Railway since the last sync is SURFACED, not silently dropped", () => {
    const existing = parseExistingFile(
      [
        "# === service: caisson-admin ===",
        "export HOSTNAME=0.0.0.0",
        "export PORT=8080",
      ].join("\n"),
    );
    // This sync's fresh `railway variables --kv` fetch no longer includes HOSTNAME — simulating
    // the CAISSON-38 incident on the RAILWAY side, never something this tool did.
    const services: ServiceVars[] = [
      { service: "caisson-admin", vars: { PORT: "8080" } },
    ];
    const { resolved, collisions } = resolveCollisions(services);
    const report = computeDrift("production", resolved, collisions, existing);
    const admin = report.services.find((s) => s.service === "caisson-admin");
    expect(admin?.localOnly).toEqual(["HOSTNAME"]);
    expect(admin?.missingLocally).toEqual([]);
  });
});
