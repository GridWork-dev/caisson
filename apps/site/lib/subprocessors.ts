// OPERATOR REVIEW: rewritten for the open-source model on 2026-09-26; review before launch.
//
// The third-party services that process data for the CAISSON SERVICE itself — this static
// website. Caisson the software runs in your own infrastructure and processes your application
// data there; the vendor below never touches it. Rendered as a table on /trust.
//
// MAINTENANCE INVARIANT: this list is a maintained artifact, not prose. A new external service that
// processes any data for the Caisson service lands a row here in the same change that introduces it
// (the site subprocessor list mirrors the security-surfaces "one row per external sink" rule). A row
// removed here means the vendor is gone from the stack.
//
// `region` is the provider's stated primary processing location at country/edge granularity.

export interface Subprocessor {
  /** Vendor / service name. */
  readonly processor: string;
  /** What the service does for Caisson, in one plain-language clause. */
  readonly purpose: string;
  /** The categories of data the service processes. */
  readonly dataCategories: readonly string[];
  /** Primary processing region as stated by the provider; omitted where the provider states none. */
  readonly region?: string;
}

export const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    processor: "Cloudflare",
    purpose: "Hosts caisson.sh as a static site: DNS, edge delivery, and WAF.",
    dataCategories: ["Request metadata (IP address, user agent)"],
    region: "Global edge network",
  },
];
