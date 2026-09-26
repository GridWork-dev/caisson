// The agent-runner poke's checkable claims, now that it drives the REAL package through its
// browser entry (ADR-0396) and the hand-ported mirror (agent-runner-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — a STATIC SOURCE-GRAPH WALK, never a build. A
//      bundler does not fail on `node:child_process`/`node:fs`, it substitutes polyfills, exit 0.
//   2. The leak-guard contract (ADR-0186 §4, ship-blocking) holds on the poke's own sample env: no
//      credential-shaped parent key reaches the child, present or not.
//   3. `addedKeys` — the poke's ONLY remaining local composition — matches what the real scrub
//      actually adds, so the two output panels can never silently mis-split.
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { ValidationError } from "@caisson-sh/kernel";
import {
  CLAUDE_CLI_PROFILE,
  PASSTHROUGH_KEYS,
} from "@caisson-sh/agent-runner/browser";

import {
  MALICIOUS_BASE_URL,
  SAMPLE_BASE_URL,
  SAMPLE_PARENT_ENV,
  addedKeys,
  scrubSample,
} from "./agent-runner-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "agent-runner-poke.tsx");

const SECRET_KEYS = ["GITHUB_TOKEN", "OPENROUTER_API_KEY", "DATABASE_URL"];

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package's browser entry, never the spawn half", () => {
    expect(walk.files).toContain("packages/agent-runner/src/browser.ts");
    expect(walk.files).toContain("packages/agent-runner/src/engine-env.ts");
    expect(walk.files).not.toContain(
      "packages/agent-runner/src/agent-runner.ts",
    );
    expect(walk.files).not.toContain("packages/agent-runner/src/trajectory.ts");
  });

  test("positive control: the package's `.` barrel DOES taint, so the walker is not blind", () => {
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/agent-runner/src/index.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.some((o) => o.spec === "node:child_process")).toBe(
      true,
    );
  });
});

describe("the leak-guard contract holds on the poke's sample env (ADR-0186 §4)", () => {
  const result = scrubSample(SAMPLE_PARENT_ENV, SAMPLE_BASE_URL);
  if (!result.ok) throw new Error("the sample env must scrub cleanly");
  const env = result.env;

  test("no secret-shaped parent key survives, by name or by value", () => {
    for (const key of SECRET_KEYS) {
      expect(SAMPLE_PARENT_ENV).toHaveProperty(key);
      expect(env).not.toHaveProperty(key);
      expect(JSON.stringify(env)).not.toContain(SAMPLE_PARENT_ENV[key]!);
    }
  });

  test("the built key set is EXACTLY the present passthrough keys plus the added ones", () => {
    const present = Object.keys(SAMPLE_PARENT_ENV).filter((k) =>
      (PASSTHROUGH_KEYS as readonly string[]).includes(k),
    );
    expect(Object.keys(env).sort()).toEqual(
      [...present, ...addedKeys(CLAUDE_CLI_PROFILE)].sort(),
    );
  });

  test("addedKeys names exactly the keys the scrub sets itself, never copies from the parent", () => {
    // Membership is decided by VALUE provenance, not by key presence — HOME exists in the sample
    // parent too, and the whole point is that the child gets the isolated one instead.
    const setByScrub = Object.keys(env).filter(
      (k) => env[k] !== SAMPLE_PARENT_ENV[k],
    );
    expect(setByScrub.sort()).toEqual(
      [...addedKeys(CLAUDE_CLI_PROFILE)].sort(),
    );
    expect(env["HOME"]).not.toBe(SAMPLE_PARENT_ENV["HOME"]);
  });

  test("dropping a passthrough key drops it from the child; dropping a secret changes nothing", () => {
    const { PATH: _path, ...noPath } = SAMPLE_PARENT_ENV;
    void _path;
    const withoutPath = scrubSample(noPath, SAMPLE_BASE_URL);
    if (!withoutPath.ok) throw new Error("expected ok");
    expect(withoutPath.env).not.toHaveProperty("PATH");

    const { GITHUB_TOKEN: _tok, ...noToken } = SAMPLE_PARENT_ENV;
    void _tok;
    const withoutToken = scrubSample(noToken, SAMPLE_BASE_URL);
    if (!withoutToken.ok) throw new Error("expected ok");
    expect(withoutToken.env).toEqual(env);
  });
});

describe("the tamper path fails closed with the real kernel error", () => {
  test("the javascript: baseUrl is refused before any env is built", () => {
    const result = scrubSample(SAMPLE_PARENT_ENV, MALICIOUS_BASE_URL);
    if (result.ok) throw new Error("expected the scrub to refuse");
    expect(result.error).toBeInstanceOf(ValidationError);
    expect(result.error.code).toBe("validation_error");
    expect(result.error.httpStatus).toBe(400);
    expect(result.error.details).toEqual({ protocol: "javascript:" });
  });

  test("http is still admitted for a local-first provider endpoint", () => {
    expect(scrubSample(SAMPLE_PARENT_ENV, "http://127.0.0.1:11434").ok).toBe(
      true,
    );
  });
});
