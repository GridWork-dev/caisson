import { describe, expect, test } from "bun:test";
import { AuthzError, ValidationError } from "@caisson-sh/kernel/browser";
import {
  PrivacyDecisionGuard,
  createPrivacyDecisionGuard,
} from "./decision-guard.ts";
import { ZERO_EGRESS_POLICY, localOnlyPolicy } from "./policy.ts";

const MODEL_HOST = "huggingface.co";
const RENTED_HOST = "inference.caisson.example";

function guardWithBothSinks(): PrivacyDecisionGuard {
  return createPrivacyDecisionGuard(
    localOnlyPolicy([
      { host: MODEL_HOST, kind: "model-fetch" },
      { host: RENTED_HOST, kind: "rented-backend" },
    ]),
  );
}

describe("PrivacyDecisionGuard", () => {
  test("keeps zero egress as the default", () => {
    const guard = new PrivacyDecisionGuard(ZERO_EGRESS_POLICY);
    expect(() =>
      guard.assertAllowed(`https://${MODEL_HOST}/model.onnx`),
    ).toThrow(AuthzError);
  });

  test("allows only exact HTTPS hosts for their sanctioned purpose", () => {
    const guard = guardWithBothSinks();
    expect(
      guard.assertAllowedFor(
        `https://${RENTED_HOST}/v1/embed`,
        "rented-backend",
      ).hostname,
    ).toBe(RENTED_HOST);
    expect(() =>
      guard.assertAllowedFor(
        `https://${MODEL_HOST}/v1/embed`,
        "rented-backend",
      ),
    ).toThrow(AuthzError);
    expect(() =>
      guard.assertAllowed(`http://${MODEL_HOST}/model.onnx`),
    ).toThrow(AuthzError);
  });

  test("fails closed on malformed input without leaking path data", () => {
    const guard = guardWithBothSinks();
    expect(() => guard.assertAllowed("not a url")).toThrow(ValidationError);
    try {
      guard.assertAllowed("https://evil.example/secret?token=abc123");
      throw new Error("expected an egress block");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthzError);
      expect(JSON.stringify((error as AuthzError).details)).not.toContain(
        "abc123",
      );
    }
  });
});
