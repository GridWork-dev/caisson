# VERIFY + SWEEP — Stream D (base substrate drivers + go-live surface + CI)

**Act 4 (goal-backward VERIFY) + Act 5 (SWEEP)** · 2026-07-01 · branch `stream/base-golive` (off clean
`main`). **Gate: GREEN** — `bun run check` = 131 tasks (build + lint + test across every package, incl. the
Next `apps/site` production build) + kernel standards-gate `45 checked, 0 scaffold-skipped ✓ all conform
(ADR-0002)`. Local build only; nothing deployed.

## VERIFY — did each task achieve the SPEC goal?

| Task                           | Verdict           | Evidence                                                                                                                                                                                                                                               |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forks (D4/D7/D8 + license-KMS) | **PASS**          | Operator-locked; recorded append-only as ADR-0170–0176 + the board/`adr-index` (commit `83863c0`).                                                                                                                                                     |
| **D5** adapters (6 families)   | **PASS**          | email SMTP/SES/Postmark · field-crypto AWS KMS + DB WrappedKeyStore (throwing stub replaced) · WorkOS SSO · pg-boss · Supabase Transactor · LemonSqueezy/Polar — all dormant/env-gated, round-trip + shared conformance tests, gate green (`1f2e239`). |
| **D1** module price-ids        | **PASS**          | catalog placeholder ids now match the pricebook `PURCHASE_BOOK` keys; cross-package guard test (`ee5ea5c`).                                                                                                                                            |
| **D2** EULA + `/legal/eula`    | **PASS**          | Full EULA page + route + sitemap/footer wiring + forward-refs flipped; closes ADR-0107 gate #5 (`24cc6bc`).                                                                                                                                            |
| **D9** Turnstile client        | **PASS**          | Env-gated widget feeding the already-fail-closed server verify; dormant until the site key is set (`2602926`).                                                                                                                                         |
| **D8(a)** Faq + FeatureGrid    | **PASS (core)**   | Both primitives built + exported; `Faq` adopted at the two divergent poles (compliance Card-grid, ai-kit bare-div). Remaining 3 FAQ pages + broad FeatureGrid adoption = mechanical SWEEP item (`81117e0`→ see below).                                 |
| **D4** org account model       | **PASS (core)**   | `account_member` + dual-GUC RLS (login via `withUser`, member-list via `withTenant`) + resolver + owner authz; 10 PGlite tests green (`0e3eb02`). Live `getSession` wiring + org-management UI = deferred (justified below).                           |
| **D10** Greptile P2            | **PASS**          | Verified the 2 cli-meter bugs fixed on `main` (mkdtemp + injectable bundleRoot); backlog stays cleared (`81117e0`).                                                                                                                                    |
| **D13** services-hardening     | **PASS (doc)**    | Reconciled: build-state records all 7 code-merged (spot-verified #7 HSTS); #1/#2/#3 are deploy-composition, outside Stream D's tree (`81117e0`).                                                                                                       |
| **D3** storefront copy         | **PASS (verify)** | Recon confirmed pricing/editions/cart already ADR-0129/0130/0137-clean (zero waitlist/hedge/stale-price hits); superseded ADR-0080 clauses recorded in SPEC §3. No code needed.                                                                        |
| **D11** CI hygiene             | **PASS (verify)** | registry-index already a required check (live-API confirmed). macOS `native-ext` leg + TF remote backend are **host/DEPLOY-gated** (see below), not safe in-repo changes.                                                                              |
| **D7** signature slot          | **PASS (no-op)**  | Operator locked "leave blank this stream" — the reserved blank slot stays; no code. Three.js remains a future studio fork.                                                                                                                             |

**Goal-backward:** the SPEC goal was "finish the base-substrate driver surface + customer-facing go-live polish,
resolve the three forks." The driver surface (6 dormant families) is built + green; the go-live polish
(price-ids, EULA, Turnstile, FAQ consistency) is in; the forks are locked + recorded. **Achieved for the
in-scope surface**; the deferred items below are activation/mechanical/host-gated, not gaps in the decided work.

## SWEEP — downstream impact + queued follow-ups

**Deferred (justified), for a follow-up session:**

1. **D4 activation — `getSession` wiring + org-management UI.** The org core is built + tested, but wiring the
   live `apps/site/lib/auth.ts` `getSession` to resolve via `account_member` requires the table to be part of
   the **platform DB migration assembly** first — wiring it half-way (query a not-yet-migrated table) would
   break the currently-green dashboard with a redirect loop. Clean follow-up: add `ACCOUNT_MEMBER_SCHEMA_SQL`
   to the apps/site migration set → wire `getSession` (ensure-personal + resolve + active-account cookie +
   `selectActiveAccount`) → build the create-org/invite/switcher UI + wire `assertCanManageMembers` into the
   member/billing routes → stamp the active account at checkout. Personal-default behavior is unchanged +
   working until then (`accountId = user.id`).
2. **D8(a) tail** — adopt `Faq` at agentic-dev/procurement/security + `FeatureGrid` across the remaining
   `cs-grid` sites (mechanical; the primitives exist + are proven on two pages).
3. **D6 base harvest** — spec-gated (per-package SPECs first), wave-3 lowest priority; the recon ranked lifts
   (jobs `enqueue` options · auth `RateLimiter` · kernel branded `Money`) are recorded in the SPEC §4. Not
   started (explicitly the most deferrable per the SPEC's own sequencing).
4. **D11 host/DEPLOY items** — provision extension-capable SQLite on the `gw-macos-arm64` runner, then flip
   `quality.yml`'s macOS `native-ext` leg onto the fleet; add the TF R2 remote backend (needs the R2 bucket
   first). Both are host/DEPLOY-class, not in-repo — the Pages surface the TF module manages is being retired.
5. **D12 full PR#33 review** — a fresh 254-file pass; PR#33's surface is already covered by the
   services-hardening audit (D13) + the folded Greptile per-PR reviews. Lower-value process item.

**Downstream / integration notes for the Stage-2 integration session:**

- New external deps landed on base packages (`nodemailer`, `@aws-sdk/client-kms`, `pg-boss`, `pg` + types) —
  `bun.lock` was re-resolved once here; the integration session re-resolves across all four streams.
- `packages/auth` now depends on `@caisson/tenancy-rls` (both Apache-2.0 open base — no depend-up violation).
- The three out-of-tree D5 items stay flagged, not touched: R2 `ArtifactStore` → Stream C (`audit-worm`); chat
  Slack/Telegram → Python `services/support-bot` (no `ChatPlatform` port yet); license `KmsSigner` → P7.
- Adapter build worktrees (`.claude/worktrees/wf_e0718082-094-*`) are harness cruft under the main checkout;
  their commits are already integrated into `stream/base-golive`.
