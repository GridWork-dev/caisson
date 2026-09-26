// Tests for the privacy gate / egress guard (ADR-0064). In-process,
// deterministic, NO live network: the one test that exercises the allowed path stubs `globalThis.fetch`
// so it proves the guard ROUTES through the kernel `fetchWithTimeout` without opening a socket, and the
// block-path tests assert no stubbed fetch is ever called (the block fires before the network).
import { afterEach, describe, expect, test } from "bun:test";
import { AuthzError, ValidationError } from "@caisson-sh/kernel";
import { EgressGuard, createEgressGuard } from "./egress-guard.ts";
import {
  ZERO_EGRESS_POLICY,
  localOnlyPolicy,
  parsePrivacyPolicy,
  privacyPolicySchema,
} from "./policy.ts";

// ── globalThis.fetch stub harness (no real network ever leaves CI) ──────────────────────────────
const realFetch = globalThis.fetch;
let fetchCalls: string[] = [];

/** Install a fetch stub that records call URLs and returns a canned 200; returns the call log. */
function stubFetch(status = 200): string[] {
  fetchCalls = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    fetchCalls.push(url);
    return Promise.resolve(new Response("ok", { status }));
  }) as typeof fetch;
  return fetchCalls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const MODEL_HOST = "huggingface.co";
const RENTED_HOST = "inference.caisson.example";

function guardWithBothSinks(): EgressGuard {
  return new EgressGuard(
    localOnlyPolicy([
      { host: MODEL_HOST, kind: "model-fetch" },
      { host: RENTED_HOST, kind: "rented-backend" },
    ]),
  );
}

describe("privacyPolicySchema (Zod .strict() allowlist)", () => {
  test("a local-only policy with sanctioned sinks parses + normalizes the host", () => {
    const policy = parsePrivacyPolicy({
      privacy: "local-only",
      allowlist: [{ host: "  HuggingFace.CO ", kind: "model-fetch" }],
    });
    expect(policy.privacy).toBe("local-only");
    expect(policy.allowlist[0]?.host).toBe("huggingface.co");
  });

  test("an omitted allowlist defaults to zero egress ([])", () => {
    const policy = parsePrivacyPolicy({ privacy: "local-only" });
    expect(policy.allowlist).toEqual([]);
  });

  test("an unknown top-level key fails closed (.strict)", () => {
    expect(() =>
      parsePrivacyPolicy({
        privacy: "local-only",
        allowlist: [],
        hosted: true,
      }),
    ).toThrow(ValidationError);
  });

  test("an unknown key inside a sink fails closed (.strict)", () => {
    expect(() =>
      parsePrivacyPolicy({
        privacy: "local-only",
        allowlist: [{ host: MODEL_HOST, kind: "model-fetch", weight: 1 }],
      }),
    ).toThrow(ValidationError);
  });

  test("an unknown privacy mode is rejected (no hosted posture by config)", () => {
    expect(() =>
      parsePrivacyPolicy({ privacy: "hosted", allowlist: [] }),
    ).toThrow(ValidationError);
  });

  test("an unsanctioned sink kind is rejected (closed kind enum)", () => {
    expect(() =>
      parsePrivacyPolicy({
        privacy: "local-only",
        allowlist: [{ host: MODEL_HOST, kind: "analytics" }],
      }),
    ).toThrow(ValidationError);
  });

  test.each([
    ["https://x.com", "scheme"],
    ["host:443", "port"],
    ["host/path", "path"],
    ["a_b.com", "underscore"],
    ["", "empty"],
  ])("a non-bare-hostname (%s, %s) is rejected", (host) => {
    expect(() =>
      parsePrivacyPolicy({
        privacy: "local-only",
        allowlist: [{ host, kind: "model-fetch" }],
      }),
    ).toThrow(ValidationError);
  });

  test("ZERO_EGRESS_POLICY is local-only with an empty allowlist", () => {
    expect(ZERO_EGRESS_POLICY.privacy).toBe("local-only");
    expect(ZERO_EGRESS_POLICY.allowlist).toEqual([]);
    // and it round-trips through the schema unchanged.
    expect(privacyPolicySchema.safeParse(ZERO_EGRESS_POLICY).success).toBe(
      true,
    );
  });
});

describe("EgressGuard.assertAllowed (the pure, fail-closed decision)", () => {
  test("empty allowlist ⇒ EVERY host blocked (zero egress)", () => {
    const guard = new EgressGuard(ZERO_EGRESS_POLICY);
    expect(() =>
      guard.assertAllowed(`https://${MODEL_HOST}/model.onnx`),
    ).toThrow(AuthzError);
    expect(() =>
      guard.assertAllowed(`https://${RENTED_HOST}/v1/embed`),
    ).toThrow(AuthzError);
  });

  test("an allowlisted host returns the parsed URL", () => {
    const guard = guardWithBothSinks();
    const url = guard.assertAllowed(
      `https://${MODEL_HOST}/model.onnx?rev=main`,
    );
    expect(url).toBeInstanceOf(URL);
    expect(url.hostname).toBe(MODEL_HOST);
  });

  test("host match is case-insensitive", () => {
    const guard = guardWithBothSinks();
    expect(() =>
      guard.assertAllowed(`https://HUGGINGFACE.CO/model.onnx`),
    ).not.toThrow();
  });

  test("a non-https scheme is blocked even for an allowlisted host", () => {
    const guard = guardWithBothSinks();
    expect(() =>
      guard.assertAllowed(`http://${MODEL_HOST}/model.onnx`),
    ).toThrow(AuthzError);
  });

  test.each(["data:text/plain,leak", "file:///etc/passwd"])(
    "a non-http(s) scheme (%s) is blocked",
    (uri) => {
      const guard = guardWithBothSinks();
      expect(() => guard.assertAllowed(uri)).toThrow(AuthzError);
    },
  );

  test("a non-allowlisted host is blocked — no silent hosted fallback", () => {
    const guard = guardWithBothSinks();
    expect(() => guard.assertAllowed("https://evil.example.com/exfil")).toThrow(
      AuthzError,
    );
  });

  test("a malformed URL fails closed (ValidationError)", () => {
    const guard = guardWithBothSinks();
    expect(() => guard.assertAllowed("not a url")).toThrow(ValidationError);
  });

  test("the block error never leaks the request path (only host + scheme)", () => {
    const guard = new EgressGuard(ZERO_EGRESS_POLICY);
    try {
      guard.assertAllowed("https://evil.example.com/secret?token=abc123");
      throw new Error("expected a block");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthzError);
      const details: Record<string, unknown> =
        (err as AuthzError).details ?? {};
      expect(JSON.stringify(details)).not.toContain("token=abc123");
      expect(JSON.stringify(details)).not.toContain("/secret");
      expect(details.host).toBe("evil.example.com");
    }
  });

  test("sinkKindFor reports the sanctioned kind for an allowlisted host", () => {
    const guard = guardWithBothSinks();
    expect(guard.sinkKindFor(MODEL_HOST)).toBe("model-fetch");
    expect(guard.sinkKindFor(RENTED_HOST)).toBe("rented-backend");
    expect(guard.sinkKindFor("evil.example.com")).toBeUndefined();
  });
});

describe("EgressGuard.fetch (wraps kernel fetchWithTimeout)", () => {
  test("a blocked host throws BEFORE any network call (zero egress)", async () => {
    const calls = stubFetch();
    const guard = new EgressGuard(ZERO_EGRESS_POLICY);
    await expect(guard.fetch("https://evil.example.com/exfil")).rejects.toThrow(
      AuthzError,
    );
    expect(calls).toHaveLength(0);
  });

  test("an allowlisted host routes through fetchWithTimeout (stubbed, no real net)", async () => {
    const calls = stubFetch(200);
    const guard = guardWithBothSinks();
    const res = await guard.fetch(`https://${MODEL_HOST}/model.onnx`);
    expect(res.status).toBe(200);
    expect(calls).toEqual([`https://${MODEL_HOST}/model.onnx`]);
  });

  test("guardedFetch (env.fetch shape) blocks a non-allowlisted host", async () => {
    const calls = stubFetch();
    const guard = guardWithBothSinks();
    await expect(
      guard.guardedFetch(new Request("https://evil.example.com/x")),
    ).rejects.toThrow(AuthzError);
    expect(calls).toHaveLength(0);
  });

  test("guardedFetch forwards an allowlisted Request through the chokepoint", async () => {
    const calls = stubFetch(200);
    const guard = guardWithBothSinks();
    const res = await guard.guardedFetch(
      new Request(`https://${RENTED_HOST}/v1/embed`),
    );
    expect(res.status).toBe(200);
    expect(calls).toEqual([`https://${RENTED_HOST}/v1/embed`]);
  });
});

describe("createEgressGuard + defensive re-parse (fail-closed)", () => {
  test("createEgressGuard builds a working guard", () => {
    const guard = createEgressGuard(ZERO_EGRESS_POLICY);
    expect(() => guard.assertAllowed("https://x.com/")).toThrow(AuthzError);
  });

  test("a hand-built policy that bypassed the boundary is re-validated at construction", () => {
    // A caller could cast around the type; the guard re-parses and fails closed on a bad host.
    const smuggled = {
      privacy: "local-only",
      allowlist: [{ host: "https://evil.example.com", kind: "model-fetch" }],
    } as unknown as Parameters<typeof createEgressGuard>[0];
    expect(() => createEgressGuard(smuggled)).toThrow(ValidationError);
  });
});

describe("EgressGuard.assertAllowedFor / fetchAs (purpose-bound egress)", () => {
  test("the matching sink kind passes; a mismatched kind is refused naming required + actual", () => {
    const guard = guardWithBothSinks();
    expect(
      guard.assertAllowedFor(
        `https://${RENTED_HOST}/v1/embed`,
        "rented-backend",
      ).hostname,
    ).toBe(RENTED_HOST);

    try {
      guard.assertAllowedFor(
        `https://${MODEL_HOST}/v1/embed`,
        "rented-backend",
      );
      throw new Error("expected AuthzError");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthzError);
      const details: Record<string, unknown> =
        (err as AuthzError).details ?? {};
      expect(details.required).toBe("rented-backend");
      expect(details.actual).toBe("model-fetch");
      expect(details.host).toBe(MODEL_HOST);
    }
  });

  test("a non-allowlisted host is still refused first (assertAllowed runs before the kind gate)", () => {
    const guard = guardWithBothSinks();
    expect(() =>
      guard.assertAllowedFor(
        "https://evil.example.com/embed",
        "rented-backend",
      ),
    ).toThrow(AuthzError);
  });

  test("fetchAs blocks a wrong-kind host BEFORE any network call (the Bearer never leaves)", async () => {
    const calls = stubFetch();
    const guard = guardWithBothSinks();
    await expect(
      guard.fetchAs("rented-backend", `https://${MODEL_HOST}/v1/embed`),
    ).rejects.toThrow(AuthzError);
    expect(calls).toHaveLength(0);
  });

  test("fetchAs routes a matching-kind host through the one fetch seam", async () => {
    const calls = stubFetch(200);
    const guard = guardWithBothSinks();
    const res = await guard.fetchAs(
      "rented-backend",
      `https://${RENTED_HOST}/v1/embed`,
    );
    expect(res.status).toBe(200);
    expect(calls).toEqual([`https://${RENTED_HOST}/v1/embed`]);
  });
});
