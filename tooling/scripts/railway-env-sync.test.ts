// Unit tests for the PURE functions only — no live `railway` CLI call anywhere in this file.
import { describe, expect, test } from "bun:test";
import {
  buildEnvironmentSection,
  buildLocalOnlyTail,
  buildServiceSection,
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
      generatedAt: "2026-07-02T00:00:00Z",
    });
  });

  test("accepts --generated-at=<value>", () => {
    expect(parseArgv(["--generated-at=2026-07-02T00:00:00Z"])).toEqual({
      generatedAt: "2026-07-02T00:00:00Z",
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
