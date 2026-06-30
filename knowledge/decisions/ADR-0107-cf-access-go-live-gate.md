# ADR-0107 — CF Access go-live gate: keep gated until checkout works; flip = the deliberate launch act

Status: accepted · 2026-06-29 (P6 operator-gates session) · **formalizes the prior board decision**
(`docs/state/decisions-and-forks.md`, readiness §2/§4 "keep gated") into an append-only ADR · relates
ADR-0082 (go-live posture), ADR-0106 (pricing lock), ADR-0089 (X-2 billing), ADR-0009/0105 (support-bot),
ADR-0096 (docs-service). Append-only; supersede with a later ADR, never edit.

## Context

`infra/terraform/access.tf` is **APPLIED** (live in Terraform state): `caisson.sh` + `www.caisson.sh`
sit behind a Cloudflare Zero-Trust **self-hosted Access application** (`site_gate`, 24h session,
`app_launcher_visible = false`) whose sole allow-policy admits anyone with a verified `@gridwork.dev`
email via the built-in one-time-PIN IdP. The site reads **live self-serve** (ADR-0082), but real Stripe
checkout, the license issuer keypair, and the EULA are unbuilt fast-follows. The board already
**decided** keep-gated; this ADR records it as a decision of record with the explicit flip trigger +
ordered go-live checklist. The flip is **operator-owned, DEPLOY-class** — never part of any autonomous
cycle.

## Decision

1. **Keep the gate applied** until the commerce spine works end-to-end. The flip is a deliberate,
   operator-executed DEPLOY-class act — the launch act of record.

2. **Flip trigger — ALL must hold:**
   - **Stripe live checkout works** — account + `STRIPE_SECRET_KEY` + per-endpoint
     `STRIPE_WEBHOOK_SECRET` + `invoice.paid` webhook smoke green (B1).
   - **Compliance is buyable end-to-end:** 402 → checkout → `invoice.paid` → credit/entitlement grant →
     license issued → offline verify.
   - **License issuer keypair provisioned** + the production verify-key baked into
     `@caisson/license-verify` (replacing the KAT test-vector at `packages/license-verify/src/verify.ts`)
     — B4 + code track I1.
   - **Final pricing baked into `@caisson/pricebook`** (ADR-0106) **before** the flip — a post-flip
     change re-triggers grandfathering.
   - **EULA** (`LicenseRef-Caisson-Commercial`) drafted + linked (ADR-0082 fast-follow).

3. **Flip mechanics (the launch act).** Either delete `infra/terraform/access.tf` + `terraform apply`,
   **or** flip the `cloudflare_zero_trust_access_policy.site_gate` `decision` from `allow` to `bypass`
   with an `everyone` include (then `apply`). Single-operator manual `apply` is acceptable today (no
   remote-state lock needed). **If** a second operator or CI ever runs `apply`, move Terraform state to
   a locked remote backend (R2) **first** (concurrent unlocked applies corrupt state).

4. **Seal the bypass.** The unlisted `caisson-site.pages.dev` origin cannot be gated by `access.tf`
   (self-hosted Access only covers zone-owned hostnames — CF API error 12130). Before/at flip, decide
   pages.dev sealing: enable the **Cloudflare Pages project's native Access integration** in the
   Zero-Trust dashboard (separate from `access.tf`) so the origin isn't a post-flip bypass of the
   canonical gated `caisson.sh`.

## Go-live checklist (ordered — the launch runbook)

1. Provision Stripe account + `STRIPE_SECRET_KEY` + per-endpoint `STRIPE_WEBHOOK_SECRET` (currently
   absent everywhere) + Stripe Tax on; operator = Merchant-of-Record.
2. Wire + verify the live checkout→webhook→grant path against real Stripe (the offline annual
   cycle→grant mapper in `services/license` is built + PGlite-tested, ADR-0089).
3. Build the license issuer sign path (code track I1), generate the production Ed25519 keypair offline
   (B4), and re-bake the new SPKI public key into `verify.ts` (replace the KAT vector); private signing
   key held only in the platform secret store.
4. Prove Compliance buyable end-to-end: 402 → checkout → grant → entitlement → license issued →
   offline verify.
5. Bake the ADR-0106 final pricing numbers + grandfathering into `@caisson/pricebook` **before** flip.
6. Resolve any remaining annual-cadence pricebook wiring (Compliance-Updates $1,499/yr · Developer
   $499/yr · Enterprise "Contact us" surface, ADR-0095 W4).
7. Draft + link the EULA (`LicenseRef-Caisson-Commercial`) — ADR-0082 fast-follow.
8. (If a second operator or CI will run `apply`) move Terraform state to a locked remote backend (R2).
9. Decide + execute pages.dev sealing via the Pages project's native Access integration (Zero-Trust
   dashboard).
10. **Execute the DEPLOY-class flip** (operator-gated): `rm access.tf` + `terraform apply` (or
    policy→bypass/everyone), then verify `caisson.sh` + `www` serve publicly and pages.dev is sealed.

## Rejected

- **Partial open** (marketing public, commerce gated) — ADR-0082 committed the copy to read live
  self-serve; public purchase CTAs that can't transact create a "looks live, can't buy" gap.
- **Open now fully** (manual fulfillment while Stripe finishes) — the license issuer is unbuilt → no
  automated license issuance; high ops risk; contradicts the "Compliance buyable" precondition.

## Binding

The gate stays applied until the flip trigger holds in full; the flip is a deliberate operator
DEPLOY act (never autonomous); pages.dev is sealed via Pages-native Access at/before flip. This is the
launch act of record.

Evidence: `infra/terraform/access.tf` (lines 1–53) + `infra/terraform/README`; `docs/state/decisions-and-forks.md`
board (CF-Access row) + `readiness-and-backlog.md` §2/§4; ADR-0082; the 2026-06-29 P6 operator picker.
