# Kickoff G — Buyer-surface remediation: visual P0s · dashboard/auth · media · docs · emails

**Authored:** 2026-07-09 (post-repo-sweep triage picker: split **by surface**; sibling session owns
platform/commerce hardening). **Sibling:** `KICKOFF-H-platform-hardening.md` — G owns `apps/site`
(marketing + docs + dashboard), `packages/{brand,ui,email}` presentation, and docs-site content; H
never edits those trees. G does NOT touch the registry Worker, license service, admin app, or CI.
**Branch:** `feat/surface-remediation` off `main` (worktree). **Shape:** each wave runs
investigate/research FIRST, then presents deep forks via AskUserQuestion (rounds of ≤4, never
auto-decide), then builds after locks. Waves are tree-disjoint and fan out as parallel worktree
workflows inside the session. **Routing:** recon → haiku · bounded builds → sonnet ·
synthesis/picker prep/review → opus main thread · every dispatch sets `model` (no money/license
seams in this session — no fable lane). **Design lane (binding for W1/W3/W4):** design/frontend
work routes through `gw-frontend-designer` per `identity/design-doctrine.md` — **refero MCP
research first** (real product screens for footer/compare/matrix/popout/docs patterns), then the
**`impeccable` skill** for the craft pass inside the brand floor; never restyle from intuition.
**Retrieval (binding):** library/vendor questions — fumadocs/Shiki theming config, the
email-client dark-mode support matrix, Playwright behavior — go to **exa-code
(`get_code_context_exa`) first**, web facts to exa search, per `identity/retrieval.md`; never
answer from training memory. **Review gate:** in-session SHIP audit lane per wave
(gw-code-reviewer opus on the wave diff; gw-frontend-designer pass on W1/W3/W4 visual changes),
findings fixed in-branch before each PR opens.

**Sources triaged into this kickoff:** the 2026-07-09 visual audit
(`outputs/reviews/visual-audit-2026-07-09.md` — 99 findings, 9 P0 / 56 P1 / 25 P2 / 9 P3), Linear
CAISSON-50/60/61/64–70, `docs/state/outstanding-work.md` §1–§3 (incl. the parked "Real media on
module depth pages" row PULLED here by the H re-triage), and the 2026-07-09 defect→file recon
(every row below cites its owning source — no re-discovery needed in-session).

## Session discipline (binding — applies to every wave)

- **Every in-session finding gets remediated in-session.** Review-gate findings, audit findings,
  CI failures, and harness regressions are fixed in the wave that surfaced them; genuinely
  lower-priority findings may be batched into W5 or an end-of-session cleanup pass — **never
  deferred out of the session, never parked without an operator lock.** "Filed a Linear issue"
  is not remediation for anything surfaced here.
- **CI failures are root-caused and fixed, never bypassed** — no `continue-on-error`, no test
  deletion, no gate skip. The known CI gotcha classes live in project memory; check there before
  re-deriving.
- **Merge-when-green is standing approval:** once a wave's gates and review pass, open the PR and
  merge — no per-wave ask.
- **Forks:** AskUserQuestion only for REAL operator forks (price/policy/scope/irreversible acts,
  or a finding whose fix needs a decision the operator owns — e.g. the ai-keys live-migration
  apply, the deploy act). Surface the fork and hold only that item while other work proceeds;
  never auto-decide, never work around it, and never use "deferred" as the workaround.

## W1 — Marketing-site layout + copy (P0s CAISSON-65/66/67; tags: `ui`, `frontend`)

1. **Research (mostly done — recon citations):** footer overlap = `packages/brand/src/brand.css:4`
   (`.cs-wordmark` no `flex-wrap`) + `apps/site/app/global.css:243` (`.cs-footer-cols` has no
   sub-480px breakpoint); compare collisions = `packages/ui/src/components/status-chip.css`
   (`white-space: nowrap`, no max-width) + `sku-matrix.css` (`table-layout: auto`, text rows bleed
   across cells — reproduced: "Next.js + PostgresNext.js / React Router" glued); home mobile =
   `apps/site/components/isolation-diagrams.module.css:35` (`.isoRow` lacks the 1-column breakpoint
   its sibling `.flow` has) + the same `.cs-matrix` overflow on the 6-bundle table. Sticky cart bar
   (`stack-builder.tsx` + `marketplace.module.css:342`) could NOT be confirmed statically —
   live-viewport check first, fix only if real.
2. **Deep forks:** footer mobile shape (wrap the wordmark vs single-column stack below 480px) ·
   matrix fix (fixed table-layout + min-widths vs per-column wrap) · whether the 6-bundle matrix
   gets a mobile card-collapse or keeps scroll + a stronger cue.
3. **Build:**
   - **Footer overlap** (CAISSON-65): `.cs-wordmark` wrap + footer breakpoint; also fix the naming
     drift — `site-footer.tsx` maps `r.label`, should prefer `navLabel` ("Local-first AI" vs terse
     siblings, `apps/site/lib/routes.ts:48`).
   - **Compare template** (CAISSON-66): chip wrap/ellipsis + matrix column widths; one fix covers
     all 5 `/compare/*` pages.
   - **Home mobile** (CAISSON-67): isoRow breakpoint, matrix overflow treatment, cart-bar
     live-check.
   - **Copy/consistency batch (P2/P3, marketing tree):** cart empty-state "edition" strings
     (`cart-drawer.tsx:66`, `cart-checkout-panel.tsx:82`) · `EditionCard`/`EDITION_ROUTES`
     identifier rename · marketplace badge truncation ("AI-PRODUCTION" ellipsis —
     `marketplace.module.css:69`, widen or short-form) · glossary duplicate-H1 · legal
     desktop-width · build-vs-buy column balance · forgot-password Discord link · the duplicate
     visible+hidden h1 a11y finding.

## W2 — Dashboard + auth (P0 CAISSON-64, P1 CAISSON-69; tags: `frontend`, `data-migration`)

1. **Research (done — recon):** `/dashboard/ai-keys` crashes for EVERY account because
   `apps/site/lib/deploy-migrate.ts:34` lists only `0011/0012` while `apps/site/lib/db.ts:132`
   (the dev PGlite double) also runs `0020_tenant_ai_credential` / `0021_byok_key_meta` /
   `0022_compliance_attestation` — **`byok_key_meta` was never created in production**;
   `/dashboard/compliance` only survives because its entitlement gate short-circuits first.
   Header clipping = `packages/ui/src/components/app-shell.css:96` (topbar slot has no mobile
   rule; ancestor `overflow: hidden` genuinely clips Sign-out). Login error = real state but
   styled `cs-muted` identical to success (`login-form.tsx:325`), and the harness shot shows NO
   text at all — timing needs a live check.
2. **Deep forks:** migration-list unification shape (single shared list vs deploy-list superset
   assertion test) · topbar mobile treatment (truncate account text vs collapse Sign-out into the
   drawer) · whether ai-keys ALSO gains an entitlement gate like compliance (defense in depth).
3. **Build:**
   - **ai-keys P0** (CAISSON-64): add the three migrations to the deploy list, unify the two
     duplicated lists into one source of truth, add the drift test. Additive CREATE TABLEs only —
     but live-migration apply is an **operator checkpoint** (the 0006–0009 bless pattern).
   - **Dashboard chrome** (CAISSON-69): topbar mobile rule + login error styled
     `var(--cs-danger)` (mirror `plan-purchase-row.tsx`'s existing error treatment) + live
     re-check of the invalid-submit render timing.
   - **Plan-page strings:** "Ai-Production" — replace CSS `text-transform: capitalize` over the
     raw tag with the canonical label lookup from `pricing.ts` (`plan-purchase-row.tsx:60`);
     "Editions &amp; bundle" heading → bundle vocabulary (`plan/page.tsx:126`).
   - **EULA credit clause** (CAISSON-61): the clause build (site legal tree); the
     continuity-polish wording stays flagged for operator approval before merge.
   - **CAISSON-50 verify:** post-CF-beacon hydration re-check on the dashboard (the tf apply
     itself stays operator-gated; this is the site-side proof).

## W3 — Marketplace media + popout (P1 CAISSON-68 + the pulled-in real-media row; tags: `ui`)

1. **Research (done — recon):** popout content loss = the code-artifact slide renders FIRST and
   unclamped (`media-manifest.ts:186` pushes it, `media-carousel.tsx:30` renders full
   `CodeBlock`, no `max-height`), consuming the whole `min(90vh, 52rem)` dialog and pushing
   blurb/badges below the fold (ai-meter confirmed; field-crypto fits) — plus the same code
   renders TWICE (carousel slide + `preview-dialog.tsx:132`). Placeholder media = **data gap**:
   8 of 11 depth-page modules (`alerting`, `ai-meter`, `ai-evals`, `guardrails`,
   `prompt-registry`, `local-store`, `agent-kernel`, `agent-runner`) have no `DIAGRAM_TARGETS`
   entry, and the depth page passes `omitCodeArtifact: true` (ADR-0290 WR-03), leaving zero
   slides → the generic brand-icon placeholder ships on prod.
2. **Deep forks:** media authoring lane for the 8 modules (authored mechanism diagrams vs
   Remotion clips per ADR-0263 vs live-component slides where feasible — cost/quality trade
   per module) · popout fix (cap + scroll the code slide vs reorder badges/blurb first) ·
   whether the duplicate code render is dropped from the carousel or the body.
3. **Build:** popout height/order fix + dedupe · author the 8 missing media entries per the
   fork lock (this EXECUTES the parked F2 row — the ADR-0285/0290 media standard already
   defines the slide shapes) · re-shoot the popout + module-depth harness categories as proof.

## W4 — Docs-site + email dark-mode (P1 CAISSON-70, CAISSON-60; picker: email dark-mode BUILDS here)

1. **Research (done — recon, for Shiki):** docs dark code blocks are LIGHT-theme colors on a dark
   page because fumadocs-ui's compiled Shiki CSS gates dark tokens behind a literal `.dark` class
   while this site only sets `data-theme="dark"` (`theme-toggle.tsx:60` — in `packages/ui`, a
   different file from W1's CSS touches; note for worktree merge order). Cheapest fix:
   `classList.toggle("dark", ...)` alongside the dataset write. CAISSON-60: ~14 commercial-module
   docs pages are stubs vs their marketing depth pages — content source = the per-package READMEs +
   `MODULE_PAGES` records. Email dark-mode: `packages/email` templates currently ship light-only;
   research = dark-scheme support matrix across major clients (`prefers-color-scheme` in Apple
   Mail/iOS, partial Gmail) before committing to a technique.
2. **Deep forks:** docs depth-page scope (all ~14 vs the 8 sellable-module priority set) · email
   dark-mode technique (meta color-scheme + media-query CSS vs dark-safe single palette) · whether
   the sidebar/pagination P3s ride this wave or stay P3-parked.
3. **Build:** the `.dark` class toggle + verify every docs code block in both modes · the docs
   depth pages per scope lock · email dark-mode per technique lock + re-render the email harness
   category · docs sidebar/pagination P3s if pulled in.

## W5 — Proof + release (runs after W1–W4 merge)

- **Full `--prod` harness re-run** (all 12 categories, 640-shot shape): every P0 category clean,
  finding count compared against the 2026-07-09 baseline; the delta IS the session's verify
  artifact (`outputs/reviews/`).
- **Site deploy** (operator-gated DEPLOY act): Railway `caisson-site` redeploy off merged main +
  the ai-keys migration apply checkpoint; live spot-check of `/dashboard/ai-keys` with the probe
  account.
- **Changesets** for every touched package (`brand`, `ui`, `email` at minimum — the changeset
  gate requires them); tracker + Linear close-out (CAISSON-64..70 → Done or residual-commented).
- The 429s-on-19-routes finding stays with **H W2** (root-cause + fix live there); G's harness
  re-run supplies the fresh console evidence if it still fires.

## Explicitly OUT of this session

Everything platform-side (H): strix round-2, Worker rate limit, ops floor, commerce/license
seams, eval widening, the changeset version cut. Operator-owed runbook items (Paddle prod
catalog, CF-Access flip, oss flip, Plausible goals) stay in `outstanding-work.md` §1. The
three.js signature slot stays queued for the design-track kickoff, not this one.

## Exit criteria

- All 5 visual P0 root causes fixed and re-shot clean (ai-keys renders live for the probe
  account; footer/compare/home mobile clean at 390px; popout shows badges+blurb).
- The 8 module depth pages show real media; placeholder pipeline can no longer ship a bare icon
  silently (assert or visual-harness catch).
- Docs code blocks legible in dark mode; commercial docs depth pages shipped per scope lock.
- Emails render correctly in dark mode per the locked technique.
- The copy batch merged: zero "edition" strings in cart/plan surfaces, canonical AI-Production
  casing, footer naming consistent.
- Harness re-run delta published; site deployed; changesets landed; Linear rows closed.
