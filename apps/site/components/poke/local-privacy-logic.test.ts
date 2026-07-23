// Real-package parity for the local-privacy poke's browser mirror (local-privacy-logic.ts). No
// committed __golden__ fixture exists for @caisson/local-privacy, so the anchor is the real
// `EgressGuard.assertAllowed` + `localOnlyPolicy`/`ZERO_EGRESS_POLICY`, imported here by relative
// path (apps/site does not declare `@caisson/local-privacy` as a workspace dependency — see
// local-privacy-logic.ts's header for why the mirror exists). Bun's test runtime is node-like, so
// the real package's `@caisson/kernel` barrel import (node:crypto / node:dns/promises) resolves
// fine here even though it cannot reach a browser bundle.
import { describe, expect, test } from "bun:test";
import { AuthzError, ValidationError } from "@caisson/kernel";

import { EgressGuard } from "../../../../packages/local-privacy/src/egress-guard.ts";
import {
  ZERO_EGRESS_POLICY as pkgZeroEgressPolicy,
  localOnlyPolicy as pkgLocalOnlyPolicy,
} from "../../../../packages/local-privacy/src/policy.ts";
import { DEFAULT_ONNX_MODEL } from "../../../../packages/local-inference/src/onnx-backend.ts";

import {
  MODEL_FETCH_HOST,
  MODEL_FETCH_POLICY,
  SANCTIONED_SINK_KINDS,
  ZERO_EGRESS_POLICY,
  evaluateEgress,
  localOnlyPolicy,
} from "./local-privacy-logic";

describe("MODEL_FETCH_HOST — parity with the real product config", () => {
  test("matches the real onnx-backend.ts DEFAULT_ONNX_MODEL.modelHost, not a fabricated example", () => {
    expect(MODEL_FETCH_HOST).toBe(DEFAULT_ONNX_MODEL.modelHost);
  });
});

describe("localOnlyPolicy / ZERO_EGRESS_POLICY — parity with the real policy.ts", () => {
  test("localOnlyPolicy() with no args matches the real ZERO_EGRESS_POLICY shape", () => {
    expect(ZERO_EGRESS_POLICY).toEqual(pkgZeroEgressPolicy);
  });

  test("localOnlyPolicy([...]) matches the real function on the same allowlist", () => {
    const allowlist = [
      { host: MODEL_FETCH_HOST, kind: "model-fetch" as const },
    ];
    expect(localOnlyPolicy(allowlist)).toEqual(pkgLocalOnlyPolicy(allowlist));
    expect(MODEL_FETCH_POLICY).toEqual(pkgLocalOnlyPolicy(allowlist));
  });
});

describe("evaluateEgress — parity with the real EgressGuard.assertAllowed", () => {
  test("empty allowlist blocks a real host: mine matches the real thrown AuthzError", () => {
    const url = `https://${MODEL_FETCH_HOST}/model.onnx`;
    const mine = evaluateEgress(url, ZERO_EGRESS_POLICY);
    expect(mine.outcome).toBe("blocked");

    const guard = new EgressGuard(pkgZeroEgressPolicy);
    let real: unknown;
    try {
      guard.assertAllowed(url);
      throw new Error("expected a block");
    } catch (err) {
      real = err;
    }
    expect(real).toBeInstanceOf(AuthzError);
    if (mine.outcome !== "blocked") throw new Error("expected blocked");
    expect(mine.error.message).toBe((real as AuthzError).message);
    expect(mine.error.details).toEqual((real as AuthzError).details);
    expect(mine.error.httpStatus).toBe((real as AuthzError).httpStatus);
  });

  test("an allowlisted host is allowed: mine matches the real guard's returned URL", () => {
    const url = `https://${MODEL_FETCH_HOST}/model.onnx`;
    const mine = evaluateEgress(url, MODEL_FETCH_POLICY);
    expect(mine).toEqual({
      outcome: "allowed",
      url,
      host: MODEL_FETCH_HOST,
      kind: "model-fetch",
    });

    const guard = new EgressGuard(
      pkgLocalOnlyPolicy([{ host: MODEL_FETCH_HOST, kind: "model-fetch" }]),
    );
    const real = guard.assertAllowed(url);
    expect(real.href).toBe(mine.outcome === "allowed" ? mine.url : "");
    expect(real.hostname).toBe(mine.outcome === "allowed" ? mine.host : "");
  });

  test("a non-https scheme blocks an otherwise-allowlisted host, matching the real guard", () => {
    const url = `http://${MODEL_FETCH_HOST}/model.onnx`;
    const mine = evaluateEgress(url, MODEL_FETCH_POLICY);
    const guard = new EgressGuard(
      pkgLocalOnlyPolicy([{ host: MODEL_FETCH_HOST, kind: "model-fetch" }]),
    );
    let real: unknown;
    try {
      guard.assertAllowed(url);
      throw new Error("expected a block");
    } catch (err) {
      real = err;
    }
    expect(real).toBeInstanceOf(AuthzError);
    if (mine.outcome !== "blocked") throw new Error("expected blocked");
    expect(mine.error.details).toEqual((real as AuthzError).details);
    expect(mine.error.details).toEqual({ scheme: "http:" });
  });

  test("a non-allowlisted host blocks even with a non-empty allowlist, matching the real guard", () => {
    const url = "https://evil.example.com/exfil";
    const mine = evaluateEgress(url, MODEL_FETCH_POLICY);
    const guard = new EgressGuard(
      pkgLocalOnlyPolicy([{ host: MODEL_FETCH_HOST, kind: "model-fetch" }]),
    );
    let real: unknown;
    try {
      guard.assertAllowed(url);
      throw new Error("expected a block");
    } catch (err) {
      real = err;
    }
    expect(real).toBeInstanceOf(AuthzError);
    if (mine.outcome !== "blocked") throw new Error("expected blocked");
    expect(mine.error.details).toEqual((real as AuthzError).details);
    expect(mine.error.details).toEqual({
      host: "evil.example.com",
      privacy: "local-only",
    });
  });

  test("a malformed URL matches the real ValidationError", () => {
    const mine = evaluateEgress("not a url", ZERO_EGRESS_POLICY);
    const guard = new EgressGuard(pkgZeroEgressPolicy);
    let real: unknown;
    try {
      guard.assertAllowed("not a url");
      throw new Error("expected a block");
    } catch (err) {
      real = err;
    }
    expect(real).toBeInstanceOf(ValidationError);
    if (mine.outcome !== "blocked") throw new Error("expected blocked");
    expect(mine.error.message).toBe((real as ValidationError).message);
    expect(mine.error.code).toBe("validation_error");
  });

  test("host matching is case-insensitive, matching the real guard", () => {
    const url = `https://${MODEL_FETCH_HOST.toUpperCase()}/model.onnx`;
    const mine = evaluateEgress(url, MODEL_FETCH_POLICY);
    expect(mine.outcome).toBe("allowed");

    const guard = new EgressGuard(
      pkgLocalOnlyPolicy([{ host: MODEL_FETCH_HOST, kind: "model-fetch" }]),
    );
    expect(() => guard.assertAllowed(url)).not.toThrow();
  });

  test("SANCTIONED_SINK_KINDS matches the real closed enum", () => {
    expect(SANCTIONED_SINK_KINDS).toEqual(["model-fetch", "rented-backend"]);
  });
});
