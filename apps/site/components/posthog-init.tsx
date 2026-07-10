"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
//
// `capture_pageview: false` + a manual `$pageview` per route change: posthog-js's
// bundled `history_change` autocapture does not reliably observe every Next.js App Router client
// transition (the router can swap routes via an RSC-payload fetch rather than the plain
// `history.pushState` the autocapture patch listens for) — the symptom is zero pageview signal in
// caisson-prod. PostHog's own App Router guidance is to disable the bundled capture and fire
// `$pageview` manually off `usePathname`/`useSearchParams`, which is what the effect does below.
// `useSearchParams` requires an ancestor Suspense boundary (a Next.js App Router build rule) — the
// caller (`dashboard/layout.tsx`) wraps this component in one.
export function PostHogInit({ accountId }: { accountId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Gates init/identify/signup-read to the FIRST effect run per mount; every later run (a route
  // change) skips them and falls through only to the $pageview capture. The dashboard layout that
  // hosts this component persists across `/dashboard/**` navigations, so it never remounts.
  const initialized = useRef(false);

  useEffect(() => {
    // First run only: read+clear the one-shot signup cookie and fire Plausible's cookieless
    // `signup_complete` (ADR-0118) — regardless of whether PostHog is configured, and never on a
    // route-change re-run (the read-and-clear is already idempotent, but the ref keeps it to mount).
    let signup: SignupIntent | null = null;
    if (!initialized.current) {
      signup = readAndClearSignupIntentCookie();
      if (signup !== null && !signup.plausibleAlreadyFired) {
        trackEvent("signup_complete", { source: "oauth_or_magiclink" });
      }
    }

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key === undefined || key.length === 0) {
      initialized.current = true; // signup handled; nothing more to do without PostHog
      return;
    }
    let cancelled = false;
    void import("posthog-js").then(({ default: posthog }) => {
      if (cancelled) return;
      if (!initialized.current) {
        posthog.init(key, {
          // `||`, not `??`: the Dockerfile bakes this ARG with an empty-string default, and an
          // inlined "" must fall through to the real host — `"" ?? x` keeps the empty string.
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
          ui_host: "https://us.posthog.com",
          defaults: "2026-05-30", // modern SPA defaults: pageleave + (overridden) pageview mode
          person_profiles: "identified_only",
          persistence: "memory",
          capture_pageview: false, // this effect captures $pageview manually — see header
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
        initialized.current = true;
      }
      // One $pageview per route change (path or query), including the initial mount. Same resolved
      // `.then()` as init/identify, so it can never fire against an unconfigured instance.
      const query = searchParams.toString();
      const path = query.length > 0 ? `${pathname}?${query}` : pathname;
      posthog.capture("$pageview", {
        $current_url: `${window.location.origin}${path}`,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [accountId, pathname, searchParams]);

  return null;
}
