import { describe, expect, test } from "bun:test";
import {
  configuredProviderIds,
  forgotPasswordSchema,
  magicLinkRequestSchema,
  passwordSignInSchema,
  passwordSignUpSchema,
  resetPasswordSchema,
  resolveSocialProviders,
} from "./auth-config.ts";

const GH = { GITHUB_CLIENT_ID: "gh-id", GITHUB_CLIENT_SECRET: "gh-secret" };
const GOOG = {
  GOOGLE_CLIENT_ID: "goog-id",
  GOOGLE_CLIENT_SECRET: "goog-secret",
};
const DISC = {
  DISCORD_CLIENT_ID: "disc-id",
  DISCORD_CLIENT_SECRET: "disc-secret",
};

describe("provider gating (env-gated OAuth)", () => {
  test("all providers configured → all offered, in display order", () => {
    const env = { ...GH, ...GOOG, ...DISC };
    expect(configuredProviderIds(env)).toEqual(["github", "google", "discord"]);
    expect(resolveSocialProviders(env)).toEqual({
      github: { clientId: "gh-id", clientSecret: "gh-secret" },
      google: { clientId: "goog-id", clientSecret: "goog-secret" },
      discord: { clientId: "disc-id", clientSecret: "disc-secret" },
    });
  });

  test("discord alone configured → only discord offered (ADR-0203 link seam)", () => {
    expect(configuredProviderIds(DISC)).toEqual(["discord"]);
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

describe("password auth boundaries (.strict())", () => {
  test("sign-in accepts any non-empty password (length floor is a sign-up concern)", () => {
    expect(
      passwordSignInSchema.safeParse({
        email: "buyer@example.com",
        password: "x",
      }).success,
    ).toBe(true);
    expect(
      passwordSignInSchema.safeParse({
        email: "buyer@example.com",
        password: "",
      }).success,
    ).toBe(false);
  });

  test("sign-up requires a name and an 8+ char password", () => {
    expect(
      passwordSignUpSchema.safeParse({
        name: "Ada",
        email: "buyer@example.com",
        password: "short",
      }).success,
    ).toBe(false);
    expect(
      passwordSignUpSchema.safeParse({
        name: "Ada",
        email: "buyer@example.com",
        password: "long-enough-password",
      }).success,
    ).toBe(true);
    expect(
      passwordSignUpSchema.safeParse({
        name: "",
        email: "buyer@example.com",
        password: "long-enough-password",
      }).success,
    ).toBe(false);
  });

  test("forgot-password rejects unknown fields (strict boundary)", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "buyer@example.com" }).success,
    ).toBe(true);
    expect(
      forgotPasswordSchema.safeParse({
        email: "buyer@example.com",
        extra: true,
      }).success,
    ).toBe(false);
  });

  test("reset-password requires a token and an 8+ char new password", () => {
    expect(
      resetPasswordSchema.safeParse({ token: "tok", newPassword: "short" })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        token: "tok",
        newPassword: "long-enough-password",
      }).success,
    ).toBe(true);
    expect(
      resetPasswordSchema.safeParse({
        token: "",
        newPassword: "long-enough-password",
      }).success,
    ).toBe(false);
  });
});
