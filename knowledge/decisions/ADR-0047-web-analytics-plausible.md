# ADR-0047 — Web analytics: Plausible (cookieless, no consent banner)

Status: accepted · 2026-06-27 (closes the **"Analytics"** open fork for the GTM session.)

The site uses **Plausible** for web analytics — cookieless, no personal-data storage, **no consent
banner legally required**. Launch wiring is the **direct cloud script** (`data-domain="caisson.sh"`,
`https://plausible.io/js/script.js`), loaded via `next/script` in the root layout. A custom-event goal
`Signup` fires on a successful waitlist submission (ADR-0046).

## Why

A product selling fail-closed / compliance rigor must not ship cookie-tracking GA with a consent wall.
Plausible is cookieless and GDPR/PECR-clean with nothing to gate, EU-hosted, ~2.5 KB, and supports
conversion goals/UTM/funnels — the operator chose it over Cloudflare Web Analytics for the
day-one goals (waitlist conversion) the free CF beacon can't express. The classic script auto-detects
App-Router client-side navigations via the History API, so no manual pageview firing.

## Scope

Direct cloud integration at launch: the CSP (`public/_headers`, ADR-0045) allows exactly
`script-src 'self' https://plausible.io` + `connect-src 'self' https://plausible.io`. The script is
inert until a Plausible site for `caisson.sh` is registered — acceptable for a non-live scaffold. A
**first-party proxy** (serving the script + `/api/event` from a same-origin path so the CSP collapses
to `'self'` and ad-blockers are dodged) is recorded as **later hardening**, not built this session.

## Rejected

- **Cloudflare Web Analytics** — free/cookieless and on-brand, but no goals/funnels; loses the
  day-one waitlist-conversion signal.
- **No analytics at launch** — cleanest privacy story but flies blind on the wedge's first proof.

## Binding

Analytics is Plausible, cookieless, no consent banner, no cookie-based tracker; the CSP names only
`plausible.io` (or `'self'` once proxied). Adding a cookie-tracking analytics vendor or a consent
banner requires a superseding ADR.
