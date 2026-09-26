// The local-privacy poke's checkable claims, now that it drives the REAL @caisson-sh/local-privacy
// and the hand-ported mirror (local-privacy-logic.ts) is deleted:
//
//   1. The poke's client graph is browser-safe — proven by a STATIC SOURCE-GRAPH WALK, never by a
//      build (a bundler does not fail on a node builtin, it SUBSTITUTES a polyfill and exits 0).
//      The mirror's justifying header claimed the package's `@caisson-sh/kernel` edge made this
//      impossible; the walk below is the retraction, and the positive control shows what the
//      taint the mirror feared actually looks like (kernel's `./node` entry, one hop away).
//   2. The component imports the package's public `.` barrel — no `./browser` entry was needed,
//      because the whole barrel walks clean. The import specifier itself is pinned.
//   3. There is no parity suite left to drift: the real `EgressGuard` makes every decision the poke
//      renders, so these tests exercise the shipped guard on the poke's own sample fixtures.
//
// The walk follows the `bun` (src) condition of each package's exports map; Next resolves
// `exports.default -> dist`. tscn is a per-file emit (no bundling, no re-export rewriting), so the
// dist module graph is the src module graph — CI builds packages before the site consumes them.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { nodeBuiltinTaint } from "@caisson-sh/testing/module-graph";
import { AuthzError, ValidationError } from "@caisson-sh/kernel";
import { DEFAULT_ONNX_MODEL } from "@caisson-sh/local-inference/browser";
import { ZERO_EGRESS_POLICY, localOnlyPolicy } from "@caisson-sh/local-privacy";

import {
  MODEL_FETCH_HOST,
  POKE_GUARDS,
  SAMPLE_BLOCKED_HOST,
  egressVerdict,
} from "./local-privacy-poke";

const WORKSPACE_ROOT = join(import.meta.dir, "../../../..");
const POKE_ENTRY = join(import.meta.dir, "local-privacy-poke.tsx");

describe("the poke's client graph is browser-safe (static source walk, NOT a build)", () => {
  const walk = nodeBuiltinTaint(POKE_ENTRY, { workspaceRoot: WORKSPACE_ROOT });

  test("no module reachable from the client entry imports a node builtin (transitive)", () => {
    expect(walk.offenders).toEqual([]);
  });

  test("no edge was silently skipped — every declined edge would land in `unresolved`", () => {
    expect(walk.unresolved).toEqual([]);
  });

  test("the walk really crossed into the package, past the first hop", () => {
    // Guard the guard: the UI kit alone contributes ~40 files, so files.length can never prove the
    // local-privacy edges resolved. egress-guard.ts is the first hop through the barrel and
    // kernel/src/schema.ts is a second hop reachable only through the package's own imports, so a
    // resolver that went blind inside a workspace package fails here.
    expect(walk.files).toContain("packages/local-privacy/src/index.ts");
    expect(walk.files).toContain("packages/local-privacy/src/egress-guard.ts");
    expect(walk.files).toContain("packages/local-privacy/src/policy.ts");
    expect(walk.files).toContain("packages/kernel/src/schema.ts");
  });

  test("the unwalked external frontier is exactly the known browser-safe set", () => {
    // A fifth entry here means a new non-workspace dependency joined the client graph — a review
    // event, not a silent hole in the proof.
    expect(walk.external).toEqual(["lucide-react", "radix-ui", "react", "zod"]);
  });

  test("positive control: the same walker reports real builtins on kernel's ./node entry", () => {
    // The exact taint the retired mirror's header feared — it lives behind `@caisson-sh/kernel/node`,
    // which nothing in local-privacy's graph reaches. A walker gone blind fails HERE rather than
    // greening the assertions above vacuously.
    const tainted = nodeBuiltinTaint(
      join(WORKSPACE_ROOT, "packages/kernel/src/node.ts"),
      { workspaceRoot: WORKSPACE_ROOT },
    );
    expect(tainted.offenders.length).toBeGreaterThan(0);
    expect(tainted.offenders.map((o) => o.spec)).toContain("node:crypto");
  });

  test("the component imports the package's public barrel, not a local mirror", () => {
    const src = readFileSync(POKE_ENTRY, "utf8");
    expect(src).toMatch(/^} from "@caisson-sh\/local-privacy";$/m);
    // The retired mirror may only be NAMED in prose, never imported again.
    expect(src).not.toMatch(/from "\.\/local-privacy-logic"/);
  });
});

describe("the poke's sample host is the real product config, not a fabricated example", () => {
  test("the component imports the safe constant instead of restating its host", () => {
    const source = readFileSync(POKE_ENTRY, "utf8");
    expect(source).toMatch(
      /^import \{ DEFAULT_ONNX_MODEL \} from "@caisson-sh\/local-inference\/browser";$/m,
    );
    expect(source).toMatch(
      /^export const MODEL_FETCH_HOST = DEFAULT_ONNX_MODEL\.modelHost;$/m,
    );
    expect(source).not.toMatch(
      /^export const MODEL_FETCH_HOST = "huggingface\.co";$/m,
    );
  });

  test("MODEL_FETCH_HOST matches @caisson-sh/local-inference's DEFAULT_ONNX_MODEL.modelHost", () => {
    expect(MODEL_FETCH_HOST).toBe(DEFAULT_ONNX_MODEL.modelHost);
  });

  test("the two sample guards carry the real shipped policies", () => {
    expect(POKE_GUARDS.zero.policy).toEqual(ZERO_EGRESS_POLICY);
    expect(POKE_GUARDS.zero.policy.allowlist).toEqual([]);
    // The same allowlist shape the ONNX backend builds for its own model download.
    expect(POKE_GUARDS["model-fetch"].policy).toEqual(
      localOnlyPolicy([
        { host: DEFAULT_ONNX_MODEL.modelHost, kind: "model-fetch" },
      ]),
    );
  });
});

describe("the real EgressGuard decides every verdict the poke renders", () => {
  const zero = POKE_GUARDS.zero;
  const modelFetch = POKE_GUARDS["model-fetch"];
  const modelUrl = `https://${MODEL_FETCH_HOST}/model.onnx`;

  test("the air-gap default blocks even the sanctioned host — empty allowlist means zero egress", () => {
    const verdict = egressVerdict(zero, modelUrl);
    if (verdict.outcome !== "blocked") throw new Error("expected a block");
    expect(verdict.error.code).toBe("forbidden");
    expect(verdict.error.httpStatus).toBe(403);
    expect(verdict.error.details).toEqual({
      host: MODEL_FETCH_HOST,
      privacy: "local-only",
    });
    // The rendered verdict is the guard's own throw, not a restated decision.
    expect(() => zero.assertAllowed(modelUrl)).toThrow(AuthzError);
  });

  test("an allowlisted https host is allowed, with the sanctioned kind named by sinkKindFor", () => {
    expect(egressVerdict(modelFetch, modelUrl)).toEqual({
      outcome: "allowed",
      url: modelUrl,
      host: MODEL_FETCH_HOST,
      kind: "model-fetch",
    });
  });

  test("host matching is case-insensitive", () => {
    const verdict = egressVerdict(
      modelFetch,
      `https://${MODEL_FETCH_HOST.toUpperCase()}/model.onnx`,
    );
    if (verdict.outcome !== "allowed") throw new Error("expected an allow");
    expect(verdict.host).toBe(MODEL_FETCH_HOST);
  });

  test("http on an allowlisted host is blocked before the allowlist is ever consulted", () => {
    const verdict = egressVerdict(
      modelFetch,
      `http://${MODEL_FETCH_HOST}/model.onnx`,
    );
    if (verdict.outcome !== "blocked") throw new Error("expected a block");
    expect(verdict.error.details).toEqual({ scheme: "http:" });
  });

  test("a non-allowlisted host is blocked even with a non-empty allowlist", () => {
    const verdict = egressVerdict(
      modelFetch,
      `https://${SAMPLE_BLOCKED_HOST}/exfil`,
    );
    if (verdict.outcome !== "blocked") throw new Error("expected a block");
    expect(verdict.error.details).toEqual({
      host: SAMPLE_BLOCKED_HOST,
      privacy: "local-only",
    });
  });

  test("a malformed URL is the guard's ValidationError, not a crash", () => {
    const verdict = egressVerdict(zero, "https:// not a url");
    if (verdict.outcome !== "blocked") throw new Error("expected a block");
    expect(verdict.error.code).toBe("validation_error");
    expect(verdict.error.httpStatus).toBe(400);
    expect(() => zero.assertAllowed("https:// not a url")).toThrow(
      ValidationError,
    );
  });

  test("no blocked verdict ever carries the request path or query", () => {
    // The guard's redaction promise, checked on the poke's own render shape: details hold only the
    // host/scheme, so a token in the path can never reach the rendered panel.
    const verdict = egressVerdict(
      modelFetch,
      `https://${SAMPLE_BLOCKED_HOST}/exfil?token=super-secret`,
    );
    if (verdict.outcome !== "blocked") throw new Error("expected a block");
    expect(JSON.stringify(verdict)).not.toContain("super-secret");
    expect(JSON.stringify(verdict)).not.toContain("exfil");
  });

  test("a non-Caisson throw is re-raised, never rendered as a fail-closed block", () => {
    const exploding = {
      assertAllowed: () => {
        throw new TypeError("boom");
      },
    } as unknown as typeof zero;
    expect(() => egressVerdict(exploding, modelUrl)).toThrow(TypeError);
  });
});
