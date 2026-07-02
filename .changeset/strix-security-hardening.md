---
"@caisson/kernel": patch
"@caisson/alerting": patch
"@caisson/ai-kit": patch
"@caisson/billing": patch
---

Strix pentest remediation (ADR-0204). kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, the DNS-rebinding defense (vuln-0004). alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first (vuln-0005), and a `subscription_update` regression test (vuln-0002).
