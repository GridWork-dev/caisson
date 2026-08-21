import { describe, expect, test } from "bun:test";
import { ConfigError } from "./errors.ts";
import * as originGate from "./origin-gate.ts";

const { loadOriginGateConfig, originVerificationDisabledFor } = originGate;
const originRequestAuthorized = Reflect.get(
  originGate,
  "originRequestAuthorized",
) as
  | ((request: Request, config: originGate.OriginGateConfig) => boolean)
  | undefined;
const ORIGIN_SECRET_HEADER = Reflect.get(originGate, "ORIGIN_SECRET_HEADER") as
  | string
  | undefined;

const CURRENT = Buffer.alloc(32, 0x11).toString("base64url");
const NEXT = Buffer.alloc(32, 0x22).toString("base64url");
const WRONG = Buffer.alloc(32, 0x33).toString("base64url");

describe("loadOriginGateConfig", () => {
  test("disables verification only for the exact nonproduction opt-out", () => {
    expect(originVerificationDisabledFor).toBeFunction();
    if (originVerificationDisabledFor === undefined) return;

    expect(originVerificationDisabledFor("development", "disabled")).toBe(true);
    expect(originVerificationDisabledFor("test", "disabled")).toBe(true);

    for (const runtime of [undefined, "production"] as const) {
      expect(originVerificationDisabledFor(runtime, "disabled")).toBe(false);
    }
    for (const runtime of [
      undefined,
      "production",
      "development",
      "test",
    ] as const) {
      for (const mode of [
        undefined,
        "enabled",
        "false",
        "Disabled",
        "",
      ] as const) {
        expect(originVerificationDisabledFor(runtime, mode)).toBe(false);
      }
    }

    expect(
      loadOriginGateConfig({
        NODE_ENV: "test",
        ORIGIN_SECRET_MODE: "disabled",
      }),
    ).toEqual({ required: false, secrets: [] });
  });

  test("makes the disabled state unreachable from production configuration", () => {
    for (const mode of [
      undefined,
      "disabled",
      "enabled",
      "false",
      "",
    ] as const) {
      expect(() =>
        loadOriginGateConfig({
          NODE_ENV: "production",
          ...(mode === undefined ? {} : { ORIGIN_SECRET_MODE: mode }),
        }),
      ).toThrow(ConfigError);
    }
    expect(() =>
      loadOriginGateConfig({ ORIGIN_SECRET_MODE: "disabled" }),
    ).toThrow(ConfigError);
  });

  test("treats an absent mode as armed in every runtime", () => {
    for (const runtime of [
      undefined,
      "production",
      "development",
      "test",
    ] as const) {
      expect(() =>
        loadOriginGateConfig(
          runtime === undefined ? {} : { NODE_ENV: runtime },
        ),
      ).toThrow(ConfigError);
    }
  });

  test("decodes the current and next rotation secrets to fixed 32-byte buffers", () => {
    const config = loadOriginGateConfig({
      NODE_ENV: "production",
      ORIGIN_SECRET: CURRENT,
      ORIGIN_SECRET_NEXT: NEXT,
    });

    expect(config.required).toBe(true);
    expect(config.secrets).toHaveLength(2);
    expect(config.secrets[0]).toEqual(Buffer.alloc(32, 0x11));
    expect(config.secrets[1]).toEqual(Buffer.alloc(32, 0x22));
  });

  test("fails closed when an enabled gate has no current secret", () => {
    expect(() =>
      loadOriginGateConfig({ ORIGIN_SECRET_MODE: "enabled" }),
    ).toThrow(ConfigError);
  });

  test("rejects non-canonical current or next secrets", () => {
    const cases = [
      { ORIGIN_SECRET_MODE: "enabled", ORIGIN_SECRET: "short" },
      {
        ORIGIN_SECRET_MODE: "enabled",
        ORIGIN_SECRET: CURRENT,
        ORIGIN_SECRET_NEXT: "not-base64url",
      },
    ];

    for (const env of cases) {
      expect(() => loadOriginGateConfig(env)).toThrow(ConfigError);
    }
  });
});

describe("originRequestAuthorized", () => {
  const config = loadOriginGateConfig({
    NODE_ENV: "production",
    ORIGIN_SECRET_MODE: "enabled",
    ORIGIN_SECRET: CURRENT,
    ORIGIN_SECRET_NEXT: NEXT,
  });

  const request = (presented?: string): Request =>
    new Request(
      "https://origin.test/healthz",
      presented === undefined || ORIGIN_SECRET_HEADER === undefined
        ? {}
        : { headers: { [ORIGIN_SECRET_HEADER]: presented } },
    );

  test("accepts the current and next secret during two-phase rotation", () => {
    expect(originRequestAuthorized).toBeFunction();
    if (originRequestAuthorized === undefined) return;
    expect(originRequestAuthorized(request(CURRENT), config)).toBe(true);
    expect(originRequestAuthorized(request(NEXT), config)).toBe(true);
  });

  test("rejects a missing, malformed, wrong-length, or wrong secret", () => {
    expect(originRequestAuthorized).toBeFunction();
    if (originRequestAuthorized === undefined) return;
    expect(originRequestAuthorized(request(), config)).toBe(false);
    expect(originRequestAuthorized(request("not-base64url"), config)).toBe(
      false,
    );
    expect(
      originRequestAuthorized(
        request(Buffer.alloc(31).toString("base64url")),
        config,
      ),
    ).toBe(false);
    expect(originRequestAuthorized(request(WRONG), config)).toBe(false);
  });

  test("allows requests when the runtime gate is explicitly disabled", () => {
    expect(originRequestAuthorized).toBeFunction();
    if (originRequestAuthorized === undefined) return;
    expect(
      originRequestAuthorized(
        request(),
        loadOriginGateConfig({
          NODE_ENV: "test",
          ORIGIN_SECRET_MODE: "disabled",
        }),
      ),
    ).toBe(true);
  });
});
