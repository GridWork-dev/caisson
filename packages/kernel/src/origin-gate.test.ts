import { describe, expect, test } from "bun:test";
import { ConfigError } from "./errors.ts";
import * as originGate from "./origin-gate.ts";

const { loadOriginGateConfig } = originGate;
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
  test("origin verification stays disabled when the runtime flag is absent", () => {
    expect(loadOriginGateConfig({})).toEqual({
      required: false,
      secrets: [],
    });
  });

  test("an absent flag fails startup on Cloud Run instead of serving ungated", () => {
    // K_SERVICE is present on every Cloud Run revision and on no Railway one. The first case is
    // the sharp one: a half-applied manifest where the secrets mount correctly and the flag row
    // is dropped — before this guard those valid secrets were silently discarded.
    expect(() =>
      loadOriginGateConfig({
        K_SERVICE: "caisson-site",
        ORIGIN_SECRET: CURRENT,
        ORIGIN_SECRET_NEXT: NEXT,
      }),
    ).toThrow(ConfigError);
    expect(() => loadOriginGateConfig({ K_SERVICE: "caisson-site" })).toThrow(
      ConfigError,
    );
    expect(() =>
      loadOriginGateConfig({
        K_SERVICE: "caisson-site",
        ORIGIN_SECRET_REQUIRED: "false",
      }),
    ).toThrow(ConfigError);
  });

  test("decodes the current and next rotation secrets to fixed 32-byte buffers", () => {
    const config = loadOriginGateConfig({
      ORIGIN_SECRET_REQUIRED: "true",
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
      loadOriginGateConfig({ ORIGIN_SECRET_REQUIRED: "true" }),
    ).toThrow(ConfigError);
  });

  test("rejects malformed flags and non-canonical current or next secrets", () => {
    const cases = [
      { ORIGIN_SECRET_REQUIRED: "yes", ORIGIN_SECRET: CURRENT },
      { ORIGIN_SECRET_REQUIRED: "true", ORIGIN_SECRET: "short" },
      {
        ORIGIN_SECRET_REQUIRED: "true",
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
    ORIGIN_SECRET_REQUIRED: "true",
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
    expect(originRequestAuthorized(request(), loadOriginGateConfig({}))).toBe(
      true,
    );
  });
});
