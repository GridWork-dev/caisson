// Emitter write-path security tests (T19 · ADR-0066). The golden test (golden.test.ts) pins the
// byte-stable render; THIS suite exercises the two threats the `security` tag fires on: path
// traversal escaping the emit target dir, and a credential leaking into an emitted bundle. The pure
// render is verified end-to-end through a real temp-dir write that must round-trip the bytes.
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArtifact } from "@caisson/agent-kernel";
import { EMIT_INPUT } from "./golden.ts";
import {
  type EmittedBundle,
  EmitSecurityError,
  renderHarnessBundles,
  writeBundle,
} from "./emitter.ts";

const tmpRoots: string[] = [];
function freshRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "caisson-emit-"));
  tmpRoots.push(root);
  return root;
}
afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("renderHarnessBundles — engine-neutral fan-out (ADR-0066)", () => {
  test("renders all three harness shapes from one schema (no harness is the substrate)", () => {
    const bundle = renderHarnessBundles(EMIT_INPUT);
    const paths = bundle.files.map((f) => f.path).sort();
    expect(paths).toEqual(
      [
        ".claude/agents/code-reviewer.md",
        ".claude/hooks.json",
        ".claude/rules/no-any-in-prod.md",
        ".claude/skills/guided-execution.md",
        ".cursor/rules/code-reviewer.mdc",
        ".cursor/rules/guided-execution.mdc",
        ".cursor/rules/no-any-in-prod.mdc",
        "AGENTS.md",
      ].sort(),
    );
  });

  test("writeBundle round-trips the rendered bytes under the target root", () => {
    const root = freshRoot();
    const bundle = renderHarnessBundles(EMIT_INPUT);
    const written = writeBundle(root, bundle);
    expect(written.length).toBe(bundle.files.length);
    for (const file of bundle.files) {
      const dest = join(root, file.path);
      expect(existsSync(dest)).toBe(true);
      expect(readFileSync(dest, "utf8")).toBe(file.content);
    }
  });
});

describe("writeBundle — path-traversal safety (threat: escape the emit dir)", () => {
  const escapes: readonly string[] = [
    "../escape.md",
    ".claude/../../escape.md",
    "a/../../escape.md",
    "/etc/passwd",
    "nested/../../../escape.md",
  ];
  for (const path of escapes) {
    test(`rejects ${JSON.stringify(path)} (nothing written)`, () => {
      const root = freshRoot();
      const bundle: EmittedBundle = { files: [{ path, content: "clean" }] };
      let thrown: unknown;
      try {
        writeBundle(root, bundle);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(EmitSecurityError);
      expect((thrown as EmitSecurityError).code).toBe("path-escape");
      // Fail-closed: the offending bundle left no file behind.
      expect(existsSync(join(root, "escape.md"))).toBe(false);
    });
  }

  test("rejects a null byte in the path", () => {
    const root = freshRoot();
    const bundle: EmittedBundle = {
      files: [{ path: "ok\0.md", content: "clean" }],
    };
    expect(() => writeBundle(root, bundle)).toThrow(EmitSecurityError);
  });
});

describe("writeBundle — no-secret guard (threat: credential leaks into a bundle)", () => {
  const secrets: readonly string[] = [
    "token: ghp_0123456789abcdefghijABCDEFGHIJ0123",
    "AKIAIOSFODNN7EXAMPLE is the key",
    "openai: sk-proj-0123456789abcdefABCDEFwxyz",
    "api_key=deadbeefdeadbeefdeadbeef",
    "-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----",
  ];
  for (const content of secrets) {
    test(`refuses to write content carrying a secret shape`, () => {
      const root = freshRoot();
      const bundle: EmittedBundle = {
        files: [{ path: "AGENTS.md", content }],
      };
      let thrown: unknown;
      try {
        writeBundle(root, bundle);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(EmitSecurityError);
      const err = thrown as EmitSecurityError;
      expect(err.code).toBe("secret-leak");
      // The error message must NOT echo the secret span.
      expect(err.message).not.toContain("ghp_");
      expect(err.message).not.toContain("AKIA");
      expect(err.message).not.toContain("sk-proj");
      expect(err.message).not.toContain("deadbeef");
      expect(err.message).not.toContain("PRIVATE KEY");
      // Fail-closed: nothing written.
      expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
    });
  }

  test("a clean rendered bundle passes the secret scan (no false positive)", () => {
    const root = freshRoot();
    expect(() =>
      writeBundle(root, renderHarnessBundles(EMIT_INPUT)),
    ).not.toThrow();
  });

  test("the secret scan is fail-closed across the whole bundle (one bad file aborts all)", () => {
    const root = freshRoot();
    const bundle: EmittedBundle = {
      files: [
        { path: "AGENTS.md", content: "clean content" },
        {
          path: ".claude/rules/leak.md",
          content: "password: hunter2-is-a-secret",
        },
      ],
    };
    expect(() => writeBundle(root, bundle)).toThrow(EmitSecurityError);
    expect(existsSync(join(root, "AGENTS.md"))).toBe(false);
  });
});

describe("writeBundle — duplicate destination guard", () => {
  test("rejects two artifacts mapping to the same emit path", () => {
    const root = freshRoot();
    const bundle: EmittedBundle = {
      files: [
        { path: "AGENTS.md", content: "one" },
        { path: "AGENTS.md", content: "two" },
      ],
    };
    let thrown: unknown;
    try {
      writeBundle(root, bundle);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(EmitSecurityError);
    expect((thrown as EmitSecurityError).code).toBe("duplicate-path");
  });
});

describe("a secret in an authored artifact is refused at emit (real leak path)", () => {
  test("a credential in an artifact description never reaches disk", () => {
    const root = freshRoot();
    const leaky = parseArtifact({
      kind: "rule",
      name: "leaky-rule",
      description: "Use api_key=abcdef0123456789abcdef to authenticate.",
      severity: "error",
    });
    const bundle = renderHarnessBundles({ artifacts: [leaky], hooks: [] });
    expect(() => writeBundle(root, bundle)).toThrow(EmitSecurityError);
    expect(existsSync(join(root, ".claude/rules/leaky-rule.md"))).toBe(false);
  });
});
