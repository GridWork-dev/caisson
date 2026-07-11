# Kickoff O — post-remediation code chunk (parallel session)

**Status: ARMED (operator split 2026-07-11, this sitting's picker).** Branch
`kickoff/o-code-chunk` · worktree `~/lab/worktrees/caisson/o-code-chunk` (created off clean
post-wave `main`, PRs #205–#207 merged + site redeployed). Runs as its own session in parallel
with nothing — main session closed out at handoff; no tree contention.

**Owns:** ADR-0323 D2 (Playwright graduation, CAISSON-93) · ADR-0324 D4 (the email wave,
CAISSON-92) · Linear CAISSON-73 · CAISSON-55 · CAISSON-63 · CAISSON-62 (all Todo, routed this
sitting).

## Scope (ordered)

1. **Playwright graduation (ADR-0323 D2, CAISSON-93) — its OWN separately-reviewed PR.** The four P1 clean
   replays from `outputs/browser-audit/2026-07-10-full-01/REPORT.md` become deterministic
   Playwright tests: homepage codecard non-zero-height · `/docs` skip-link target + single
   `<main>` landmark · marketplace compare ≥24×24 target with z-order above the stretched
   preview action · docs-search Escape returns focus to the trigger. Fixes are live on `main`
   (PR #205) — the tests pin them. Reviewer also asked for a computed-style assertion on the
   fumadocs `size-4.5` hit-area hook (its selector rides an undocumented third-party class
   token, so a fumadocs bump can silently drop the 44px zone) — include it here.
2. **Email wave (ADR-0324, CAISSON-92).** (a) reply-to code change: `reply_to: "support@caisson.sh"` on the
   three Resend call-sites (`apps/site/lib/auth-server.ts:106`,
   `services/license/src/email-notify.ts:42`,
   `apps/admin/.../catalog/send-test-email/route.ts:31`); (b) support@ copy pass — every
   user-facing `admin@caisson.sh` mailto EXCEPT the legal pages (privacy/terms/EULA/license)
   flips to `support@caisson.sh` (procurement refunds, partners/affiliates applications,
   ask-AI panel, any docs/footer contact); `security@` untouched; (c) env flip
   `RESEND_FROM="Caisson <no-reply@caisson.sh>"` on the three Railway services
   (caisson-site · caisson-license · caisson-admin) + `~/.gridwork/caisson.env` + the
   1Password vault value (named-approval or operator if the classifier blocks); (d) delete the
   stale disabled Cloudflare Email Routing catch-all rule + destination address on the
   caisson.sh zone (ADR-0324 D3 — classifier deferred it to this kickoff); (e) docs truth pass
   (`docs/state/production-readiness.md` §email + public-surface map if it lists contacts).
3. **CAISSON-73** — `/login` production hydration mismatch (React #418), caught by
   `apps/site/live/prod-routes.live.test.ts`; fix so the all-seams live run goes green.
4. **CAISSON-55** — registry Worker app-level rate limit on anon catalog + tarball routes
   (ADR-0112 token-bucket shape adapted to Workers, DO- or KV-backed).
5. **CAISSON-63** — registry free-floor audit: Worker anon response vs the ADR-0136 open set
   for the 2026-07-06 carve SKUs + ui-pro; add the regression test pinning the anon floor list.
6. **CAISSON-62** — GH Actions SHA-pin sweep: pin the remaining mutable-tag third-party
   actions (checkout@v5, cache@v4, upload-artifact@v4, setup-java@v4) by SHA across the 8
   workflows.

## Binding rules

- Playwright graduation is its own PR (ADR-0323 D2 wording: "separately authored and
  reviewed"). Other items group into sensible atomic PRs; each gets the in-session SHIP-audit
  lane before opening (gw-code-reviewer opus; fable only if a money/license seam is touched —
  the Worker entitlement code in items 4/5 qualifies).
- Move the Linear issue (In Progress → In Review → Done) as each item ships; branch names from
  the issue's `gitBranchName` where one exists.
- **DEPLOY stays operator-gated:** after the email-wave merge, ask once for the three-service
  redeploy; after Worker changes, `wrangler deploy` is part of the same gate. No publish-gate
  flips (registry npm/mirror stay dormant).
- ADRs are append-only; anything here that mutates a locked decision needs a new ADR, not an
  edit. Ceiling at handoff: **ADR-0324**.
- Operator acts riding alongside (NOT this kickoff's scope, listed for visibility): Proton
  send-as alias for support@ (ADR-0324 D4) · Ring-2/3 probe profiles (ADR-0323 D3) · Railway
  Postgres backup/PITR (CAISSON-52, Urgent) · Grafana alerting floor (CAISSON-53).

## Verification floor

`bun run check` + standards-gate + the path-scoped suites green per PR; the live route sweep
(`cd apps/site && bun run test:live`, CF service-token env) green after item 3; one
`bun run sot` at kickoff close. Evidence trail into `docs/state/outstanding-work.md` §4 rows +
the deploy log if the operator approves the redeploys.
