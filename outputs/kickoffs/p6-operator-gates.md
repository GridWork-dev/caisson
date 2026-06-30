# KICKOFF — P6 Operator gates (pricing lock · CF Access · creds + deploy execution)

> Run this as the **first message** of a fresh Claude session in the worktree
> `~/lab/caisson-ops` (branch `chore/p6-go-live`, off `main`). This is the **operator / DEPLOY-class**
> session — it locks the operator-owned decisions AND **executes the live deploys** (operator chose
> "also execute deploys", 2026-06-29). Disjoint tree from the code track: this session owns
> `infra/` (Terraform) + `knowledge/decisions/` (ADR-0106–0107) + `docs/state/` board + the per-service
> deploy configs (`services/*/Dockerfile`, runner manifests). **Do NOT write product feature code** —
> that is the code track (`~/lab/caisson-code`). If a deploy needs a code change, file it for that track.

---

## Mission

Take Caisson from "built, behind a gate" to **buyable**: lock the last operator-owned decisions, then
stand up the live external surfaces (Stripe · support-bot · docs-service · license issuer keypair) so the
code track's commerce spine has real infra to land against. Everything here is **external-system /
secrets / billing tagged** — confirm before each irreversible/outward act; creds come from
`~/.gridwork/env` (NO 1Password).

## Read first

- `docs/state/readiness-and-backlog.md` — §0 live-verify · **§2 configuration & secrets checklist** (the spine of this session) · §4 open operator decisions
- `docs/state/decisions-and-forks.md` — locked board + the deferred pricing/CF-Access items
- `docs/build-state.md` — what's deployed vs seam (registry Worker LIVE; site GREEN; bot/docs = deploy seam)
- `knowledge/decisions/ADR-0082` (go-live posture) · `ADR-0095` (offer structure: annual cadence, $2,999–4,999 anchor) · `ADR-0012`/`0089` (commerce/billing) · `ADR-0009`/`0105` (support-bot deploy = Railway rec) · `ADR-0096` (docs embedder seam)

## Part A — Decision locks (operator-owned forks — resolve via picker, record as ADR)

| Fork                                            | What to decide                                                                                                                                                                                                                                                                                                          | Record                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **A1 — Final pricing numbers + grandfathering** | Lock exact figures (anchor: Compliance $2,999–4,999 · Bundle · Compliance-Updates annual · Developer · Enterprise "contact us"; ADR-0095 §pricing) + the grandfathering policy for early buyers. Inputs: the two Perplexity GTM reports in `outputs/research/` + the ADR-0081/0082 committed display anchors.           | **ADR-0106**                 |
| **A2 — CF Access go-live gate**                 | Currently `access.tf` APPLIED (email-OTP, `@gridwork.dev` only). Decide the flip trigger + sequencing: keep gated until checkout works + Compliance is buyable, then `rm access.tf` + `terraform apply` as the deliberate launch act. (Board already leans "keep gated"; confirm + record the exact go-live checklist.) | **ADR-0107** (or board note) |

Surface A1 + A2 in **one `AskUserQuestion` round** (recommendation + confidence + the report-anchored
evidence). Write each lock as an **append-only ADR (0106, 0107)** + update the `docs/state/` board. The
code track reserves ADR-0108+ — do not collide.

## Part B — Creds checklist + live deploy execution (DEPLOY-class — each step is operator-gated)

Source every secret from `~/.gridwork/env` (or the operator pastes it via `! <cmd>`). Never hardcode;
env-vars / the platform secret store only. Confirm before each outward step.

| Seam                                      | Creds needed                                                                                                                                   | Action this session                                                                                                                                                                                                                                | Gate                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **B1 — Stripe (real commerce)**           | `STRIPE_SECRET_KEY` + per-endpoint `STRIPE_WEBHOOK_SECRET` (+ Stripe Tax on)                                                                   | Create/confirm the Stripe account (operator=MoR), products/prices matching the A1 lock, the webhook endpoint, and a Stripe-CLI local-forward smoke of `invoice.paid` → the X-2 cycle→grant mapper (already built, ADR-0089).                       | real-money — operator confirms               |
| **B2 — support-bot deploy (Railway rec)** | `DISCORD_BOT_TOKEN` + `OPENROUTER_API_KEY` + `DOCS_SERVICE_URL`/`DOCS_SERVICE_TOKEN` + Postgres `DATABASE_URL`                                 | Deploy `services/support-bot` (`Dockerfile` + `/health` ready) to a cloud runner; register the Discord app/slash command; smoke `/ask` end-to-end against the live docs `/query`.                                                                  | external — bot posts publicly                |
| **B3 — docs-service deploy**              | `DOCS_SERVICE_TOKEN` + `OPENROUTER_API_KEY` (the real **qwen3-embedding-8b** embedder — the ADR-0096 deploy seam; `FakeEmbedder` is test-only) | Deploy `services/docs`; flip the real OpenRouter embedder; verify `POST /query` returns vector-leg results (not the FTS floor) + `/llms.txt` serves. B2 consumes this.                                                                             | external sink (OpenRouter — rostered)        |
| **B4 — license issuer keypair**           | generate the Ed25519 **signing** keypair; `CAISSON_LICENSE_TOKEN` is the verify side (compiled in)                                             | Mint the keypair, store the private signing key in the platform secret store, confirm the public/verify key matches what's compiled into `@caisson/license-verify`. The issuer **code** is the code track's I1 — this provisions its key material. | secrets — private key never leaves the store |

> **Order:** B4 (keypair) + A1 (pricing) unblock the most. B3 before B2 (bot depends on docs `/query`).
> B1 can run independently. The license-issuer _code_ (code track I1) and dashboards (I3) consume A1+B4 —
> coordinate: this session provisions creds + locks numbers; the code track wires them.

## Cross-session coordination

- **Pricing (A1) → code track I3 dashboards.** Lock A1 early so the code session can wire real numbers
  (it builds against `@caisson/pricebook` config meanwhile — non-blocking).
- **Keypair (B4) → code track I1 issuer.** Provision before I1's EXECUTE phase needs to sign.
- **ADR numbers:** this session = 0106–0107; code session = 0108+. No collision.
- Both sessions edit `docs/state/decisions-and-forks.md` — this session is **authoritative on the
  decision board + creds/deploy state**; the code session appends only its impl-fork ADR rows. Rebase, don't clobber.

## Exit criteria

A1 pricing + A2 CF-Access locked as ADRs; the `docs/state/` board + readiness §2 reflect live state;
Stripe live + webhook smoke green (B1); support-bot answering in Discord from the live docs corpus (B2);
docs-service serving real-embedder `/query` (B3); the license signing keypair provisioned + verify-key
match confirmed (B4). The remaining go-live blocker is then only the deliberate **CF Access flip** (A2) —
held until the code track's commerce spine + a buyable Compliance edition land.
