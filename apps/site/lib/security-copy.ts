// One truth source for the human page and every machine-readable security surface.
export const SECURITY_META_DESCRIPTION =
  "How Caisson secures its controls and this site: fail-closed RLS, resolve-and-recheck SSRF, timing-safe comparisons, and a static caisson.sh with no origin server, no forms, and hardened response headers.";

export const SITE_SECURITY_FAQ = {
  question: "What runs behind caisson.sh?",
  answer:
    "Nothing dynamic. caisson.sh is a static export served from Cloudflare's edge: every page and the search index are prebuilt files, there is no origin server, no database, no sign-in, and no form that accepts input. Response headers (HSTS, nosniff, X-Frame-Options, a strict CSP) ship with every file.",
} as const;

export const SECURITY_LLMS_SUMMARY = SITE_SECURITY_FAQ.answer;

export const SECURITY_FAQ: ReadonlyArray<{
  question: string;
  answer: string;
}> = [
  {
    question: "Is Caisson SOC 2 or HIPAA certified?",
    answer:
      "No. Caisson is a codebase, not an auditor. It ships the technical controls those frameworks require (fail-closed RLS, WORM storage, an append-only audit chain) and generates the evidence pack you hand your auditor. The audit itself and your organizational controls (HR, vendor, incident response) remain yours.",
  },
  {
    question: "Does this site set tracking cookies?",
    answer:
      "No. Analytics are cookieless (Plausible), there are no third-party trackers, and there is no consent banner because nothing is stored on your device.",
  },
  {
    question:
      "What stops a DNS-rebinding attack against a webhook or provider URL I configure?",
    answer:
      "packages/kernel's ssrf.ts resolves the hostname and re-checks every returned IP against a private/loopback/link-local/metadata denylist immediately before the outbound fetch, and forces the request to fail on any redirect. A literal-only check can't see a name that resolves into private space after the fact; the resolve-and-recheck design closes that gap for both the alerting transports and the AI-Production provider baseUrl.",
  },
  SITE_SECURITY_FAQ,
  {
    question: "How do I report a vulnerability?",
    answer:
      "Email security@caisson.sh, or read the machine-readable policy at /.well-known/security.txt. There is no bug-bounty program yet; we still want the report.",
  },
];
