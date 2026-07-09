# Visual-audit delta — post-remediation prod re-run (2026-07-09)

The Kickoff-G W5 verify artifact: the full-surface prod harness re-run after the four wave
merges (PRs #190–#193), migrations 0020–0022 applied live, and the `caisson-site` Railway
redeploy — measured against the same-day baseline `outputs/reviews/visual-audit-2026-07-09.md`.

**Run shape:** 714 shots · 142 routes · 12 categories · mobile 390px + desktop 1280px · light +
dark · authed buyer-dashboard leg + scripted interactions, against **live prod** (`caisson.sh`,
CF-Access service-token bypass). Artifacts: `outputs/visual-audit/2026-07-09-post/` (gitignored,
714 PNGs + `manifest.json`); harness `apps/site/scripts/visual-harness.ts`. **Analysis:** 11
chunk-audit agents (one per remediated cluster + console triage + two regression sweeps), every
agent reading its images directly; run `wf_055502d7-fd9`.

## P0 verdicts — all five FIXED

| Baseline P0                                        | Verdict   | Evidence                                                                                                                                                                                                                                   |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 `/dashboard/ai-keys` dead (RSC error boundary)   | **FIXED** | All 4 variants render the full authed layout + the entitlement-gated body ("AI-Production required" + View plans CTA) for the probe account — no error digest. Migrations 0020–0022 live (bless: 19/19 checksums clean → apply 3 → 22/22). |
| 2 Sitewide mobile footer overlap                   | **FIXED** | 8 categories sampled at 390px, both themes: single-column stack, wordmark tagline legible, zero overlap.                                                                                                                                   |
| 3 `/compare/*` fact-chip nowrap (520–1014px pages) | **FIXED** | Worst offenders (comp-ai, turbostarter, supastarter, create-t3-app) all exactly 390px; pills wrap in place. Desktop cell collision also gone (bedrock, build-in-house, scytale).                                                           |
| 4 Module popout content loss                       | **FIXED** | ai-meter desktop popout shows description + all 5 capability badges; media carousel fully contained in the modal with working nav, both viewports.                                                                                         |
| 5 Home mobile hero/builder-bar + 449px overflow    | **FIXED** | No builder bar before selection; hero unobstructed; page exactly 390px; stat row wraps; the 6-bundle matrix scrolls internally. P1 same-class pages (eu-ai-act 570→390, ai-evals +144→390) also fixed.                                     |

## P1 cluster verdicts

- **Placeholder/broken diagrams** — FIXED: all 13 formerly broken-image pages render real
  mechanism diagrams / composer widgets; retention-runner's text stays inside its boxes.
- **Docs dark-mode code contrast** — FIXED: every sampled code block fully highlighted at
  high contrast (base, provenance, ai-production, local-first); no second-block fade; "402"
  renders real zeros in all code/mono contexts. New commercial docs pages render real content.
- **Legal/docs P3 riders** — FIXED: legal desktop two-column prose measure; complete 6-bundle
  docs sidebar; correctly-cased pagination.
- **Login failure feedback** — FIXED (live-proven): "Incorrect email or password." renders in
  the danger token with `role="alert"`. The chunk's initial REGRESSED verdict was a **harness
  artifact**: the old interaction's `/sign in/i → .first()` clicked the magic-link→password
  MODE-TOGGLE (never submitting), so baseline and re-run both shot a pristine form. The
  interaction now genuinely submits wrong credentials and waits for the error text.
- **Dashboard mobile chrome** — FIXED: account pill ellipsis-truncates in-viewport; Sign out
  present in mobile chrome on every page.
- **Email dark-mode** — FIXED: every dark variant renders the real dark palette (hybrid
  technique); light variants unchanged; button contrast strong in both modes.
- **Regression sweeps (marketing/marketplace + legal/glossary/docs-light)** — CLEAN: no new
  breakage from the waves; zero stray "edition" copy.

## Console triage (fresh evidence for Kickoff-H)

- **429s: 76/714 shots across 22 distinct routes** (baseline 69/640 across 19) — compare/
  build-in-house, 11 glossary, 4 legal, 6 marketplace-module. Slightly broader; NOT fixed;
  owned by H W2 (root-cause + fix live there).
- **502s: 2 shots** (glossary/compliance-as-code, docs/local-first — both mobile/dark).
- **React #418: 12 shots, exactly `/login` + `/reset-password`** — matches CAISSON-50's
  CF-beacon-injection scope with no bleed; terraform apply stays operator-gated.
- **CF beacon CSP violation: 674 shots = 100% of non-email pages** — CAISSON-51, same gate.
- **No new console-error class.**

## New findings from the re-run + dispositions

| Sev | Finding                                                                                                                                                | Disposition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2  | retention-runner media slot showed audit-worm's evidence-lifecycle diagram (content mismatch vs the erasure module's actual behavior — ADR-0082 floor) | **Fixed in-session** with a bespoke `retention-erasure` diagram (runErasure fan-out → per-target error isolation → one reason-tagged audit row), replacing the borrowed `worm-lifecycle` mapping. Simple removal was rejected by W3's own silent-placeholder guard (every module must own real media on its depth page), so the honest fix was authoring the ninth mechanism diagram. Live at the next site deploy.                                                                                                 |
| P2  | Θ-for-zero in docs body prose (guardrails "2,ΘΘΘms", local-inference "vecΘ")                                                                           | **Technical instances fixed in-session** (both moved into mono inline code, matching local-store.mdx's own `vec0` style). Live at the next site deploy. **Font-level residual is an operator design call**: the served Hubot Sans woff2 carries NO alternate zero glyph (GSUB: ccmp/dnom/frac/liga/locl/numr/pnum/tnum only) — every prose zero sitewide renders barred (footer "© 2Θ26", "Apache-2.Θ"). CSS cannot fix it; options are accepting it as brand character or a body-font change via the design track. |
| P3  | Compare mobile table: checkmark value columns each take ~⅓ of 390px, squeezing Detail into 6–9 wrapped lines                                           | **Deferred, documented** — cosmetic polish; page containment + left alignment (the baseline defects) are fixed. Candidate for the next design-track kickoff.                                                                                                                                                                                                                                                                                                                                                        |
| —   | `popout-media-carousel-next` interaction failed 4/4 on first run                                                                                       | **Harness artifact, fixed in-session**: the card viewer omits the code slide (ADR-0290 WR-03), so `MODULE_PAGES[0]` with one targeting diagram renders the single-slide layout with no nav. Interaction repointed at audit-worm (2 diagrams); 4/4 green.                                                                                                                                                                                                                                                            |

## Bottom line

Baseline: 99 findings (9 P0 · 56 P1 · 25 P2 · 9 P3). Post-remediation: **0 P0, 0 buyer-visible
P1 on G-owned surfaces**. Remaining: the 429/502/beacon/hydration infra cluster (H-owned +
operator-gated terraform), one P3 polish row, and the font-level zero-glyph design call.
