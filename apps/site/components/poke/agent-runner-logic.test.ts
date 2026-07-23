// Real-package parity for the agent-runner poke's browser mirror (agent-runner-logic.ts). No
// packages/agent-runner/src/__golden__ fixture dir exists, so parity runs directly against the
// real package's own functions -- imported here by relative path (apps/site does not declare
// @caisson/agent-runner as a workspace dependency; see agent-runner-logic.ts's header for why the
// browser bundle can't import it directly). Bun's test runtime is node-like, so the real package's
// node:child_process / node:fs imports resolve fine here even though they cannot reach a browser
// bundle. This is the same leak-guard contract packages/agent-runner/src/leak-guard.test.ts asserts
// (ADR-0186 SS4, ship-blocking) -- re-run here against the mirror.
//
// The real module is loaded via a COMPUTED (non-literal) dynamic import path, not a static import,
// so TypeScript treats it as opaque rather than pulling packages/agent-runner/src/agent-runner.ts
// into apps/site's own compile graph -- that file's `spawn(..., { env })` call types against
// NodeJS.ProcessEnv, which Next.js augments with a required NODE_ENV in this app's program (a
// mismatch invisible to the package's own standalone tsconfig, unrelated to the logic under test
// here). Only the RUNTIME values are needed for parity; Bun resolves the relative specifier
// identically to a static import either way.
import { beforeAll, describe, expect, test } from "bun:test";
import { ValidationError as PkgValidationError } from "@caisson/kernel";

import {
  CLAUDE_CLI_PROFILE,
  PASSTHROUGH_KEYS,
  addedKeys,
  buildEngineEnv,
} from "./agent-runner-logic";
import type { EnvScrubError } from "./agent-runner-logic";

const AGENT_RUNNER_SRC: string =
  "../../../../packages/agent-runner/src/agent-runner.ts";

interface RealProviderRouting {
  readonly baseUrlEnv: string;
  readonly authEnv: string;
  readonly model: string;
  readonly configDirEnv?: string;
  readonly modelEnv?: string;
}

interface RealAgentRunnerModule {
  readonly PASSTHROUGH_KEYS: readonly string[];
  readonly CLAUDE_CLI_PROFILE: RealProviderRouting;
  buildEngineEnv(
    parentEnv: Record<string, string | undefined>,
    opts: {
      provider: RealProviderRouting;
      authKey: string;
      baseUrl: string;
      home: string;
      configDir: string;
    },
  ): Record<string, string>;
}

let pkgPassthroughKeys: readonly string[];
let pkgClaudeCliProfile: RealProviderRouting;
let pkgBuildEngineEnv: RealAgentRunnerModule["buildEngineEnv"];

beforeAll(async () => {
  const real = (await import(
    AGENT_RUNNER_SRC
  )) as unknown as RealAgentRunnerModule;
  pkgPassthroughKeys = real.PASSTHROUGH_KEYS;
  pkgClaudeCliProfile = real.CLAUDE_CLI_PROFILE;
  pkgBuildEngineEnv = real.buildEngineEnv;
});

/** A parent env polluted with every credential class the real leak-guard test attacks with. */
const SECRET_CANARIES: Record<string, string> = {
  OPENROUTER_API_KEY: "sk-or-canary-9d1",
  GITHUB_TOKEN: "ghp_canary_1a2b3c",
  DATABASE_URL: "postgres://user:canary-pass@db/prod",
};

const POLLUTED: Record<string, string> = {
  ...SECRET_CANARIES,
  PATH: "/usr/bin:/bin",
  LANG: "en_US.UTF-8",
  TERM: "xterm-256color",
  HOME: "/home/operator",
  USER: "operator",
};

const ISOLATED = { home: "/tmp/iso-home", configDir: "/tmp/iso-home/config" };
const BASE = {
  authKey: "provider-key-ok",
  baseUrl: "https://api.example.com/v1",
  ...ISOLATED,
};

describe("PASSTHROUGH_KEYS / CLAUDE_CLI_PROFILE -- verbatim parity with the real package", () => {
  test("PASSTHROUGH_KEYS matches the real array exactly, in order", () => {
    expect(pkgPassthroughKeys).toEqual(PASSTHROUGH_KEYS);
  });

  test("the mirrored routing fields match the real CLAUDE_CLI_PROFILE", () => {
    expect(CLAUDE_CLI_PROFILE.baseUrlEnv).toBe(pkgClaudeCliProfile.baseUrlEnv);
    expect(CLAUDE_CLI_PROFILE.authEnv).toBe(pkgClaudeCliProfile.authEnv);
    expect(CLAUDE_CLI_PROFILE.model).toBe(pkgClaudeCliProfile.model);
    expect(CLAUDE_CLI_PROFILE.configDirEnv).toBe(
      pkgClaudeCliProfile.configDirEnv,
    );
    expect(CLAUDE_CLI_PROFILE.modelEnv).toBe(pkgClaudeCliProfile.modelEnv);
  });
});

describe("buildEngineEnv -- parity with the real package on a polluted parent env", () => {
  test("mirror and real produce byte-identical output", () => {
    const real = pkgBuildEngineEnv(POLLUTED, {
      provider: pkgClaudeCliProfile,
      ...BASE,
    });
    const mine = buildEngineEnv(POLLUTED, {
      provider: CLAUDE_CLI_PROFILE,
      ...BASE,
    });
    expect(mine).toEqual(real);
  });

  test("no secret canary from the parent env reaches either the mirror or the real output", () => {
    const mine = buildEngineEnv(POLLUTED, {
      provider: CLAUDE_CLI_PROFILE,
      ...BASE,
    });
    for (const key of Object.keys(SECRET_CANARIES)) {
      expect(mine).not.toHaveProperty(key);
    }
    const flat = JSON.stringify(mine);
    for (const value of Object.values(SECRET_CANARIES)) {
      expect(flat).not.toContain(value);
    }
  });

  test("the built key set is EXACTLY allowlist-present + isolation + provider routing + hygiene", () => {
    const mine = buildEngineEnv(POLLUTED, {
      provider: CLAUDE_CLI_PROFILE,
      ...BASE,
    });
    expect(Object.keys(mine).sort()).toEqual(
      ["PATH", "LANG", "TERM", ...addedKeys(CLAUDE_CLI_PROFILE)].sort(),
    );
  });

  test("removing a passthrough key from the parent removes it from the child (mirror and real agree)", () => {
    const { PATH: _drop, ...withoutPath } = POLLUTED;
    void _drop;
    const real = pkgBuildEngineEnv(withoutPath, {
      provider: pkgClaudeCliProfile,
      ...BASE,
    });
    const mine = buildEngineEnv(withoutPath, {
      provider: CLAUDE_CLI_PROFILE,
      ...BASE,
    });
    expect(mine).toEqual(real);
    expect(mine).not.toHaveProperty("PATH");
  });

  test("removing a non-passthrough key from the parent changes nothing (it was never copied)", () => {
    const { GITHUB_TOKEN: _drop, ...withoutToken } = POLLUTED;
    void _drop;
    const withToken = buildEngineEnv(POLLUTED, {
      provider: CLAUDE_CLI_PROFILE,
      ...BASE,
    });
    const withoutIt = buildEngineEnv(withoutToken, {
      provider: CLAUDE_CLI_PROFILE,
      ...BASE,
    });
    expect(withoutIt).toEqual(withToken);
  });
});

describe("buildEngineEnv -- fail-closed parity (typed error shape matches kernel's ValidationError)", () => {
  test("empty authKey: both throw with the same message", () => {
    expect(() =>
      pkgBuildEngineEnv(POLLUTED, {
        provider: pkgClaudeCliProfile,
        ...BASE,
        authKey: "  ",
      }),
    ).toThrow(PkgValidationError);
    let mineMessage = "";
    try {
      buildEngineEnv(POLLUTED, {
        provider: CLAUDE_CLI_PROFILE,
        ...BASE,
        authKey: "  ",
      });
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      mineMessage = (err as EnvScrubError).message;
    }
    let realMessage = "";
    try {
      pkgBuildEngineEnv(POLLUTED, {
        provider: pkgClaudeCliProfile,
        ...BASE,
        authKey: "  ",
      });
    } catch (err) {
      realMessage = (err as Error).message;
    }
    expect(mineMessage).toBe(realMessage);
  });

  test.each([
    ["javascript:alert(1)", "javascript:"],
    ["file:///etc/passwd", "file:"],
  ])(
    "non-http(s) baseUrl %s: same message and details.protocol",
    (bad, protocol) => {
      let mineErr: EnvScrubError | undefined;
      try {
        buildEngineEnv(POLLUTED, {
          provider: CLAUDE_CLI_PROFILE,
          ...BASE,
          baseUrl: bad,
        });
      } catch (err) {
        mineErr = err as EnvScrubError;
      }
      let realErr: PkgValidationError | undefined;
      try {
        pkgBuildEngineEnv(POLLUTED, {
          provider: pkgClaudeCliProfile,
          ...BASE,
          baseUrl: bad,
        });
      } catch (err) {
        realErr = err as PkgValidationError;
      }
      expect(mineErr).toBeDefined();
      expect(realErr).toBeDefined();
      expect(mineErr?.message).toBe(realErr?.message);
      expect(mineErr?.code).toBe("validation_error");
      expect(mineErr?.httpStatus).toBe(400);
      expect(mineErr?.details).toEqual({ protocol });
      expect(realErr?.details).toEqual({ protocol });
    },
  );

  test('an unparseable baseUrl ("not a url"): same message', () => {
    let mineMessage = "";
    try {
      buildEngineEnv(POLLUTED, {
        provider: CLAUDE_CLI_PROFILE,
        ...BASE,
        baseUrl: "not a url",
      });
    } catch (err) {
      mineMessage = (err as EnvScrubError).message;
    }
    let realMessage = "";
    try {
      pkgBuildEngineEnv(POLLUTED, {
        provider: pkgClaudeCliProfile,
        ...BASE,
        baseUrl: "not a url",
      });
    } catch (err) {
      realMessage = (err as Error).message;
    }
    expect(mineMessage).toBe(realMessage);
    expect(mineMessage).toBe("buildEngineEnv: baseUrl is not a URL");
  });

  test("http (not just https) is admitted for local-first providers, in both mirror and real", () => {
    const real = pkgBuildEngineEnv(POLLUTED, {
      provider: pkgClaudeCliProfile,
      ...BASE,
      baseUrl: "http://127.0.0.1:11434",
    });
    const mine = buildEngineEnv(POLLUTED, {
      provider: CLAUDE_CLI_PROFILE,
      ...BASE,
      baseUrl: "http://127.0.0.1:11434",
    });
    expect(mine).toEqual(real);
  });
});
