// Shared codec for the one-shot signup-intent cookie (ADR-0254 gap #12, docs-funnel Option C).
// The login form SETS it when the visitor's declared intent is "create account" (see
// `app/(marketing)/login/login-form.tsx`'s header comment for why intent, not a server-side
// "new user" signal, drives this); `PostHogInit` READS-AND-CLEARS it on first `/dashboard`
// mount (`components/posthog-init.tsx`). One codec here, not two drifting string formats in
// the two files that touch it.
//
// A cookie, not a query param: the dashboard LAYOUT can't read `searchParams` in the Next.js
// App Router (only a page component can) — see login-form.tsx.
const COOKIE_NAME = "cs_signup_intent";
// ponytail: a same-browser assumption — verifying a magic-link/password-verify email on a
// different device drops the signal; 1 day covers same-device delay. Upgrade path if precision
// ever matters: a server-side better-auth `databaseHooks.user.create` marker.
const MAX_AGE_S = 60 * 60 * 24;

export interface SignupIntent {
  signupSource: string;
  /** True for the password flow, which already fires Plausible's `signup_complete` at its own
   * success branch — the dashboard-landing read must not double-fire it. */
  plausibleAlreadyFired: boolean;
}

/** Bound + charset-restrict an untrusted `?ref=` value before it ever reaches a cookie or an
 * analytics property (security floor: bound strings, pattern validation). */
export function sanitizeSignupSource(ref: string | undefined): string {
  if (ref === undefined) return "";
  return ref
    .trim()
    .slice(0, 64)
    .replace(/[^a-zA-Z0-9_-]/g, "");
}

/** A `document.cookie =`-assignable string that sets the intent cookie. */
export function encodeSignupIntentCookie(
  signupSource: string | undefined,
  plausibleAlreadyFired: boolean,
): string {
  const value = `${sanitizeSignupSource(signupSource)}|${plausibleAlreadyFired ? "1" : "0"}`;
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${String(MAX_AGE_S)}; samesite=lax; secure`;
}

/** A `document.cookie =`-assignable string that clears the intent cookie (read-once contract). */
export function clearSignupIntentCookie(): string {
  return `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax; secure`;
}

/** Parse the intent cookie out of a raw `document.cookie` string. `null` when absent. */
export function parseSignupIntentCookie(
  cookieHeader: string,
): SignupIntent | null {
  const row = cookieHeader
    .split("; ")
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (row === undefined) return null;
  const raw = decodeURIComponent(row.slice(COOKIE_NAME.length + 1));
  const [signupSource = "", flag] = raw.split("|");
  return { signupSource, plausibleAlreadyFired: flag === "1" };
}
