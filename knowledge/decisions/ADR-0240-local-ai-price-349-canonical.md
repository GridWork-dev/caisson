# ADR-0240 — Local-first AI edition price: $349 is canonical

**Status:** accepted · 2026-07-03 (deploy-closeout session, operator picker). Resolves the
audit-v2 manifest-vs-ADR price-drift flag (`b5d180701c0e3069`, parked in the P1 buyer-breaking
spec): the registry manifest's `priceCents: 34900` ($349) is **correct** — **ADR-0137's below-sum
edition reprice superseded ADR-0129's earlier $399 number**, and the manifest, the site
(`apps/site/lib/pricing.ts`), and the Paddle SANDBOX price (34900) already agree at $349. **No
price NUMBER changes anywhere.** Affirms ADR-0137; clarifies ADR-0129. Append-only; supersede
with a later ADR, never edit. **Tags:** none (documentation-only; the manifest comment fix rides
the wave-6b PR).

## Decision

- $349 stays. The `packages/local-ai/manifest.ts` comment that framed 34900 as a "pre-launch
  PLACEHOLDER" pending an open pricing fork is rewritten to cite this lock — the displayed-price
  fork was closed by ADR-0082/0137; only silent operator adjustment authority remains (per the
  standing "Pricing FINAL adjustments" board note).
- The alternative ($399, restoring ADR-0129) was rejected: it would be a visible price INCREASE on
  a live self-serve surface, and ADR-0137 is the later lock.

## Consequences

- The P1 buyer-breaking spec's parked fork is resolved; its execution wave ships no number change
  for local-ai and treats $349 as ground truth in the manifest-vs-ADR standards check it adds.
