// Route + repo constants shared across the docs machinery (ADR-0045).
export const docsRoute = "/docs";
export const docsContentRoute = "/llms.mdx/docs";
// The single marketing pricing page (ADR-0234 F4) — every generated `pricing/*` corpus source
// (services/docs pricing-doc.ts) cites back to this one route; there is no per-doc pricing sub-route.
export const pricingRoute = "/marketplace";
export const gitConfig = {
  user: "caisson-sh",
  repo: "caisson",
  branch: "main",
} as const;
