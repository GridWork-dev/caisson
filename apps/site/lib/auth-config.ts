// Pure sign-in configuration: which OAuth providers are offered (env-gated) + the Zod boundary
// for the magic-link request. Kept dependency-free (no `better-auth`, no DB) so it unit-tests
// instantly and so `lib/auth-server.ts` and the `/login` page share ONE source of truth for
// "which providers are live" — the page must never render a button for a provider the server
// isn't configured to accept.
//
// Provider gating is the load-bearing invariant (ADR-0132 intent): magic-link is always-on
// (Resend key already provisioned); GitHub/Google are offered ONLY when BOTH their client id and
// secret are present. A missing pair means that provider is silently not offered — never a crash,
// never a half-configured OAuth button that 500s on click.
import { z } from "zod";

export type OAuthProviderId = "github" | "google" | "discord";

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export type SocialProvidersConfig = Partial<
  Record<OAuthProviderId, OAuthCredentials>
>;

/** The env var pair each OAuth provider reads its credentials from. */
const PROVIDER_ENV: Record<
  OAuthProviderId,
  { readonly id: string; readonly secret: string }
> = {
  github: { id: "GITHUB_CLIENT_ID", secret: "GITHUB_CLIENT_SECRET" },
  google: { id: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET" },
  // ADR-0203: Discord doubles as sign-in AND the buyer↔Discord identity link the purchase→role
  // push resolves through (the dashboard's Connect-Discord button uses linkSocial on this provider).
  discord: { id: "DISCORD_CLIENT_ID", secret: "DISCORD_CLIENT_SECRET" },
};

/** Stable display order for the rendered buttons. */
export const OAUTH_PROVIDER_IDS: readonly OAuthProviderId[] = [
  "github",
  "google",
  "discord",
];

type EnvLike = Record<string, string | undefined>;

/**
 * Resolve the OAuth providers whose credentials are fully present in `env`. A provider appears in
 * the result ONLY when both its client id and secret are non-empty (after trim) — a partial pair
 * is treated as unconfigured. Passing `env` in (rather than reading `process.env`) keeps the
 * function pure and testable.
 */
export function resolveSocialProviders(env: EnvLike): SocialProvidersConfig {
  const out: SocialProvidersConfig = {};
  for (const id of OAUTH_PROVIDER_IDS) {
    const { id: idKey, secret: secretKey } = PROVIDER_ENV[id];
    const clientId = env[idKey]?.trim();
    const clientSecret = env[secretKey]?.trim();
    if (
      clientId !== undefined &&
      clientId.length > 0 &&
      clientSecret !== undefined &&
      clientSecret.length > 0
    ) {
      out[id] = { clientId, clientSecret };
    }
  }
  return out;
}

/** The provider ids to render sign-in buttons for, in display order (env-gated). */
export function configuredProviderIds(env: EnvLike): OAuthProviderId[] {
  const configured = resolveSocialProviders(env);
  return OAUTH_PROVIDER_IDS.filter((id) => configured[id] !== undefined);
}

/** Shared email validator: trimmed + lowercased + length-bounded + pattern-checked. */
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "invalid email");

/** Root-relative-only path (never absolute/protocol-bearing — no open redirect via callbackURL). */
const callbackPathField = z
  .string()
  .max(512)
  .refine((v) => v.startsWith("/") && !v.startsWith("//"), "invalid path");

/** better-auth's own bound for `emailAndPassword` (min 8 chars by default). */
const newPasswordField = z.string().min(8).max(128);

/**
 * The sign-in boundary schema (security floor: `.strict()` rejects unknown fields; bounded
 * strings). Email is trimmed + lowercased + length-bounded + pattern-checked, matching the
 * waitlist route's idiom. `callbackURL` is an optional in-app relative path the verify step
 * redirects to — bounded, and must be root-relative (never an absolute/protocol-bearing URL, so
 * a crafted `callbackURL` can't turn the magic link into an open redirect).
 */
export const magicLinkRequestSchema = z
  .object({
    email: emailField,
    callbackURL: callbackPathField.optional(),
  })
  .strict();

/** Password sign-in boundary — no length floor on the password (that's a sign-up-time concern). */
export const passwordSignInSchema = z
  .object({
    email: emailField,
    password: z.string().min(1).max(128),
    callbackURL: callbackPathField.optional(),
  })
  .strict();

/** Password sign-up boundary — `name` is required by better-auth's base user schema. */
export const passwordSignUpSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: emailField,
    password: newPasswordField,
    callbackURL: callbackPathField.optional(),
  })
  .strict();

/** Forgot-password boundary — just the email; better-auth no-ops silently for an unknown one. */
export const forgotPasswordSchema = z
  .object({
    email: emailField,
  })
  .strict();

/** Reset-password boundary — the one-time token plus the new password. */
export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1).max(2048),
    newPassword: newPasswordField,
  })
  .strict();
