"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  clearSignupIntentCookie,
  parseSignupIntentCookie,
  type SignupIntent,
} from "@/lib/signup-intent";

// One-shot signup-intent cookie set by the login form (ADR-0254 gap #12, docs-funnel Option
// C) — see `@/lib/signup-intent` for the codec + full rationale (why a cookie, not a query
// param). Read-and-clear: a page reload after the first mount must never re-fire.
function readAndClearSignupIntentCookie(): SignupIntent | null {
  const signup = parseSignupIntentCookie(document.cookie);
  if (signup !== null) document.cookie = clearSignupIntentCookie();
  return signup;
}

// PostHog product analytics (US Cloud) — scoped to the AUTHENTICATED dashboard ONLY. This component
// is imported from the dashboard layout and NEVER the root/marketing layout, so the cookieless
// Plausible marketing site never loads PostHog (ADR-0118 keeps marketing cookieless; PostHog adds
// funnels/retention/replay on the authed surface only). Env-gated on `NEXT_PUBLIC_POSTHOG_KEY`: a
// no-op (no init, no network) when unset — the same port pattern as `PlausibleInit`.
//
// `persistence: 'memory'` (posthog-js JS-web persistence docs) keeps PostHog itself cookieless too —
// no cookie, no localStorage, state lives only for the page's lifetime. That's a deliberate trade
// against `cookieless_mode: 'always'`: that mode forbids `identify()` (a stable distinct ID would be
// Personal Data under GDPR without consent), which would break the very account-linked analytics
// this component exists for. Memory persistence has no such restriction and needs re-identifying on
// every mount, which this component already does — so the trade costs nothing here. Net: reconciles
// the go-live no-consent-banner posture (`docs/state/go-live-legal-and-entity.md`) by running
// cookieless rather than gating behind a banner.
//
// `person_profiles: 'identified_only'` means no anonymous person is created until identify(); we
// identify the logged-in account immediately, so there is no pre-identify anonymous tracking. The
// lawful basis is the privacy policy accepted at sign-up (authenticated route). `posthog-js` is
// dynamically imported inside the effect — it reads `window` at import time and throws under SSR.
export function PostHogInit({ accountId }: { accountId: string }) {
  useEffect(() => {
    // Read+clear FIRST, regardless of whether PostHog itself is configured — Plausible's
    // `signup_complete` (cookieless, mounted on every route including `/dashboard`, ADR-0118)
    // must still fire on a fresh signup even when NEXT_PUBLIC_POSTHOG_KEY is unset.
    const signup = readAndClearSignupIntentCookie();
    if (signup !== null && !signup.plausibleAlreadyFired) {
      trackEvent("signup_complete", { source: "oauth_or_magiclink" });
    }

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key === undefined || key.length === 0) return;
    let cancelled = false;
    void import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;
      posthog.init(key, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        ui_host: "https://us.posthog.com",
        defaults: "2026-05-30", // modern SPA defaults: history_change pageviews + pageleave
        person_profiles: "identified_only",
        persistence: "memory",
      });
      posthog.identify(accountId);
      if (signup !== null) {
        posthog.capture(
          "account_created",
          signup.signupSource.length > 0
            ? { signup_source: signup.signupSource }
            : {},
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return null;
}
