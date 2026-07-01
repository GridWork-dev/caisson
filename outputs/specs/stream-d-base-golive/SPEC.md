# SPEC — Stream D · Base substrate drivers + go-live surface + CI

**Status:** spec-COMMITTED · 2026-06-30 (Stage-2 Stream D) · **all 4 forks locked (D4=org · D7=blank ·
D8=(a) · license-KMS=exclude); autonomous EXECUTE underway.** ADRs 0170–0176 recorded. **Branch:**
`stream/base-golive` (off clean `main`). **Reserved ADRs:**
**0170–0179** (adapter/driver + fork ADRs draw here; the `adapter-expansion.md` "0119+" numbers are advisory
placeholders — real numbers taken from this range at lock, per the kickoff).
**Kickoff:** `docs/state/stage2-kickoff-triage.md` §"Stream D" (tasks D1–D13). **Recon:** workflow
`wf_fa542371-7e6` (12 read-only agents). **Local build only — nothing deploys from this stream.**

**Tags:** `security` `auth` `secrets` `external-system` `billing` `infra` `ui` `frontend` `seo` `copy`
(+ `data-migration` **iff** the D4 fork locks to org — new `account_member` table).

**Owns (nothing else touches):** `packages/{kernel,auth,tenancy-rls,billing,credits,jobs,email,field-crypto,migrate,cli,pricebook,registry-schema,ui}` + `apps/site` + `.github` + `infra` + test-hygiene.

**Locked & not relitigated:** ADR-0003 (composable, no depend-up) · ADR-0015 (better-auth, `withTenant` sole
RLS entry) · ADR-0017/0108/0116 (BillingProvider port; Paddle platform-MoR / Stripe buyer) · ADR-0018/0085
(jobs/email ports, Resend) · ADR-0043/0045/0046/0055 (field-crypto envelope + KMS seam) · ADR-0102/0103/0104
(signature = CSS/SVG four-beat locked, sketches deferred-for-rework, three.js parked, **blank slot reserved**)
· ADR-0129/0130/0137 (pricing + storefront-as-if-built + reprice) · ADR-0131 (cart→multi-item Paddle) ·
ADR-0132 (buyer sign-in) · ADR-0079/0080 (SEO + copy laws) · ADR-0136 (registry gating + tooling-open).

## Goal

Finish the **base-substrate driver surface** (add dormant, env-gated drivers behind already-locked ports so a
buyer can run Caisson in _their_ environment) and the **customer-facing go-live polish** (module price-ids,
EULA, Turnstile client, CI hygiene), while resolving the three product/design forks the kickoff flagged.
Every driver is inert until the operator supplies creds — merging a driver never changes runtime behavior.
This SPEC is the PLAN seed for the whole stream.

## 0. Scope reality check (read this first — Stream D is smaller than 13 tasks look)

Recon found **much of Stream D is already done or trivial.** The real _build_ is §1 adapters + §4 harvest +
whichever forks lock to "build". Honest per-task status on disk today:

| Task                           | Real state on disk                                                                                                                   | Actual work                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| **D1** Paddle module price-ids | 5 edition/bundle sandbox ids **already wired**; 14 module ids are `PLACEHOLDER` in **two non-matching naming schemes** → fail-closed | ~40-line data fill + collapse to one canonical `MODULE_PRICE_IDS` map + flip 2 tests. Real ids = operator/DEPLOY |
| **D2** EULA + `/legal/eula`    | route family exists; **no EULA text anywhere**; license/terms pages forward-reference it                                             | draft 1 TSX page (reuse license.tsx pattern) + 1 route row + flip 2 forward-refs. Size 1                         |
| **D3** Storefront copy         | pricing/editions/cart/module-grid **already** ADR-0129/0130/0137-clean; zero waitlist/hedge/stale-price hits                         | **shrinks to** a targeted ADR-0080 §6 audit + mark superseded 0080 clauses. NOT a rewrite                        |
| **D4** Buyer account           | strictly 1-user=1-account; everything downstream keys on **opaque** `account_id`                                                     | **FORK** — personal (delete a comment) vs org (1 new table + session-resolution)                                 |
| **D5** Adapters                | 6 in-tree port-families ready; 3 out-of-tree (see §1 flags)                                                                          | the stream's main build — 6 dormant driver-sets + ADRs                                                           |
| **D6** Harvest lifts           | field-crypto + billing **already ahead** of Wardfile; jobs/auth/kernel have real gaps                                                | 3 lifts, spec-gated per-package, wave-3 lowest priority                                                          |
| **D7** Signature slot          | `home-hero-motion.tsx` deleted; **blank slot reserved**; three.js parked by ADR-0104                                                 | **FORK** — fill CSS/SVG vs leave blank vs three.js spike                                                         |
| **D8** SEO scaffold            | full scaffold already live; ~6 hand-crafted already-SEO-complete pages; FAQ render inconsistent                                      | **FORK** — (a) targeted / (b) union renderer / (c) new-pages-only                                                |
| **D9** Turnstile/consent       | server verify **already built + fail-closed**; no client widget; consent optional (closed LOW finding)                               | wire client half only (~20 lines + 1 env var). Skip consent unless overridden                                    |
| **D10** Greptile P2 #1–7       | **all 7 already fixed/cleared by PR#26**; 2 cli-meter bugs fixed (temp-dir + `bundleRoot`)                                           | verify + reconcile the backlog doc. No code                                                                      |
| **D11** CI hygiene             | registry-index **already required** (live-API confirmed); macOS leg needs host brew; TF backend low-pri                              | 1-line YAML flip (after host provision) + optional TF backend                                                    |
| **D12** PR#33 review           | 254 files / 110 pkg edits merged at `747ea25`                                                                                        | fresh code-review pass (process)                                                                                 |
| **D13** Services-hardening     | 7-item punch-list **all OPEN** (3 block go-live)                                                                                     | reconcile doc; **note: #1/#2/#3 are DEPLOY-composition, not Stream D**                                           |

## 1. D5 — base-substrate adapters (the stream's main build)

**Doctrine (from `docs/state/adapter-expansion.md`, binding):** new driver = new sibling file beside the
existing driver in the owning package; selected by DI or an **env-gated factory** (dormant when its env is
unset — identical to Resend/Paddle/OTLP today; the package never reads `process.env` for the secret directly).
`fetchWithTimeout` on every outbound call; `crypto.timingSafeEqual` on any secret/HMAC compare; Zod `.strict()`
on new config; **fail-closed** on missing config. **Round-trip test every driver** + a **shared
port-conformance loop** (~15 lines: iterate all drivers, assert each satisfies the one-method port) — this
harness does **not** exist yet, build it once per port-family. **One ADR per port-family.**

**Six clean IN-TREE port-families → 6 ADRs (0170–0175):**

| #   | Port-family    | Port (verbatim)                                                                          | Drivers today                             | Add                                            | ADR      | Package              |
| --- | -------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------- | -------- | -------------------- |
| 1   | **Email**      | `Emailer.send(msg): Promise<void>` (`email.ts:8-17`)                                     | Resend, Capture                           | SMTP-generic · AWS SES · Postmark              | **0170** | `email`              |
| 2   | **KMS**        | `KmsClient{generateDataKey, decryptDataKey, scheduleKeyDeletion}` (`kms.ts:30-43`)       | Local (tested), `awsKmsClient` **throws** | wire **AWS KMS** (defer GCP/Azure/Vault)       | **0171** | `field-crypto`       |
| 3   | **SSO**        | `SessionProvider.resolveSession(req): Promise<SessionContext\|null>` (`session.ts:9-19`) | better-auth only                          | **WorkOS** SAML/SCIM (sign-in scope only)      | **0172** | `auth` + `apps/site` |
| 4   | **Jobs**       | `JobQueue.enqueue(name, payload): Promise<void>` (`queue.ts:26`)                         | Trigger.dev, InMemory                     | **pg-boss** (Postgres-native, zero new infra)  | **0173** | `jobs`               |
| 5   | **Transactor** | `withTenant(db, accountId, fn)` over `Transactor` (`rls.ts:21,31`)                       | node-postgres/Neon, PGlite, sqlite        | explicit **Supabase** (needs TCP tx — careful) | **0174** | `tenancy-rls`        |
| 6   | **Billing**    | `BillingProvider{verifyAndParse, createCheckout}` (`provider.ts:15-31`)                  | Stripe, Paddle                            | **LemonSqueezy · Polar**                       | **0175** | `billing`            |

**Per-port build notes (from recon):**

- **AWS KMS (0171):** replace the throwing `awsKmsClient(kms.ts:241)` with a real `createAwsKmsClient(config)`
  over `@aws-sdk/client-kms` (new dep on `field-crypto`), mirroring `jobs/src/trigger-driver.ts`'s
  injected-config/`ConfigError`-fail-closed shape. **Blocked-on:** a DB-backed `WrappedKeyStore` (only
  `InMemoryWrappedKeyStore` exists today, flagged "DB-backed in P2" at `kms.ts:45`, never landed) — a real KMS
  driver without persisted wrapped-DEKs is inert. Ship the store in the same ADR.
- **WorkOS SSO (0172):** a new better-auth plugin in `apps/site/lib/auth-server.ts`'s existing `plugins[]`
  array (sibling to `magicLink`). **Scope to sign-in only.** Real role/org provisioning (SCIM) is a _bigger_
  build that collides with the D4 fork (`getSession()` hardcodes `role:"owner"`, `accountId=user.id`) — do not
  fold org provisioning in here.
- **Billing driver file-split (0175):** one open naming choice — today `provider.ts` co-locates Stripe+Paddle;
  the doctrine's "new file beside the existing driver" implies `billing/src/{lemonsqueezy,polar}.ts`. **Pick
  the sibling-file split** (cleaner, matches the doctrine literally); note it in the ADR, don't silently decide.

**⚠️ Three OUT-OF-TREE items D5's kickoff line names but Stream D must NOT build (partition invariant
"tree it OWNS — nothing else touches"):**

1. **License `KmsSigner`** (`packages/license-issue` + `services/license`) — owned by **no stream** (confirmed
   against the kickoff's four tree lists); the package self-frames it as **P7** work (`signer.ts:174`,
   `"private": true`, "never published"). D5's "KMS" maps to field-crypto's `KmsClient` (in-tree), a
   different primitive (envelope-wrap) than the signer's asymmetric-Sign. **→ Excluded. Surfaced as boundary
   flag #4 for the operator.**
2. **R2 `ArtifactStore`** (`packages/audit-worm/src/store.ts`) — **Stream C's tree.** R2 is S3-compatible
   (~trivial: reuse `S3ArtifactStore` with `endpoint`+creds) but the edit lands in C. **→ Route to Stream C or
   the integration session; not built in D.**
3. **Chat Slack/Telegram** (`services/support-bot`, **Python**) — cross-language, in no stream's TS tree,
   Tier-3 lowest priority, and **no `ChatPlatform` port exists yet.** **→ Deferred; note the missing port.**

## 2. D1 — Paddle module price-ids (data fill, in-tree)

Editions/bundle already wired with real sandbox ids; ADR-0137 numbers already live in `pricing.ts`; ADR-0131
checkout already works (the §3 sequential-overlay fallback was never needed). In-repo work:

1. `apps/site/lib/catalog.ts`: add one canonical `MODULE_PRICE_IDS: Record<string,string>` (14 entries keyed to
   `pricing.ts` `MODULE_PRICES` slugs), replace the `modulePlaceholderId()` call in `MODULE_CATALOG.map()`,
   delete `modulePlaceholderId`. **This collapses the two divergent placeholder schemes to one source now**,
   even before real ids arrive (parameterized so 14 real `pri_…` drop in with no code change).
2. `packages/pricebook/src/purchases.ts`: swap the 14 `price_<slug>_module_PLACEHOLDER` keys for the same map's
   values (keep `purchaseTag`/`credits`/`entitlements`; bump `PURCHASE_BOOK_VERSION`).
3. Flip the 2 tests that currently _assert_ placeholder state (`catalog.test.ts:67`, `purchases.test.ts:52-95`)
   → assert `startsWith("pri_")`. **Real sandbox ids = operator/DEPLOY** (`p6-deploy-runbook.md` §2-4 handoff).

## 3. D2 EULA + D3 storefront copy (comms)

- **D2:** draft the full EULA as `apps/site/app/legal/eula/page.tsx`, reusing the license/privacy/terms.tsx
  convention verbatim (`buildMetadata`, shared `prose` block, Section/Card, the "Pending final legal review"
  draft banner, GridWork Digital LLC / Fulton County GA / legal@gridwork.dev boilerplate). Sections: parties,
  license grant, entitlement/Ed25519-verification, fees, term/termination, warranty disclaimer, liability cap,
  indemnification, IP, governing law, entire agreement, contact. Then: add the `/legal/eula` row to
  `MARKETING_ROUTES` (auto-wires sitemap + footer), update `routes.test.ts`, flip the 2 forward-refs in
  license.tsx:150 / terms.tsx:67 to live links. **Precedent:** the 3 existing legal pages already ship
  Claude-drafted "pending review" text — follow it; don't block on counsel. (Flag as an assumption for lock.)
- **D3:** **not a rewrite** — the storefront is already clean. Scope to (1) a Haiku-grade ADR-0080 §6 sweep
  (owned-vocabulary glossary, answer-first FAQ, 2-tier headers, per-edition OG depth) on second-order surfaces
  not yet verified; (2) explicitly mark ADR-0080's **superseded** clauses (§5 waitlist-CTA, indicative-pricing,
  Local-first-AGPL) so the sweep can't regress fixed copy; (3) fold the 2 EULA forward-refs into D2.

## 4. D6 — base harvest lifts (spec-gated, wave-3 lowest priority)

Recon: **drop field-crypto + billing** (already at/past Wardfile — per-tenant crypto-shred vs Wardfile's single
DEK; ADR-0113 clawback vs Wardfile's sync-only). Concentrate on **3 real gaps**, each needing its own
per-package SPEC before code (CLAUDE.md cadence); pattern-reference only (Wardfile is public, but shapes not
copies):

1. **jobs** (smallest): add optional `{idempotencyKey?, delaySeconds?}` 3rd arg to `enqueue`, threaded to
   Trigger.dev's native `idempotencyKey`/`delay`, no-op for InMemory. ~40-60 LOC, additive.
2. **auth**: new generic `RateLimiter` port + in-memory sliding-window driver + `resolveClientIp(req,
trustedHeader)` that defaults to NOT trusting `x-forwarded-for` (stay provider-agnostic; wires the already-dead
   `kernel/errors.ts` `RateLimitError`). ~80-100 LOC.
3. **kernel** (most speculative): a `Brand<number,B>`-based `Money<Unit>` + `RoundingRecord` provenance helper
   _alongside_ `credit-conversion.ts` — opt-in export, do **not** touch pricebook/ai-meter consumers
   (depend-up violation). ~60-80 LOC. **YAGNI-flag: only if the operator wants audit-grade rounding provenance.**

## 5. Small-ops cluster (D9 · D11 · D10 · D12 · D13)

- **D9 Turnstile:** server verify is done + fail-closed. Wire the client half only: add
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to `railway.toml`; in `waitlist-form.tsx` load the Turnstile script via
  `next/script`, render the widget, feed its token into the existing `turnstileToken` fetch field. ~20 lines, 0
  deps (plain script tag). **Skip the consent checkbox** — optional per a closed LOW security finding
  (passive notice accepted); build only if operator/legal overrides.
- **D11 CI:** (1) macOS `native-ext` leg — one-time host provision of extension-capable SQLite on the
  `gw-macos-arm64` runner, then flip `quality.yml:130` `runs-on: macos-latest` → `[self-hosted, gw-macos-arm64]`
  (1-line, saves ~10× hosted-mac minutes). (2) TF remote backend — add `backend "s3"` (R2) to `versions.tf`;
  **recommend defer** (single-operator + the Pages surface it manages is being retired for Railway). (3)
  registry-index required-check — **already required** (live-API confirmed); no work.
- **D10 Greptile P2:** all 7 already fixed/cleared by PR#26 (2 real cli-meter bugs fixed via temp-dir +
  `bundleRoot` injection). Verify current code + reconcile the backlog doc status. No code.
- **D12:** fresh `gw-code-reviewer` pass on the PR#33 merge surface (254 files; packages/apps/services/CI). Process.
- **D13:** reconcile `services-hardening-audit.md` — but note **all 7 are OPEN**, and **#1/#2/#3 (docs
  rate-limit · MCP-limit wiring · Paddle-webhook binding) are DEPLOY-composition work, not Stream D's tree**
  (`services/*`). D13 here = doc reconcile + correctly routing #1-3 to the deploy session.

## 6. FORKS — LOCKED 2026-06-30 (operator): D4=**org** · D7=**leave blank** · D8=**(a)** · license-KMS=**exclude**

### Fork D4 — buyer account: personal vs org

- **Today:** strictly 1-user=1-account; `accountId = user.id`, `role:"owner"` hardcoded (`auth.ts:37`).
  `withTenant`, RLS, `entitlement_grant`, `license_grant`, both billing mappers **all key on an opaque
  `account_id` string** — the model is _already org-shaped below the session layer_; only identity→account
  resolution is 1:1.
- **Personal (rec, low-conf):** lock as-is; delete the "until org provisioning lands" comment + reconcile
  build-state doc. **Zero code below the session layer.** Ships today.
- **Org:** add **one** `account_member(account_id, user_id, role)` table + change `getSession()` to resolve an
  active account + a minimal invite/switch UI + wire the already-declared `role:"seat"` into ≥1 real authz gate
  - resolve checkout `account_id` to the chosen account. Adds tag `data-migration`. Everything else unchanged.
- **The real question is product, not code:** does Caisson sell to **teams** at launch? If self-serve dev-kit
  buyers are individuals (ADR-0080 ICP), **personal** is right and org is a clean fast-follow (no rework — the
  opaque `account_id` was built for exactly this). **Confidence: medium** the answer is personal-now.

### Fork D7 — signature slot: CSS/SVG four-beat vs three.js vs leave-blank

- **Today:** `home-hero-motion.tsx` deleted; a literal **reserved blank slot** at `(marketing)/page.tsx:135`.
  ADR-0102 locked CSS/SVG four-beat; ADR-0103 deferred the sketches _for rework_; ADR-0104 parked three.js as a
  _future studio-candidate_ fork. Two of four beats (chain, hold) already exist as **unlinked tokenized-SVG
  studio sketches**; 'sign' never built; 'deny' shipped as the static Terminal.
- **Fill CSS/SVG (rec, high-conf):** port the 2 studio sketches into the slot + build 'sign' + re-arm
  `lighthouse.yml` (the only CWV guard). Smaller than even researching three.js; 0 new deps; inside ADR-0102.
- **three.js spike:** whole separate design cycle (live studio candidates + fresh operator pick per ADR-0104) +
  new heavy dep (`three`/`@react-three/fiber`/drei) + CWV/≤10%-accent risk. Your 2026-06-29 steer was "spike
  three.js in future" — **that "future" is arguably not this stream.**
- **Leave blank:** ship Stream D with the reserved slot still empty (honest, ADR-0104-compliant); signature is
  its own later design initiative. **Confidence: high** that three.js does _not_ belong inside Stream D; the
  pick is CSS/SVG-now vs blank-now.

### Fork D8 — SEO scaffold: (a) targeted / (b) union renderer / (c) new-pages-only

- **Today:** full SEO scaffold already live (`buildMetadata`, root @graph, per-page JSON-LD, one
  `MARKETING_ROUTES` SOT). ~6 hand-crafted, **already-SEO-complete** pages; **no two share a section sequence**;
  2-4 irreducible custom Terminal/CodeBlock artifacts per page; FAQ render **inconsistent** (Card-grid vs
  bare-div); zero native `<details>`; `cs-grid` + inline-style duplicated 16×; 306 inline `style={{`.
- **(a) targeted wins (rec, high-conf):** one `<Faq>` (native `<details>`, fixes the inconsistency + free a11y,
  5 call sites) + one `<FeatureGrid cols>` (collapses the 16 duplicated grids, kills most inline-styles). Low
  risk, real cleanup.
- **(b) union `<PageSections>` renderer + per-page data files:** the kickoff's rec — but recon (twice) says
  **no repetition to amortize** (6 pages, no shared sequence, custom artifacts need a JSX escape-hatch on nearly
  every page) → a config system for a value that barely repeats. **YAGNI.**
- **(c) union for NEW pages only:** defer the whole thing; adopt a union iff an N≈20+ keyword-page program
  appears (Wardfile's ladder pays off at N≈50). **Confidence: high for (a); (b) is over-build at N≈6.** I
  recommend (a), diverging from the kickoff's (b) on the evidence.

### Boundary flag D5-license — build KmsSigner now, or leave to P7?

Not one of the 3 design forks, but a genuine operator call: D5's "KMS" line _could_ be read to include the
license `KmsSigner`, but that lives in `packages/license-issue`/`services/license` — **owned by no stream** and
self-framed as **P7**. Default: **exclude** (build only the in-tree field-crypto AWS KMS under ADR-0171). Flip
only if you want to claim license-issue as an explicit Stream-D exception.

## 7. ADR allocation (0170–0179, provisional pending fork locks)

| ADR  | Subject                                                                         | Firm?      |
| ---- | ------------------------------------------------------------------------------- | ---------- |
| 0170 | Email multi-driver (SMTP/SES/Postmark)                                          | firm       |
| 0171 | field-crypto AWS KMS wiring + DB WrappedKeyStore                                | firm       |
| 0172 | WorkOS SSO (sign-in scope)                                                      | firm       |
| 0173 | pg-boss JobQueue driver                                                         | firm       |
| 0174 | Supabase Transactor driver                                                      | firm       |
| 0175 | LemonSqueezy + Polar billing drivers                                            | firm       |
| 0176 | D4 resolution (only if org locked; personal = board note, no ADR)               | fork       |
| 0177 | D7 resolution (only if CSS/SVG build; blank = ADR-0104 covers it)               | fork       |
| 0178 | D8 resolution (only if a union is adopted; (a) = refactor, arguably board note) | fork       |
| 0179 | D6 harvest (jobs/auth/kernel — may split per-package or defer)                  | spec-gated |

If fork locks free numbers, D6's per-package SPECs draw from the tail; if D6 needs >1, coordinate the overflow
at integration (the range is append-only per the kickoff).

## 8. Sequencing + exit gates

**Order (independent, but this minimizes churn):** forks lock → §1 adapters (6 dormant driver-sets, the bulk)
∥ §2 D1 + §3 D2 (go-live surface) → §5 small-ops (D9/D11/D10/D12/D13) → §4 D6 (spec-gated, lowest, may slip to a
2nd session) → resolved forks. **Sized ≤2 sessions** per the kickoff.

**Exit gates:** `bun run check` (turbo `--concurrency=50%`) + `bun run gate` green · every new driver has a
round-trip + shared conformance test · every driver dormant (env-gated, runtime-inert) · no edit outside the
owned tree (the 3 out-of-tree items stay flagged, not touched) · goal-backward VERIFY vs this SPEC · SWEEP.
**Audits at SHIP** (per tags): SECURITY (adapters touch `secrets`/`auth`/`external-system`/`billing`) · UI
(`ui`/`frontend` — D3/D7/D8/D9) · INFRA (D11). No live deploy — integration session owns any combined DEPLOY.

## 9. Cross-stream / partition notes (for the integration session)

- Shared files this stream appends to (integration re-resolves once, never hand-merge): root
  `package.json`/`bun.lock`/`turbo.json` (new deps: `@aws-sdk/client-kms`, `pg-boss`, LemonSqueezy/Polar/WorkOS
  SDKs) · `registry/{ledger,index.json}` (rebuild ONCE at integration) · `decisions-and-forks.md` +
  `adr-index.md` (append-only) · `knowledge/decisions/ADR-017x-*.md` (distinct filenames, no conflict).
- The 3 out-of-tree items (R2→audit-worm/Stream C · chat→support-bot/Python · KmsSigner→license-issue/P7) are
  logged here so the integration session can route them, not lose them.
