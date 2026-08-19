// Runtime-origin gate for the two client analytics senders (components/web-vitals-send.ts and
// components/posthog-init.tsx). Both read `NEXT_PUBLIC_POSTHOG_KEY`, and both used to treat the
// mere presence of that key as permission to report into caisson-prod. That is the wrong gate.
//
// `NEXT_PUBLIC_*` values are INLINED into the client bundle by Next at build time (ADR-0224), and
// the key is a public `phc_` ingest token rather than a secret — it is *meant* to ship in client
// JS. The consequence is that any artifact built on a machine where that env is exported carries
// caisson-prod's key: a `bun run dev` in this repo, a `next build` of an unrelated project on the
// same box, a preview deploy. Every one of those then beacons real events into the production
// project, indistinguishable from traffic.
//
// The runtime origin is the only honest discriminator, so it is the gate. This makes inlining
// harmless by construction: a bundle carrying the key but served from anywhere other than the
// production hosts simply never sends, no matter which repo built it.
import { SITE_URL } from "./metadata";

const APEX = new URL(SITE_URL).host;

/**
 * The hosts this site is actually served from in production.
 *
 * Both the apex and `www` answer 200 directly — Cloudflare proxies both CNAMEs to the same Railway
 * service and there is no www→apex redirect (no middleware, no `redirects()` entry), so omitting
 * `www` here would silently blind real traffic rather than only blocking noise.
 */
export const PRODUCTION_ANALYTICS_HOSTS: readonly string[] = [
  APEX,
  `www.${APEX}`,
];

/** True only for a host the production site actually serves from. Port-bearing hosts (`:3000`) and
 * every preview/localhost origin fall through to false. */
export function isProductionAnalyticsHost(host: string | undefined): boolean {
  return host !== undefined && PRODUCTION_ANALYTICS_HOSTS.includes(host);
}
