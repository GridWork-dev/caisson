import { serializeJsonLd } from "./jsonld";

/**
 * XSS-safe <script type="application/ld+json"> for a JSON-LD payload. serializeJsonLd escapes `<`
 * so a stray "</script>" in any field cannot break out of the tag. Consolidating the raw
 * dangerouslySetInnerHTML here structurally un-flags the dynamic [slug] spoke pages the security
 * scan hit (SPEC-security-scan-findings-triage F1) — a real move off the flagged sites, not a
 * suppression.
 */
export function JsonLdScript({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
