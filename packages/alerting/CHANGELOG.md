# @caisson/alerting

## 0.1.4

### Patch Changes

- cf66d65: Hardened row-level security on the alert-audit log table: the tenant-isolation check now
  discards an empty-string tenant identifier before comparing it against a row's tenant column,
  instead of comparing against it directly. This closes a narrow gap where certain
  connection-pooling configurations can leave a database session with an empty string instead
  of a properly cleared value, which previously could coincide with a real row's tenant column
  and let it be read. Shipped as a follow-up migration alongside the original table migration,
  so existing installs pick up the hardening on their next migrate run.
- Updated dependencies [cf66d65]
  - @caisson/kernel@0.4.1
  - @caisson/email@0.2.3

## 0.1.3

### Patch Changes

- Updated dependencies [fb8d966]
  - @caisson/kernel@0.4.0
  - @caisson/email@0.2.2

## 0.1.2

### Patch Changes

- 549dd4e: Strix pentest remediation (ADR-0204). kernel: new shared SSRF guard (`ssrf.ts`) — literal denylist + async DNS resolve-recheck of every resolved IP, the DNS-rebinding defense (vuln-0004). alerting + ai-kit: dedupe onto the kernel guard and resolve-recheck at the outbound-fetch seam (alerting per fetch; ai-kit via an injected guarded `fetch` for custom provider baseUrls). billing: `purchase.completed` carries `lineItems: {priceId, quantity}[]` so a multi-item cart fulfills every paid line, not just the first (vuln-0005), and a `subscription_update` regression test (vuln-0002).
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [549dd4e]
  - @caisson/kernel@0.3.0
  - @caisson/email@0.2.1

## 0.1.1

### Patch Changes

- 33bee35: Whole-repo audit round-4 remediation (ledger 2026-07-01): BYOK (tenant-key) inference now
  makes zero wallet movement while internal metering still runs, implementing ADR-0182/0198;
  provider-unreported token usage is kept distinct from genuine zero so reconcile settles at
  the reserved estimate instead of silently refunding a real call; the spend-window bucket is
  fixed at reserve and reused at reconcile so boundary-straddling calls no longer undercount
  the hard-cap breaker. Alerting webhook/Slack/Telegram destinations get an https-only +
  private/metadata-range SSRF guard at both the Zod boundary and the fetch seam, mirroring the
  ai-kit baseUrl policy. The retention_audit table gets fail-closed RLS via an append-only
  follow-up migration. The pg-boss production job driver now validates task name + payload
  schema on enqueue like its sibling drivers.
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/email@0.2.0
