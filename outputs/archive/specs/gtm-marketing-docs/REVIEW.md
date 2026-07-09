# REVIEW — SHIP audit (Act 7)

Four parallel audits over the `apps/site` scaffold + deploy seam (tags: ui·frontend·infra·external-system).
Each finding triaged adversarially on merit; verdicts below.

| Dimension          | Agent                 | Verdict        |
| ------------------ | --------------------- | -------------- |
| Code review        | gw-code-reviewer/opus | SHIP-CLEAN     |
| Security           | gw-security-auditor   | SECURITY-PASS  |
| Voice / brand / UI | gw-frontend-designer  | VOICE-ISSUES:2 |
| Infra / deploy     | gw-architect          | INFRA-ISSUES:6 |

No critical or high **code/security** defects. One **voice** high (duplicate footnote) and one real
**deploy-correctness** bug (functions would not deploy) — both fixed before ship.

## Fixed this act

- **[deploy, real bug]** `wrangler pages deploy apps/site/out` ran from repo root, so Cloudflare never
  found `apps/site/functions/` (CF resolves `functions/` relative to CWD, confirmed via CF docs) — the
  waitlist Pages Function + `_middleware` would have silently not deployed. Fix: deploy from
  `apps/site` (`working-directory`). Preview had masked it (it ran from `apps/site`). → `fix(ci)`
- **[voice high]** Generic-base "$199 kits" footnote was printed twice (home + `/pricing`); spec
  mandates once. Removed the home instance. → `fix(site)`
- **[infra med]** Deploy paths filter omitted `packages/ui/**` (bundled via `transpilePackages`) → added.
- **[infra/security low]** Pinned `actions/checkout`@v4 + `setup-bun`@v2 to commit SHAs; added
  `permissions: contents: read`.
- **[code low/nit]** Dropped unused `next-plausible` dep; deleted dead exports (`fmt`, `appName`);
  `dynamic = "force-static"` on the 4 text/search handlers; dropped `noValidate` on the waitlist form;
  footer year via `getFullYear()`.
- **[voice low]** Softened pre-launch "shipped MCP server" wording (no feature code yet).

## Rejected (false positives, verified)

- **Infra: `_headers` comment references `functions/_middleware.ts` "contradicting the static model."**
  False — `apps/site/functions/` is a real, deploying Pages Functions dir; "no Cloudflare-side **build**"
  ≠ "no functions." Comment is accurate.
- **Infra: terraform provider may resolve to v4.** Moot — `versions.tf:7` already pins
  `cloudflare/cloudflare ~> 5.0`.
- **Voice: `$199` is a hard price (ADR-0048 violation).** False — it is the verbatim locked
  ICP-firewall copy (specs/04 §6) referring to _competitor_ kits, not a Caisson SKU. ADR-0048 governs
  Caisson's own figures; zero Caisson prices render anywhere.
- **Code: theme-toggle one-frame aria flash.** Defensible standard SSR-safe pattern; left as-is.

## Queued (later passes / DEPLOY-time — not ship blockers)

- **[security med, DEPLOY gate]** Front `/api/waitlist` with Cloudflare Turnstile or a per-IP
  rate-limit **in the same change that wires the live `RESEND_*` key** — the endpoint is an open
  unauthenticated write (inert today: returns 202 when env absent). List-poisoning / quota-burn risk
  only once real Resend creds land.
- CSP `script-src` hash-hardening (drop `'unsafe-inline'`); first-party Plausible proxy.
- Full long-form copy pass + media/video (operator-flagged: this pass is the scaffold).
- `sr-only` clip-rect on the waitlist label; standardize `bunx wrangler@3` if drift ever appears.

## Re-gate after fixes

`bun run build` (52 static routes) · `eslint` clean · 11/11 contrast tests · `format:check` clean ·
deploy YAML valid (push:main + workflow_dispatch only, no PR trigger). Green.

**Verdict: SHIP** — open PR; operator approves merge after CI green. DEPLOY (terraform/wrangler against
prod) stays a separate operator-gated act.
