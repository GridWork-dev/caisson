"use client";

import { useEffect } from "react";

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
    });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  return null;
}
