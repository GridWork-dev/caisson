---
"@caisson/site": patch
---

Marketplace and hero visual fixes. Marketplace cards no longer clip their kind pill into the neighbouring card when a demo badge is present — the header row splits into a lead cluster (kind + demo) and a right-aligned controls cluster that wraps instead of overflowing. The marketplace hero's blank right half now carries a self-contained, brand-styled diagram of the six bundles composing onto one Apache-2.0 audited base. On the homepage the install column is balanced against the cross-tenant psql terminal with a filled proof panel (fixing a proof chip that stretched full-width), and the honest-artifact code card header reads as a clean file path instead of a long label-plus-path string. The primary-nav disclosure now renders identical markup on the server and client — removing a hydration mismatch — and the immutable static-asset cache is scoped to production so development always serves fresh chunks.
