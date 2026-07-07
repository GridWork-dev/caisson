---
"@caisson/frameworks-pack": minor
---

Add SOC 2, PCI DSS, and GDPR named-regime crosswalks to the compliance framework pack. Each
crosswalk maps the regime's control ids to the specific Caisson module and mechanism that addresses
them, with a machine-readable claim level per row: "implements" only where a live test in the
repository proves the technical control (and that proof is linked on the row), "maps to" everywhere
else. Every row also states what remains the buyer's responsibility. Each crosswalk exports as a
self-contained artifact with the regime revision pinned and a scope disclaimer embedded, so a
reviewer reading it outside the website sees exactly what is and is not covered — the crosswalks are
mappings, not a certification or a claim of compliance.
