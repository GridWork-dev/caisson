"use client";

import { Button } from "@/components";
import { trackEvent } from "@/lib/analytics";

// D12 item 4 (PRD-8): /partners had two bare mailto links and no instrumentation, so "no
// application arrived" was indistinguishable from "nobody reached the page". The application stays
// a mailto — that is the fallback action the finding asked to keep — and the only added signal is
// the click itself: one cookieless Plausible event (ADR-0118: marketing analytics is Plausible-only,
// PostHog stays dashboard-scoped; no cookie, no consent banner, no PII). The href is a real mailto
// rendered in the markup, so with JS disabled, or with NEXT_PUBLIC_PLAUSIBLE_DOMAIN unset, the link
// still works and nothing is collected (`trackEvent` no-ops).
const APPLY_HREF =
  "mailto:support@caisson.sh?subject=Caisson%20design-partner%20application";

/** The in-prose application link. `source` distinguishes it from the CTA button in the event. */
export function PartnersApplyLink({ children }: { children: string }) {
  return (
    <a
      href={APPLY_HREF}
      className="cs-link"
      onClick={() => {
        trackEvent("partners_apply_click", { source: "prose" });
      }}
    >
      {children}
    </a>
  );
}

/** The primary "Apply by email" CTA. */
export function PartnersApplyButton({ children }: { children: string }) {
  return (
    <Button
      href={APPLY_HREF}
      external
      variant="primary"
      onClick={() => {
        trackEvent("partners_apply_click", { source: "cta" });
      }}
    >
      {children}
    </Button>
  );
}
