// One truth source for the human page and every machine-readable security surface. Railway is the
// current deployment; Cloud Run controls stay conditional until their runtime flags are enabled.
export const SECURITY_META_DESCRIPTION =
  "How Caisson secures its controls and this site: fail-closed RLS, resolve-and-recheck SSRF, timing-safe comparisons, and Railway admin app auth. When the Cloud Run edge gates are enabled, origin-secret and Access-JWT checks run before application auth.";

export const ADMIN_SECURITY_POSTURE = {
  title: "Admin protected by layered, fail-closed gates",
  body: "apps/admin requires a signed app session linked to an allowlisted numeric GitHub ID on every non-bootstrap route. When the Cloud Run edge gates are enabled, the app-wide proxy also requires the Worker origin secret on every route—including /healthz—and validates the Access JWT's JWKS signature, issuer, audience, time window, and identity claims before app auth runs. Missing or malformed required configuration stops the proxy from serving.",
} as const;

export const ADMIN_SECURITY_FAQ = {
  question:
    "How is the admin dashboard protected if it renders every tenant's data?",
  answer:
    "Cloudflare Access gates protected edge traffic. On Cloud Run, apps/admin's proxy rejects a missing or wrong Worker origin secret and an invalid Access JWT before application auth runs. The app then independently requires a signed better-auth session linked to an allowlisted numeric GitHub ID. During migration, Railway keeps that existing app-auth gate until the edge runtime gates are explicitly enabled.",
} as const;

export const SECURITY_LLMS_SUMMARY = ADMIN_SECURITY_FAQ.answer;

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
  ADMIN_SECURITY_FAQ,
  {
    question: "How do I report a vulnerability?",
    answer:
      "Email security@caisson.sh, or read the machine-readable policy at /.well-known/security.txt. There is no bug-bounty program yet; we still want the report.",
  },
];
