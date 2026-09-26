// The third-party services that process data for the CAISSON SERVICE itself — this website,
// email, support, monitoring, and inference. Caisson the product runs in
// the buyer's own infrastructure and processes their application data there; the vendors below never
// touch it. Rendered as a table on /trust.
//
// MAINTENANCE INVARIANT: this list is a maintained artifact, not prose. A new external service that
// processes any data for the Caisson service lands a row here in the same change that introduces it
// (the site subprocessor list mirrors the security-surfaces "one row per external sink" rule). A row
// removed here means the vendor is gone from the stack.
//
// `region` is the provider's stated primary processing location at country/edge granularity — a hint
// for a procurement reviewer, not a data-residency guarantee.

export interface Subprocessor {
  /** Vendor / service name. */
  readonly processor: string;
  /** What the service does for Caisson, in one buyer-readable clause. */
  readonly purpose: string;
  /** The categories of data the service processes. */
  readonly dataCategories: readonly string[];
  /** Primary processing region as stated by the provider; omitted where the provider states none. */
  readonly region?: string;
}

export const SUBPROCESSORS: readonly Subprocessor[] = [
  {
    processor: "Railway",
    purpose:
      "Hosts the license, registry, docs, and support services, along with their Postgres databases.",
    dataCategories: ["Account email", "Entitlement records", "Support content"],
    region: "United States",
  },
  {
    processor: "Cloudflare",
    purpose:
      "DNS, reverse proxy, WAF, edge Workers (the registry read path), and R2 object storage.",
    dataCategories: [
      "Request metadata (IP address, user agent)",
      "Registry index and artifacts",
    ],
    region: "Global edge network",
  },
  {
    processor: "Resend",
    purpose: "Delivery of transactional and product-update email.",
    dataCategories: ["Email address", "Message content"],
    region: "United States",
  },
  {
    processor: "Amazon SES",
    purpose: "Secondary delivery path for transactional email.",
    dataCategories: ["Email address", "Message content"],
    region: "United States",
  },
  {
    processor: "Plausible",
    purpose: "Cookieless site analytics for the marketing pages.",
    dataCategories: [
      "Aggregated page views (no cookies, no persistent identifier)",
    ],
    region: "European Union",
  },
  {
    processor: "Grafana Cloud",
    purpose: "Observability: metrics, logs, and traces from the Caisson fleet.",
    dataCategories: ["Operational telemetry"],
    region: "United States",
  },
  {
    processor: "Better Stack",
    purpose: "Uptime monitoring and the public status page.",
    dataCategories: ["Availability probe results (no personal data)"],
    region: "United States",
  },
  {
    processor: "OpenRouter",
    purpose: "AI inference for the support bot.",
    dataCategories: ["Questions submitted to the support bot"],
    region: "United States",
  },
  {
    processor: "GitHub",
    purpose: "Source hosting and continuous integration.",
    dataCategories: ["Source code", "CI logs"],
    region: "United States",
  },
  {
    processor: "Discord",
    purpose: "The support and community server.",
    dataCategories: ["Community messages", "Discord account identity"],
    region: "United States",
  },
];
