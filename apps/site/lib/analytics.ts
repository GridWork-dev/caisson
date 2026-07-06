// Marketing custom events (ADR-0237 F8) — Plausible ONLY on the marketing surface (ADR-0118:
// cookieless, no consent banner; PostHog stays dashboard-scoped). Same env gate as PlausibleInit:
// no NEXT_PUBLIC_PLAUSIBLE_DOMAIN → silent no-op, no import, no network. Fire-and-forget — an
// analytics failure must never surface in the page.
export type MarketingEvent =
  | "view_item"
  | "add_to_cart"
  | "view_cart"
  | "begin_checkout"
  | "nav_panel_open"
  | "search_open"
  | "docs_cta_click"
  | "signup_complete";

export function trackEvent(
  name: MarketingEvent,
  props?: Record<string, string>,
): void {
  if (typeof window === "undefined") return;
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (domain === undefined || domain.length === 0) return;
  void import("@plausible-analytics/tracker")
    .then(({ track }) => track(name, props ? { props } : {}))
    .catch(() => undefined);
}
