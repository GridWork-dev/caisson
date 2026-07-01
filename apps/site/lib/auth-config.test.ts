import { describe, expect, test } from "bun:test";
import {
  configuredProviderIds,
  magicLinkRequestSchema,
  resolveSocialProviders,
} from "./auth-config.ts";

const GH = { GITHUB_CLIENT_ID: "gh-id", GITHUB_CLIENT_SECRET: "gh-secret" };
const GOOG = {
  GOOGLE_CLIENT_ID: "goog-id",
  GOOGLE_CLIENT_SECRET: "goog-secret",
};

describe("provider gating (env-gated OAuth)", () => {
  test("both providers configured → both offered, in display order", () => {
    const env = { ...GH, ...GOOG };
    expect(configuredProviderIds(env)).toEqual(["github", "google"]);
    expect(resolveSocialProviders(env)).toEqual({
      github: { clientId: "gh-id", clientSecret: "gh-secret" },
      google: { clientId: "goog-id", clientSecret: "goog-secret" },
    });
  });

  test("only github configured → only github offered, google absent", () => {
    expect(configuredProviderIds(GH)).toEqual(["github"]);
    expect(resolveSocialProviders(GH).google).toBeUndefined();
  });

  test("no OAuth creds → no providers offered (magic-link stays primary)", () => {
    expect(configuredProviderIds({})).toEqual([]);
    expect(resolveSocialProviders({})).toEqual({});
  });

  test("partial pair (id without secret) → provider not offered, no crash", () => {
    const env = { GITHUB_CLIENT_ID: "gh-id" }; // missing secret
    expect(configuredProviderIds(env)).toEqual([]);
    expect(resolveSocialProviders(env)).toEqual({});
  });

  test("empty-string creds are treated as unconfigured", () => {
    const env = { GITHUB_CLIENT_ID: "  ", GITHUB_CLIENT_SECRET: "gh-secret" };
    expect(configuredProviderIds(env)).toEqual([]);
  });
});

describe("magic-link request boundary (.strict())", () => {
  test("valid email parses, trimmed + lowercased", () => {
    const parsed = magicLinkRequestSchema.safeParse({
      email: "  Buyer@Example.COM  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("buyer@example.com");
  });

  test("unknown field is rejected (strict boundary)", () => {
    const parsed = magicLinkRequestSchema.safeParse({
      email: "buyer@example.com",
      isAdmin: true,
    });
    expect(parsed.success).toBe(false);
  });

  test("invalid email is rejected", () => {
    expect(
      magicLinkRequestSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
  });

  test("absolute / protocol-relative callbackURL is rejected (no open redirect)", () => {
    expect(
      magicLinkRequestSchema.safeParse({
        email: "buyer@example.com",
        callbackURL: "https://evil.example.com",
      }).success,
    ).toBe(false);
    expect(
      magicLinkRequestSchema.safeParse({
        email: "buyer@example.com",
        callbackURL: "//evil.example.com",
      }).success,
    ).toBe(false);
  });

  test("root-relative callbackURL is accepted", () => {
    const parsed = magicLinkRequestSchema.safeParse({
      email: "buyer@example.com",
      callbackURL: "/dashboard/license",
    });
    expect(parsed.success).toBe(true);
  });
});
