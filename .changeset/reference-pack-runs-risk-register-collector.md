---
"@caisson/app-compliance": patch
---

The reference compliance leg now runs the AI risk-register collector alongside the audit-chain, WORM-retention, tenant-isolation, and impersonation collectors. Its generated SOC 2 pack carries a fourth control — risk identification and assessment — evidenced by a traversal of a fixed AI risk register that checks every scored risk carries a treatment plan on record. The collector was already shipped and tested; it simply never ran in the reference pack, so the pack under-represented what the evidence engine can attest.
