---
updated: 2026-07-05
status: archived
---

# Opportunity backlog — deferred, parked, and future-opportunity ledger

**Status:** living state doc, born 2026-07-02 from three repo-wide sweeps (harvest/LIFT
deferrals · buyer-journey gaps · verticals/adapters/pricing/support). Complements
`docs/state/readiness-and-backlog.md` (launch readiness) — this doc is the _opportunity_
side: everything consciously NOT built yet, with its recorded reason and revisit trigger.
Nothing here is a decision; locks land as ADRs (`knowledge/decisions/`), forks on
`docs/state/decisions-and-forks.md`. Items already promoted to execution tracks are marked.

Snapshot context: ADR ceiling **0242** (0239 wave-6 close-out · 0240 local-ai $349 canonical ·
0241 changeset prose source-gate · 0242 visual-audit remediation picker — realized 2026-07-05). The 2026-07-02-PM execution wave's seven tracks LANDED
(PRs #75–#84 merged) and the §7 launch-runbook DEPLOY block is EXECUTED + live-verified
(CAISSON-15/16/17/18 Done). Since then (2026-07-03): glossary batch 1 (ADR-0235, PR #99) ·
the whole-repo audit v2 baseline + remediation specs (ADR-0233, PRs #100/#101 — execution
operator-gated, dispositions in `outputs/specs/audit-v2-remediation/TRIAGE.md`) · the catalog
à-la-carte row drop (ADR-0238, PR #98) · the site presentation rework BUILT + MERGED
(ADR-0237, PR #102) · and the **2026-07-03 deploy wave**: 4 Railway services redeployed
(site/license/docs/support-bot — ask-AI + Turnstile env, PostHog purchase capture, expanded
docs corpus re-embedded), the ADR-0203 Discord role push wired live (grant token minted, both
push sides + bot env set), the registry Worker redeployed with `registry.caisson.sh` custom
domain + TARBALLS + REVOCATIONS R2 bindings, the Paddle SANDBOX catalog verified reconciled
(4 dropped products archived, 19 prices match), and the first live changeset consume run
(publish.yml pipeline hardened en route: pack-flag fix PR #105 + commit-pathspec fix PR #106).
Cross-references below to "in-flight" tracks read as merged. **Residue re-baselined 2026-07-05**
(site-design-2 close-out; the prior 6-item list is superseded): **(1)** ~~registry npm-delivery
install proof~~ **DONE 2026-07-03/04** — live `bun install` proof + first live consume ran (two
pipeline bugs fixed en route, PRs #105/#106); **(2)** ~~deny-set publisher~~ **DONE 2026-07-05** —
the edge revocation deny-set is FULLY LIVE (R2 + `REVOCATIONS` binding + authed PUT shim +
`license_revocation` DDL, launch-runbook §8); **(3)** cred-sweep (ADR-0226): the **issuer-keypair and `LICENSE_ISSUE_TOKEN` half is DONE**
(rotated ×2 2026-07-05, PRs #117/#118, fp `a170f7a0ab89bab0`); the three web-minted values
(`OPENROUTER_API_KEY` / `DISCORD_TOKEN` / `MIRROR_PUSH_TOKEN`) remain **OPERATOR TO DO**
(`launch-runbook.md` §1.1); **(4)** caisson-oss public flip + first `confirm=publish` npm dispatch
(ADR-0222) — still HELD, gated on the §1.1 sequencing gate (now only the three rotations plus a
fresh-export scan-gate run remain); **(5)** the WORM lock-mode posture — resolved as policy by
ADR-0230 (GOVERNANCE pre-launch, COMPLIANCE escalation at the commerce flip); the flip itself
rides the launch act; **(6)** ~~Mac-mini runner~~ **RESOLVED 2026-07-04** (org-transfer orphan
root-caused; scale set re-registered, `native-ext (macos)` green). Plus buyer-journey:
CF-Access-gated content eyeball of the new marketplace/ask-AI surfaces (operator SSO; curl and
headless probes land on the Access login by design).

---

## 1. Harvest / LIFT program residuals

The ranked harvest program is **TERMINAL** (`docs/state/harvest-program.md:174-231`,
ADR-0210): all Source A/B/C items existing or built, the 8 decoupling seams
closed-by-rebuild. What remains:

| Item                                        | State                                                                                                                                                                                                                                             | Revisit trigger                                                                                                                                                                     | Where recorded                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Hash-at-rest session tokens (lift-sweep #9) | DEFERRED — fights the ADR-0015 better-auth lock; 2 of 3 sub-claims already satisfied                                                                                                                                                              | T1: better-auth ships a token-hashing seam (cheap config flip) · T2: a compliance framework files an audit finding (adapter wrap, L). Build requires an ADR superseding ADR-0210 §3 | `outputs/specs/deferred-respec/SPEC-auth-session-token-hashing.md` (DRAFT, forks tabled) |
| Wave-6 sub-top-15 bucket                    | **CLOSED (ADR-0239, 2026-07-03)** — ledger terminal. Wave-6a built the 10-row compliance/billing subset (ADR-0229, PR #92); wave-6b built the 9 remaining `build-next` rows (#1 #2 #18 #25 #27 #28 #38 #40 #46). Nothing buildable remains queued | none — a future harvest sweep starts a NEW ledger                                                                                                                                   | `outputs/specs/deferred-respec/SPEC-wave6-harvest-disposition.md` (TERMINAL)             |
| — wave-6 `build-on-trigger` rows (28)       | Parked BY DESIGN on per-row triggers (e.g. #23 BYOK tracing on feature request · #29 content-minimization once a RAG agent ingests external docs · #64 review-queue UI kit once an edition ships one); a trigger firing IS the election           | Per-row triggers                                                                                                                                                                    | same SPEC                                                                                |
| Audit-harness producer-side depth           | Explicit slice-2 defer in ADR-0188 (cross-model de-dup/corroboration merge + sub-domain chunking); no standalone tracking artifact beyond the ADR line                                                                                            | Next audit round that hits producer-side noise                                                                                                                                      | ADR-0188:49-50                                                                           |
| Lift-sweep evidence report un-versioned     | **RESOLVED (ADR-0239)** — folded in-repo at `outputs/research/caisson-lift-sweep-REPORT.md`                                                                                                                                                       | none                                                                                                                                                                                | disposition SPEC:27-29                                                                   |
| The 9 second-pass-downgraded raw candidates | Not recoverable — no per-candidate list exists in-repo (upstream of the 67-row enumeration)                                                                                                                                                       | Documentation gap only; re-mine transcripts if ever needed                                                                                                                          | `harvest-program.md:98`                                                                  |

Closed-for-good buckets (do not re-propose): the ADR-0133/0134/0135/0186/0210-0217
rejection tables (literal ports, internal-only framing, blocking audit gate, WORM-shaped
lifts, per-module agent-runner SKU, etc.) and the 20 wave-6 `drop-with-reason` rows.

---

## 2. Buyer-journey gaps (BUY-stage money plumbing + trust copy)

Everything downstream of a successful purchase (license, registry Worker, generator,
Discord role, dashboard 9 views, docs, MCP, support-bot RAG) is real and deployed. The
open gaps cluster in BUY:

| Gap                                                                                                                                                               | State                                                                                                                     | Vehicle                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Production Paddle account / real-money checkout                                                                                                                   | Sandbox only (`launch-runbook.md` P1); nothing purchasable with real money                                                | Operator act at launch flip                         |
| 14 per-module Paddle price ids are `PLACEHOLDER` strings, and `add-to-cart-button.tsx` has NO guard — a standalone module reaches checkout and fails at Paddle.js | **DONE**: all 14 SANDBOX products/prices created + wired (`purchases.ts`/`catalog.ts` real ids verified 2026-07-02)       | Landed (production re-create rides the launch flip) |
| Compliance edition price re-anchor ($749 launch-sum flag in `package-catalog.md:170-176`)                                                                         | **DONE**: ADR-0227 $799 locked; display merged (PR #76) + Paddle SANDBOX price PATCHed to 79900                           | Landed                                              |
| Paddle MoR-attribution + refund-policy copy on `/legal/terms` + `/legal/privacy`                                                                                  | **DONE** — landed PR #61 + the paddle-legal rewrite; render-verified 2026-07-05 (`launch-runbook.md` P2 row)              | Landed                                              |
| No pre-purchase "ask AI" surface — the support bot is reachable only inside Discord; site offers only ⌘K docs search + email                                      | **DONE** — ask-AI widget shipped (ADR-0234/0236: dual model lanes, both placements, Turnstile, Q-text capture w/ consent) | Landed                                              |
| Discord privileged intents + channel/role env (P4), bot-token + OpenRouter rotation (P5)                                                                          | Verify-before-launch, not confirmed resolved                                                                              | Launch runbook checklist                            |
| Doc-staleness nits: `robots.ts` static-export comment, `sitemap.ts` hardcoded lastModified, `dashboard/plan` stale webhook comment                                | Cosmetic                                                                                                                  | Next doc sweep                                      |

---

## 3. Adapter / port remainder (from `docs/state/adapter-expansion.md`)

The 0119-0128 range there was advisory numbering; most of it shipped as ADR-0160-0176.
Genuinely still open:

| Opportunity                                                                 | Precondition / note                                                                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| ChatPlatform port + Slack/Telegram drivers for `services/support-bot`       | Port abstraction must be extracted first — the bot is Discord-only today                                      |
| Storage drivers: Cloudflare R2 / GCS / Azure Blob behind `ArtifactStore`    | R2 is ~trivial (S3-compatible endpoint reuse of `S3ArtifactStore`)                                            |
| Jobs drivers: BullMQ/Redis, Inngest behind `JobQueue`                       | pg-boss shipped (ADR-0173); remainder demand-driven                                                           |
| KMS providers: GCP KMS / Azure Key Vault / HashiCorp Vault                  | ADR-0171 operator lock was AWS-first; on-demand ADRs later                                                    |
| License `KmsSigner` real-KMS wiring (Ed25519 signer for `services/license`) | Explicit P7 seam (ADR-0171 exclusion); needs an asymmetric Sign primitive, different shape than envelope-wrap |
| SSO: SCIM directory sync / org auto-provisioning                            | Out of ADR-0172 scope; must reconcile with ADR-0176 org model                                                 |
| SSO vendors beyond WorkOS (Clerk, Auth0/Okta)                               | Demand-driven                                                                                                 |
| Analytics port + env-gate fix (advisory 0122)                               | Still unfiled; also listed as refactor R2 in `refactor-split-opportunities.md`                                |

Rejected/non-actionable: OTLP/gRPC exporter (already swappable via env), Neon-serverless
HTTP Transactor (infeasible under the RLS `SET LOCAL` model — the reason Railway PG won).

---

## 4. Vertical editions / packages (P7 roadmap)

All gated on P7 intake (`stage2-kickoff-triage.md:141`); named concretely only in
`outputs/research/options.md:96-100` + `specs/00-product-spec.md:107`:

| Opportunity                                                                                                            | Note                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compliance vertical packs: legal-doc-automation, fin-ops/billing-compliance, certified-payroll, EU-AI-Act Annex-IV kit | Priced in research ($121-152 CPC signals); no SPEC/ADR                                                                                                                             |
| AI-feature packs: RAG-starter, agent-framework, eval-harness, guardrails à la carte                                    | Research idea only                                                                                                                                                                 |
| Local-first verticals: private medical-notes, contract-review, research-corpus                                         | Research idea only                                                                                                                                                                 |
| Vertical SaaS starters: marketplace, B2B multi-tenant, agency-ops                                                      | Most speculative of the set                                                                                                                                                        |
| R3 compliance god-package split (framework-catalog / evidence-assembly / signing)                                      | Unlocks à-la-carte framework packs; **price-lock-gated** — touches the edition module-sum math; needs a pricing re-lock alongside the split (now against the ADR-0227 $799 anchor) |
| B5 agency/reseller persona (bundle + white-label rights, seat/agency tier)                                             | Persona aspiration only — zero ADR/SKU anywhere; an unstarted fork                                                                                                                 |
| Subscription new-edition access                                                                                        | Locked in principle (ADR-0012); implies future editions, none committed                                                                                                            |

---

## 5. Marketplace / ecosystem

| Opportunity                                               | State                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Curated module marketplace (per-module commerce at scale) | One-line P7 roadmap item; the infrastructure it sits on (registry Worker + entitlement gating + `registry.caisson.sh` npm delivery ADR-0223 + `@caisson-sh` public scope ADR-0222) is built or in flight — the marketplace itself has no design doc |
| Third-party / community module publishers                 | **Zero trace anywhere in the repo** — would need a first design doc (trust model, revenue share, publish gating) before any fork round                                                                                                              |

---

## 6. Pricing / packaging

| Opportunity                                              | State                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Value-based per-module pricing revisit                   | ADR-0129 self-flagged: revisit via superseding ADR once real per-module purchase data exists (post-launch)       |
| Credit-pack tiering                                      | Single $49/5,000 SKU (ADR-0222); no other sizes proposed — observed gap, not a recorded item                     |
| Enterprise / SLA tier above "Contact us"                 | Nothing above the current ceiling is designed; public pricing would need its own ADR                             |
| Thin-edition fattening (bundle-discount math conversion) | Partially realized by the harvest (alerting + retention-runner are real); further fattening rides future modules |

---

## 7. Support / service tiers

| Opportunity                                                                           | State                                                                         |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Priority human-support SLA (subscription value-add)                                   | Named in ADR-0012, mechanics never specced (queue, response-time commitments) |
| White-label as top subscription tier                                                  | One research clause (`options.md:39`), never promoted                         |
| Onboarding/architecture call · course/video · component/Figma kit (bundle value-adds) | Research menu; not built                                                      |
| Managed docs tooling (Mintlify/Fern agentic-RAG, PR-opening maintenance agent)        | Documented alternative; Caisson self-built `services/docs` (ADR-0096) instead |

---

## 8. Other parked items

| Item                                                                                                       | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live OSCAL push (`OscalExportTransport.deliver()` to a real GRC ingest)                                    | Deferred T15/P7 — export/bundle built, transport not                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Persistent production KMS CMK (field-crypto)                                                               | Deferred to first-customer time (ADR-0221 KMS-2; throwaway CMKs proven live)                                                                                                                                                                                                                                                                                                                                                                                                          |
| Agentic-Dev Next.js inspector UI                                                                           | Deferred (code gap only — the ADR-0082 §4 site-labeling exception was retired by ADR-0237 rider 2; the site sells the edition live) — substrate (`agent-kernel`/`agent-runner`) is built                                                                                                                                                                                                                                                                                              |
| ~~Glossary batches 2–3 (~20 of the 32 locked terms)~~                                                      | **DONE 2026-07-05** (PR #121) — all 32 ADR-0235 terms live via the Fork-B adversarial workflow; llms.txt parity included                                                                                                                                                                                                                                                                                                                                                              |
| Real media for module/edition depth routes (the F2 `media` slot)                                           | ADR-0237 F2 — placeholder brand art shipped in PR #102; "real media later TBD" is the recorded residual                                                                                                                                                                                                                                                                                                                                                                               |
| ~~macOS `native-ext` CI leg on hosted `macos-latest`~~                                                     | **RESOLVED 2026-07-02** (commit `623d07c`) — the leg moved to the self-hosted `[self-hosted, gw-macos-arm64]` mini runner with a check-first `brew install sqlite` step (`quality.yml`); no hosted `macos-latest` leg remains. Verified green as recently as run `28698099079` (2026-07-04).                                                                                                                                                                                          |
| Thin surfaces flagged in `build-state.md` gap #4 (`ai-config` 49 loc, `ai-kit` 358 loc, `ai-evals` 1 test) | Present and green but shallow — verify before quoting as feature-complete                                                                                                                                                                                                                                                                                                                                                                                                             |
| Board numbering hygiene: interim "ADR-0119" (Railway topology) vs advisory 0119 (email)                    | Documentation-only inconsistency, zero product impact. Disambiguated by meaning (ADR-0088 convention): the board's interim "ADR-0119" for Railway provisioning topology (`decisions-and-forks.md:148`) shipped for real as **ADR-0114/0115**; `adapter-expansion.md`'s advisory "ADR-0119" for the email multi-driver (`adapter-expansion.md:53`) shipped for real as **ADR-0170**. Neither claim actually landed on 0119 -- that number stays in the unfiled 0119-0128 advisory gap. |

---

## 9. Whole-repo improvement program (2026-07-05 research wave — trigger-parked rows)

Program ledger: `outputs/specs/repo-improvement-program/SPEC.md` (13-gap disposition off
`outputs/research/monorepo-bigpicture-2026-07.md` + the do-not-copy anti-decision list). The
build-now hygiene wave (#4–#8/#10) is owned by **Kickoff B**
(`outputs/kickoffs/KICKOFF-B-hygiene-audit-remediation.md`, which also picks up ALL 264 open
audit-ledger findings per the 2026-07-05 lock); the two revenue-policy forks sit in Kickoff A's
picker queue; the trigger-parked rows are recorded here per the program convention:

| Item                                                                      | Revisit trigger                                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| AI-citation tracking loop feeding `gw-aeo-strategist` (research #9)       | Post-launch: site public + indexed — pre-launch citation data is noise                                 |
| Support-bot graded confidence gate, 3-tier (research #11)                 | First real support traffic — thresholds untunable at zero users; escalation sink (ADR-0206) is ready   |
| Docs-conversion instrumentation discover→quickstart→signup (research #12) | Launch flip — needs public traffic; event names designed with the F8 split-analytics scheme            |
| Affiliate / recurring-commission program (research #13)                   | First organic-channel signal — substrate (Discord + subscriptions) exists; a design doc precedes forks |

## Cross-reference: promoted to execution 2026-07-02-PM

registry npm delivery (ADR-0223) · members-fold republish (MF-A/B/C) · admin-v2 purchase
revoke incl. the R-4 edge revocation list (ADR-0225) · live-verification harness
(ADR-0224) · post-hardening follow-ups (admin error mapping + CI continue flag) ·
cred-sweep prep (parity tool + CAISSON-14 KMS fix, ADR-0226) · compliance reprice + the
14-product sandbox catalog (ADR-0227). Those tracks' own residuals (e.g. registry C2/F2
token hardening, E2 prerelease channel, B2 scope split) live in their PLAN/SPEC docs, not
here.
