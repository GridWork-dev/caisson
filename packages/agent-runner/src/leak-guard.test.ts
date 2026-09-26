// The LEAK GUARD (ADR-0186 §4 — ship-blocking). The security contract of this package is
// zero-secret-leak-by-construction: the child env is built from scratch, never spread from
// `process.env`. These tests attack `buildEngineEnv` with a polluted parent env, assert the exact
// key set of the built env, and then prove the contract END-TO-END through a real spawn — the stub
// agent CLI dumps its own env into the transcript, and no planted canary may appear in it.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ValidationError } from "@caisson-sh/kernel";
import {
  CLAUDE_CLI_PROFILE,
  PASSTHROUGH_KEYS,
  ProviderConfig,
  buildEngineEnv,
  createAgentRunner,
} from "./index.ts";

const ISOLATED = { home: "/tmp/iso-home", configDir: "/tmp/iso-home/config" };
const BASE = {
  provider: CLAUDE_CLI_PROFILE,
  authKey: "provider-key-ok",
  baseUrl: "https://api.example.com/v1",
  ...ISOLATED,
};

/** A parent env polluted with every credential class the scrubber must strip. */
const SECRET_CANARIES: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-or-canary-9d1",
  GITHUB_TOKEN: "ghp_canary_1a2b3c",
  AWS_SECRET_ACCESS_KEY: "aws-canary-4d5e6f",
  DATABASE_URL: "postgres://user:canary-pass@db/prod",
  STRIPE_SECRET_KEY: "sk_live_canary_7g8h",
  EXEC_BRIDGE_TOKEN: "exec-canary-9i0j",
  SSH_AUTH_SOCK: "/run/user/1000/ssh-canary.sock",
  NPM_CONFIG__AUTH: "npm-canary-b64",
};

const POLLUTED: NodeJS.ProcessEnv = {
  ...SECRET_CANARIES,
  PATH: "/usr/bin:/bin",
  LANG: "en_US.UTF-8",
  TERM: "xterm-256color",
  HOME: "/home/operator",
  USER: "operator",
};

describe("buildEngineEnv — the env scrubber (security core)", () => {
  test("no secret from the parent env reaches the child env (keys AND values)", () => {
    const env = buildEngineEnv(POLLUTED, BASE);
    for (const key of Object.keys(SECRET_CANARIES)) {
      expect(env).not.toHaveProperty(key);
    }
    const flat = JSON.stringify(env);
    for (const value of Object.values(SECRET_CANARIES)) {
      expect(flat).not.toContain(value);
    }
  });

  test("the child env key set is EXACTLY allowlist ∩ parent + isolation + provider routing", () => {
    const env = buildEngineEnv(POLLUTED, BASE);
    expect(Object.keys(env).sort()).toEqual(
      [
        // passthrough allowlist members present in the parent
        "PATH",
        "LANG",
        "TERM",
        // isolation
        "HOME",
        // provider routing (worked profile: base-url + auth + config-dir + model env names)
        CLAUDE_CLI_PROFILE.baseUrlEnv,
        CLAUDE_CLI_PROFILE.authEnv,
        CLAUDE_CLI_PROFILE.configDirEnv as string,
        CLAUDE_CLI_PROFILE.modelEnv as string,
        // hygiene
        "DISABLE_AUTOUPDATER",
        "DISABLE_TELEMETRY",
        "DISABLE_ERROR_REPORTING",
      ].sort(),
    );
  });

  test("HOME is the isolated home, never the operator's", () => {
    const env = buildEngineEnv(POLLUTED, BASE);
    expect(env["HOME"]).toBe(ISOLATED.home);
    expect(env["HOME"]).not.toBe("/home/operator");
    expect(env[CLAUDE_CLI_PROFILE.configDirEnv as string]).toBe(
      ISOLATED.configDir,
    );
  });

  test("only the TARGET provider's key is present, under the configured env name", () => {
    const env = buildEngineEnv(POLLUTED, BASE);
    expect(env[CLAUDE_CLI_PROFILE.authEnv]).toBe("provider-key-ok");
    expect(env[CLAUDE_CLI_PROFILE.baseUrlEnv]).toBe(BASE.baseUrl);
  });

  test("a canary planted in the REAL process.env never crosses", () => {
    process.env["AGENT_RUNNER_LEAK_CANARY"] = "real-env-canary-f00";
    try {
      const env = buildEngineEnv(process.env, BASE);
      expect(env).not.toHaveProperty("AGENT_RUNNER_LEAK_CANARY");
      expect(JSON.stringify(env)).not.toContain("real-env-canary-f00");
      // and nothing outside the contract key set leaked from the real env either
      const allowed = new Set<string>([
        ...PASSTHROUGH_KEYS,
        "HOME",
        CLAUDE_CLI_PROFILE.baseUrlEnv,
        CLAUDE_CLI_PROFILE.authEnv,
        CLAUDE_CLI_PROFILE.configDirEnv as string,
        CLAUDE_CLI_PROFILE.modelEnv as string,
        "DISABLE_AUTOUPDATER",
        "DISABLE_TELEMETRY",
        "DISABLE_ERROR_REPORTING",
      ]);
      for (const key of Object.keys(env)) {
        expect(allowed.has(key)).toBe(true);
      }
    } finally {
      delete process.env["AGENT_RUNNER_LEAK_CANARY"];
    }
  });

  test("empty authKey fails closed", () => {
    expect(() => buildEngineEnv(POLLUTED, { ...BASE, authKey: "  " })).toThrow(
      ValidationError,
    );
  });

  test("non-http(s) baseUrl fails closed (javascript:/file: cannot be routed)", () => {
    for (const bad of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "not a url",
    ]) {
      expect(() => buildEngineEnv(POLLUTED, { ...BASE, baseUrl: bad })).toThrow(
        ValidationError,
      );
    }
  });
});

describe("leak guard end-to-end — a REAL spawn sees a scrubbed env", () => {
  const runsRoot = mkdtempSync(join(tmpdir(), "agent-runner-leak-"));
  const worktree = mkdtempSync(join(tmpdir(), "agent-runner-wt-"));
  const fixture = fileURLToPath(
    new URL("./__fixtures__/stub-agent.ts", import.meta.url),
  );

  afterAll(() => {
    delete process.env["AGENT_RUNNER_E2E_CANARY"];
  });

  test("the child's OWN env dump contains no parent secret", async () => {
    process.env["AGENT_RUNNER_E2E_CANARY"] = "e2e-canary-value-42";
    const runner = createAgentRunner({ runsRoot });
    const stubProvider = ProviderConfig.parse({
      binary: process.execPath, // the bun binary — PATH-independent
      baseUrlEnv: "STUB_BASE_URL",
      authEnv: "STUB_API_KEY",
      model: "stub-model-1",
      args: [fixture, "{task}"],
    });
    const { runId, jsonlPath } = runner.spawn({
      provider: stubProvider,
      task: "leak probe",
      worktree,
      authKey: "stub-key-abc",
      baseUrl: "https://stub.example.com",
    });

    const deadline = Date.now() + 10_000;
    while (runner.status(runId).status === "running") {
      if (Date.now() > deadline) throw new Error("stub agent timed out");
      await Bun.sleep(25);
    }

    const transcript = readFileSync(jsonlPath, "utf8");
    // The stub dumped its ENTIRE env into the transcript: the canary key/value must be absent…
    expect(transcript).not.toContain("AGENT_RUNNER_E2E_CANARY");
    expect(transcript).not.toContain("e2e-canary-value-42");
    // …while the provider routing vars DID arrive.
    expect(transcript).toContain('"STUB_API_KEY":"stub-key-abc"');
    expect(transcript).toContain('"STUB_BASE_URL":"https://stub.example.com"');
    // The child's HOME is the per-run isolated home under runsRoot, not the operator's.
    const initLine = transcript.split("\n").find((l) => l.includes('"init"'));
    const init = JSON.parse(initLine ?? "{}") as {
      env?: Record<string, string>;
    };
    expect(init.env?.["HOME"]).toBe(join(runsRoot, runId, "home"));
  });
});
