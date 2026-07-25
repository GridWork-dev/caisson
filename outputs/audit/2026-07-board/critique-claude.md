# critique-claude.md — Phase-2 adversarial critique (CLAUDE critic, fresh context, 2026-07-23)

Inputs: EVIDENCE.md + all six section files, EVIDENCE-spot-audit.md, OPERATOR-CONSTRAINTS.md,
DEMAND-LEDGER.md, personas.md, all eight memos. Independent verification performed this session
against the pinned snapshot (`/home/gw/lab/caisson-audit-ro` @ `f6df03f9`): homepage WORM copy +
live-test header, license signer env const, install-line hero code, sign-off footnote, partners
mailto, plans-page month-13 FAQ, homepage line 258, compare-page slug table, frameworks-pack
crosswalk files, `infra/license-issuer/ISSUER_PUBLIC_KEY.md`, changeset count, both pyproject
homes, billing package descriptions, and the T1-cited ADR files. Where I say "verified," I ran
the check myself this session.

---

## 1. The checklist

### 1a. Where the seats agreed too easily

**Four of eight seats converge on the same recommendation in near-identical words** — "send the
five drafted design-partner emails this week / within days 1–3" (S1, S2, S3) plus T1's "executing
the existing design-partner motion." That is not four independent minds reaching one conclusion;
it is one conclusion pre-installed in the evidence layer. DEMAND-LEDGER §1 does not merely record
the zeroes — its "Reading" paragraph argues them ("the single most-developed GTM motion … still
reads as zero executed field contact"), and the ledger's closing "Honest read for the board" is a
full editorial. The compiler did the seats' reasoning for them, and the seats recited it back.
The tell: no strategy seat weighed a single cost of sending, only the cost of not sending
(see 1b-2).

**Uniform ritual deference is the second suspicious consensus.** Every memo recites the same
liturgy — "38% higher," "EXPERIMENT-FIRST," "sufficiency gate," "spot-audit binding" — in nearly
interchangeable sentences. The corrections are real and load-bearing, but eight seats performing
identical compliance is evidence they optimized for auditability, not that they thought
independently. The only two memos that _corrected the evidence pack itself_ — S4 (compare-page
program is built, contra DEMAND-LEDGER §6) and T4 (`infra/license-issuer` is the ADR-0226
rotation ledger of record, contra E-A9's "public-key doc only" framing) — prove the pack was
correctable. Six seats never tried.

**The consensus that should not exist:** S1, S2, and S3 all endorse immediate buyer contact and a
"live artifact demo" on the premise that "all technical go-live gates [are] GREEN"
(DEMAND-LEDGER §0, quoted approvingly by S2 §1). The tech track factually destroyed that premise
(T2: four launch-blocking findings; T3: the first command on the homepage fails) and **no
strategy seat noticed, and no tech seat flagged the collision either.** The board's modal
recommendation and its modal factual finding contradict each other, silently. See §4.

### 1b. Unvalidated shared assumptions

1. **"Technical gates GREEN."** Sourced to a 2026-07-17 recon, repeated in the ledger, adopted by
   S1/S2/S3. T2's memo shows the homepage advertises COMPLIANCE-mode WORM with leaked-root-key
   resistance while the sole live proof runs GOVERNANCE and "COMPLIANCE is never live-tested"
   (I verified both the homepage EVIDENCE array and the live-test header comment verbatim). Green
   engineering gates and true public claims are different properties; every seat that relied on
   the former to recommend contact treated them as the same.
2. **"Sending five emails is free."** All strategy seats treat outreach as pure upside. Nobody
   priced the downside: the candidate pool is 30 researched / 10 shortlisted / 5 drafted —
   a tiny, slow-to-replenish asset at this ICP specificity — and the first thing a contacted
   founder does is visit a now-publicly-reachable site whose first command fails with a "ready"
   status chip on it (verified: `dual-door-hero.tsx:119-121` renders `bunx @caisson-sh/cli@latest`
   next to a success-tone "ready" chip; the package has never been published) and whose WORM copy
   overclaims. Contact-speed was weighed by four seats; contact-quality by zero.
3. **Sentrik's "nine-day" velocity is an observation-interval artifact treated as product
   velocity.** E-C1 supports exactly two facts: a 2026-07-13 recon described an early-access
   product, and a 2026-07-22 crawl found a developed one. It cannot distinguish "Sentrik shipped
   most of a product in nine days" from "the 07-13 recon was shallow." S1, S2, and S4 all cite
   the nine days as a market-clock fact; S1 hardens it further into a false statistic (§2, S1
   row 5). The single most-repeated urgency datum in the strategy track is unvalidated.
4. **"The operator will execute once told."** The pack's central mystery — five send-ready emails
   held since 2026-07-12 while nothing gated an email — is diagnosed by no seat. Every
   recommendation implicitly assumes the bottleneck was the absence of a board memo. If the
   11-day hold is revealed preference (avoidance, perfectionism, optics-anxiety — the ledger's
   own "business optics" phrase), then the board just produced eight more reasons to keep
   preparing. Nobody asked _why_ the emails weren't sent, which is the one question a real board
   would open with.
5. **The buyer-evidence monoculture.** Every "real ICP human" in the corpus arrived through one
   paid panel vendor (Cookiy), whose own platform flagged one of five Study-2 completes as
   low-quality mid-interview. B2B panel professional-respondent risk is never named; the
   usable-n≈2–3 could plausibly be lower. The seats accepted the corpus's self-graded STRONG/WEAK
   tiers as the ceiling of skepticism.

### 1c. Who is missing from the room

- **The auditor.** The entire product thesis terminates in S4's own value claim: "your auditor
  verifies without trusting any vendor." No seat represents the person who accepts or rejects
  evidence packs. Zero evidence anywhere in the corpus that any working auditor will accept a
  WORM-chain artifact in place of a Vanta-style report — and no memo names this as the thesis's
  single point of failure.
- **A distribution operator.** Four seats prescribe cold founder email; none owns response-rate
  priors, sequencing, or channel mechanics. S1 banned itself from generic pipeline advice; the
  ban left a vacuum no one filled.
- **Payments/banking reality.** Mercury + Paddle approvals are the actual launch gate
  (DEMAND-LEDGER §0) and the board contains no knowledge of how long these take, whether they can
  be expedited, or whether Paddle-as-merchant-of-record even requires Mercury before first sale.
  The binding constraint on the whole company got zero seats.
- **The operator's throughput.** OPERATOR-CONSTRAINTS names operator time the scarcest resource.
  Summed, the eight memos demand: a 30-day outreach sprint (S1), an OSS flip + Show HN + Art. 50
  content (S2), a new ≥5-interview research round + two copy programs (S3), a comparison-page and
  copy program (S4), an architecture freeze superseding four ADRs (T1), four security receipt
  programs (T2), a three-item site readiness bar + homepage re-cut (T3). Nobody totaled the
  combined ask against one person's month. The board issued eight partially-conflicting work
  programs and no priority order.
- **Legal.** Perpetual-license enforceability, the liability of _currently published_ compliance
  overclaims (see 1d), and the risk profile of shipping EU-regulation commentary under time
  pressure — all touched obliquely, owned by no one.

### 1d. Risks nobody named

1. **The overclaims are live now, not at launch.** T2 frames its findings as launch-blocking;
   T3 observes the page is publicly reachable; nobody joins the two: with the CF gate observably
   down, the COMPLIANCE-mode/root-key claim and the "ready"-labeled dead install command are
   _already published_ by a company whose brand is "claims are scraped and dated, never
   invented." The risk is present-tense, and every memo prices it future-tense.
2. **Bus factor as a product defect.** A solo founder selling perpetual licenses + 12-month
   update windows to regulated buyers has vendor-continuity risk as a _first-order diligence
   question_ (E-D11's "who supports me after I own the code" is its soft form). No memo names
   key-person risk, escrow, or continuity terms. For this ICP it is not an operator detail; it
   is an objection class.
3. **Reflexivity of the audit itself.** OPERATOR-CONSTRAINTS records observed session spend up
   to ~$800/day on heavy agent waves. This board — eight engines, an evidence pack, a spot
   audit, this critique — is the exact substitution-of-research-for-contact pattern S1 and S2
   attack. No seat named the mirror.
4. **Being wrong in public about Art. 50.** Three memos (S2, S3-adjacent, S4) push the
   correct-the-rumor piece inside ten days. The spot-audit itself flagged the Dec-2026 grace
   nuance as a trap. A trust-market vendor whose first public act is rushed regulatory
   commentary containing an error suffers asymmetric damage; nobody priced the downside, only
   the hook.

---

## 2. Citation-entailment audit (5 sampled claims per memo, 40 total)

Verdicts: **ENTAILED** (source supports claim as tagged) · **STRETCHED** (directionally related,
overstated) · **TAG-INFLATED** (OBSERVED/CORROBORATED tag the source doesn't earn) ·
**FALSE** (source contradicts or cannot yield the claim) · **MISATTRIBUTED** (claim true, cited
E-id doesn't contain it).

### S1 · Capital Skeptic

| #   | Claim (abbrev.)                                                                 | Cited                      | Verdict                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 61 pkgs / 78k-LOC site / 328 ADRs financed before any funnel; zeroes            | E-A1/2/4/7, E-P1/2, LEDGER | **ENTAILED** — counts match spot-audit-corrected sources.                                                                                                                                                                                                                                                                                                                    |
| 2   | $869.40/partner, $4,347/cohort, covers 6.7–10.9 months of stack                 | E-B2, E-D21                | **ENTAILED** — arithmetic re-computed and correct ($1,449×0.6; ÷$130/÷$80).                                                                                                                                                                                                                                                                                                  |
| 3   | All Study-1 reactions at $1,049; $1,449 untested; CAC unknowable                | E-B2, E-D1/8/9, E-P1/2     | **ENTAILED**.                                                                                                                                                                                                                                                                                                                                                                |
| 4   | Study 2: ~$122 for 2–3 usable responses → $40.67–$61/learning                   | E-D8, E-D9, **E-D21**      | **MISATTRIBUTED (minor)** — the $122 figure lives in DEMAND-LEDGER §2, not E-D21; arithmetic itself correct.                                                                                                                                                                                                                                                                 |
| 5   | "the closest direct competitor **expanded from 193 to 632 rules in nine days**" | E-C1                       | **FALSE as stated** — E-C1 says the _free tier_ was described as 193 rules on 07-13 and is "unchanged from 07-13" at 193 today; 632 is the total across 26 frameworks, with no baseline total on record. E-C1 cannot yield a 193→632 growth claim, and cannot distinguish product velocity from shallow earlier recon. S1's most rhetorically useful number is manufactured. |

### S2 · Contrarian Founder

| #   | Claim                                                                                              | Cited                   | Verdict                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 5 drafts unsent since 07-12; zero sends/replies/partners; nothing in Mercury/Paddle gates an email | LEDGER §0/§1 (OBSERVED) | **ENTAILED** — the memo's spine and the pack's best-supported fact.                                                                                                                                                                                                                                                                                                                |
| 2   | "Sentrik closed most of the surface gap **in nine days**" (CORROBORATED)                           | E-C1                    | **TAG-INFLATED** — the _current state_ is corroborated by live re-crawl; the nine-day _velocity_ is an inference over two observation timestamps (see 1b-3). Should read OBSERVED-at-two-timepoints/INFERRED. S2 quotes E-C1's own phrasing, so the inflation is inherited — but a contrarian seat inheriting the pack's most convenient urgency stat uncritically is the finding. |
| 3   | Comp AI/Probo "out-traction the baseline threat ~1000× in stars"                                   | E-C2                    | **STRETCHED (inherited)** — 1,689/2 ≈ 845×, 1,227/2 ≈ 614×; E-C2's own "three orders of magnitude" was already rounded up, and S2 rounds the rounding.                                                                                                                                                                                                                             |
| 4   | ADR-0373 "repriced into an evidence vacuum against ADR-0304's own reopener conditions"             | spot-audit §D, E-D15    | **ENTAILED-with-spin** — factually careful (S2 concedes it was a composition change), but the framing implies a lock violation where 0304's lock arguably didn't cover the recomposed bundle. Fair polemic, flagged as polemic.                                                                                                                                                    |
| 5   | Gate-down + 1 visitor = "beginning to falsify itself" (OBSERVED, weak)                             | E-B2 corr., E-P1        | **ENTAILED** — properly hedged; the 30-day window mostly covers the gated period and S2 says so. Model hedging.                                                                                                                                                                                                                                                                    |

### S3 · Voice of Buyer

| #   | Claim                                                                    | Cited                         | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No buyer has seen $1,449; all reactions at $1,049                        | E-D1, E-D15, E-B2, spot-audit | **ENTAILED** — including the counter-nuance (#12's lowball) argued against itself.                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | Third-party proof = #1 blocker; none can exist yet                       | E-D5, LEDGER, E-B3            | **ENTAILED** — three-pass convergence accurately carried.                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | GDPR/PCI/ISO named by 5/12; #7 verbatim dealbreaker; federal n=1 flagged | E-D4, E-D7, E-B2/B4           | **ENTAILED** — n=1 caveat honored.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 4   | Site leaves month-13/support-scope "unresolved" (INFERRED)               | E-D6, E-D11, E-B2             | **INFERENCE FALSIFIED** — the tag was honest (inferred from scrape silence), but the deployed source contradicts it: homepage line 258 states "support is included: a real person on email and Discord … with every license" (verified) and the month-13 FAQ exists at the plans page (verified, lines 63/205). The true residual — T3's placement finding (three clicks deep) — is materially weaker than S3's "unresolved." Synthesis must not carry S3's version. |
| 5   | "No buyer has told us they want this cheaper" — CONTESTED by sample      | E-D10                         | **ENTAILED** — and note S3 is the only seat that surfaces E-D10's _both_ directions honestly. Compare S4 row 3.                                                                                                                                                                                                                                                                                                                                                      |

### S4 · Positioning Strategist

| #   | Claim                                                                                                                            | Cited                   | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Only substitute a real buyer named = "$100/mo DIY agent build"; site's against-what omits it                                     | E-D3/D16/B2/D10         | **ENTAILED on the transcripts**; but see row 4 — the omission claim is overstated at the compare-page layer.                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | Door copy names ISO 27001/NIST 800-53 nowhere while the repo ships both crosswalks                                               | E-B4, E-D4, E-D7 + repo | **ENTAILED** — crosswalk files verified present (`frameworks-pack/src/crosswalks/regimes.ts`, `nist-800-53.ts`); consistent with T3's independent read. The pack's best product-ahead-of-copy find.                                                                                                                                                                                                                                                                                 |
| 3   | "the **only** price-credibility signal on record points upward, not down"                                                        | E-D1, E-D14, E-D17      | **FALSE by omission** — E-D10 (which S4 itself cites in point 1) records two of four Study-2 reactions anchoring _below_ ($1,000/$1,200 expectations, "a little expensive") and the DIY substitute making $2,059 feel expensive. S4 cherry-picks #12's lowball and #1's "surprisingly cheap" while omitting the same evidence item's downward half. The cleanest cherry-pick in the eight memos, and it feeds a hold-or-raise narrative on a price with zero live-anchor reactions. |
| 4   | Snapshot ships "20 /compare/* pages … nothing for Sentrik, Probo, or the DIY-agent alternative"; LEDGER's "not built" note stale | repo                    | **PARTIAL** — verified: 21 slugs, not 20; sentrik and probo genuinely absent; **but a `build-in-house` compare slug exists**, which is the DIY alternative at face value. The ledger correction itself is right and important; the "nothing for DIY" flourish is contradicted by the slug table unless the page addresses only hire-engineers DIY (unestablished by the memo).                                                                                                      |
| 5   | "compliance automation software" $212 CPC / KD 10; invented-category attack                                                      | E-D16, E-B gaps         | **ENTAILED** — figures match E-D16 verbatim; the INFERRED tag on the synthesis is honest.                                                                                                                                                                                                                                                                                                                                                                                           |

Provenance flag (both KIMI seats): S4's lane note says "inlined corpus only … no fetch ability,"
yet the memo claims the snapshot "was read directly"; T4 likewise claims "direct snapshot read."
Every such claim I checked was _true_ (the material was evidently inlined in their briefs), but
the memos misdescribe their own access, which matters for a board that trades on citation
provenance.

### T1 · Staff-Eng Pragmatist

| #   | Claim                                                                                          | Cited        | Verdict                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Deliberate composable complexity; full gate surface across 61/7/5                              | E-A1/2/3/8   | **ENTAILED**.                                                                                                                                                                                                                                                                                                                                            |
| 2   | Seller plane = second toolchain before >1 visitor                                              | E-A4, E-P1/2 | **ENTAILED**.                                                                                                                                                                                                                                                                                                                                            |
| 3   | Eight provider modes, unvalidated matrix, freeze not extend                                    | E-A10, E-P2  | **ENTAILED** — 8 is the correct E-A10 count (T4 miscounts it as 7; see §4).                                                                                                                                                                                                                                                                              |
| 4   | 328 ADRs + ~400KB logs "force a solo operator to reconstruct current truth" — **CORROBORATED** | E-A7, E-I2   | **TAG-INFLATED** — the counts are corroborated (416KB, verified arithmetic); the "operating drag / forces reconstruction" causal claim is an opinion wearing the counts' tag. Should be OBSERVED (counts) + INFERRED (drag).                                                                                                                             |
| 5   | Recommendation names ADR-0009/0096/0105/0206 as the support-stack locks to supersede           | _(no E-id)_  | **TRUE-BUT-OUTSIDE-CONTRACT** — I verified all four ADR files exist and are support-stack decisions as characterized. But the shared contract says an uncited point is ASSUMED, and no other seat could check these from the pack. The most actionable line in T1's memo rests on evidence the board never indexed — right conclusion, unauditable path. |

### T2 · Risk & Security Assessor

Structural finding first: **all five points wear CORROBORATED tags anchored to E-ids that do not
entail them.** E-B2/E-B3 establish only what the marketing site says; E-A4/E-A9 establish only
LOC counts and directory layout. Every security-relevant fact in T2 comes from its own file:line
reads — single-observer, uncorroborated by anything in the pack. The findings I spot-checked are
_real_ (which makes this the most consequential memo), but under the board's own tag discipline
these are OBSERVED-by-one-seat, not CORROBORATED, and the distinction matters precisely because
the strategy track never read the code.

| #   | Claim                                                                                                                                         | Verdict                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Homepage claims COMPLIANCE-mode WORM incl. leaked-root-key resistance; code defaults GOVERNANCE; live proof "COMPLIANCE is never live-tested" | **VERIFIED THIS SESSION** — homepage EVIDENCE array and live-test header both reproduce verbatim. Claim sound; tag technically inflated (E-B2/E-B3 don't contain the code half). The board's most important single finding.                       |
| 2   | Ed25519 private key via env var inside the ~23k-LOC public issuer service; KMS unwired                                                        | **PARTIALLY VERIFIED** — `LICENSE_SIGNING_KEY_ENV = "CAISSON_LICENSE_SIGNING_KEY"` confirmed in `license-issue/src/signer.ts`; the 23k-LOC figure is E-A4-entailed; the KMS-unwired assertion not independently checked. Plausible; tag inflated. |
| 3   | RLS proof is PGlite/CI, not deployed Neon/pooler                                                                                              | **NOT INDEPENDENTLY VERIFIED** — cited file:line plausible given repo conventions; flagged as single-observer.                                                                                                                                    |
| 4   | Non-atomic WORM-put-inside-DB-transaction split-brain                                                                                         | **NOT INDEPENDENTLY VERIFIED** — same status.                                                                                                                                                                                                     |
| 5   | `verifyLicense` accepts no expectedMajor; resolver ignores `claims.major`                                                                     | **VERIFIED BY ABSENCE** — grep across `license-verify/src/verify.ts` + `registry/worker/entitlement-filter.ts` finds neither symbol; consistent with the claim.                                                                                   |

### T3 · Product-Craft Critic

| #   | Claim                                                                                             | Verdict                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hero install line `bunx @caisson-sh/cli@latest` fails (never published)                           | **VERIFIED — and understated**: the code renders the dead command beside a success-tone `StatusChip` labeled "ready." The site certifies its own dead command.                                 |
| 2   | Checkout dead-ends (sandbox Paddle, login gate)                                                   | **ENTAILED** — LEDGER §7 corroborates; exact component lines not re-checked.                                                                                                                   |
| 3   | Sign-off footnote pairs interviewed-buyer build-estimate with $1,449                              | **VERIFIED verbatim** at `page.tsx:~375-380`; the adjacent code comment even documents the ADR-0080 attribution care, which sharpens T3's point — the _number_ moved after the care was taken. |
| 4   | Month-13 answer exists but three clicks deep; homepage answers perpetuity, not the updates window | **VERIFIED** — plans page lines 63/205 exact.                                                                                                                                                  |
| 5   | `/partners` CTA is a bare mailto, no capture                                                      | **VERIFIED** — `mailto:support@caisson.sh?subject=…` as primary Button.                                                                                                                        |

T3 is the only memo whose every sampled OBSERVED tag survived independent re-verification at the
cited line. It should anchor the synthesis's site-facts layer.

### T4 · Consolidation Minimalist

| #   | Claim                                                                                 | Verdict                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Five meta-bundles total 213 LOC; count artifact not sprawl                            | **ENTAILED** — arithmetic verified (34+35+84+32+28).                                                                                                                                                                                                                          |
| 2   | `infra/license-issuer` is the ADR-0226 key-rotation ledger of record, not a stray dir | **VERIFIED** — the file carries the rotation history and retired-keys table exactly as claimed. A genuine correction _of the evidence pack_ (E-A9 undersold it).                                                                                                              |
| 3   | 24 pending changesets (cites E-A1, which says 23)                                     | **VERIFIED 24** — T4's direct read is right, the cited source is stale by one; trivial but the citation contradicts its own E-id.                                                                                                                                             |
| 4   | Two Python islands: support-bot + a second pyproject under tools/                     | **VERIFIED** — `tools/assert-lane/pyproject.toml` exists.                                                                                                                                                                                                                     |
| 5   | "keep the single **7-provider** LLM switch (E-A10)"                                   | **MISCOUNT vs cited source** — E-A10 lists eight modes (openai/anthropic/google/openrouter/groq/mistral/together/local, + ollama riding local). T1 counts eight from the same E-id. Minor, but a consolidation seat miscounting the thing it is consolidating is on-the-nose. |
| —   | KP3: branch "still absorbing +28k-line slices"                                        | **STALE against the binding E-I2 correction** (redesign merged; the slice landed; only the renovate branch remains). Present-tense framing contradicts a correction the memo elsewhere honors.                                                                                |

**Tally of non-clean verdicts:** 2 FALSE (S1-5, S4-3), 1 inference-falsified (S3-4), 1 partial
(S4-4), 3 tag-inflated (S2-2, T1-4, T2-systemic), 2 misattributed/miscount (S1-4, T4-5), 1
outside-contract (T1-5), 1 stale (T4-KP3), 2 inherited stretches (S2-3). The pack's discipline
mostly held — but both FALSE findings sit in the _strategy_ track's urgency/pricing narrative,
which is exactly where a synthesis will want to quote them.

---

## 3. Dissent ledger — seed rows

One claim per memo most worth preserving verbatim against synthesis laundering.

| id     | claim (preserve verbatim)                                                                                                                                                                                                                     | evidence                                                                                   | seat |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---- |
| DIS-S1 | "zero paid partners at day 30 stops further product spend and reopens the wedge or pivot board."                                                                                                                                              | ADR-0297 terms; E-D21 cost floor; LEDGER §§1,7                                             | S1   |
| DIS-S2 | "The cheapest unit of compounding available today is a sent email."                                                                                                                                                                           | LEDGER §0/§1 (OBSERVED zeroes); ADR-0352                                                   | S2   |
| DIS-S3 | "None of us has ever seen the price you are actually charging."                                                                                                                                                                               | E-D1, E-D15, spot-audit §D (binding)                                                       | S3   |
| DIS-S4 | "'Code-owned compliance' as a standalone category frame is invented — nobody searches it."                                                                                                                                                    | E-D16; E-B gaps #3                                                                         | S4   |
| DIS-T1 | "The seller plane is deliberate reckless debt at this stage" — scale `caisson-docs` + `caisson-support-bot` to zero, explicitly superseding ADR-0009/0096/0105/0206.                                                                          | E-A4, E-P1/2; ADR files verified present                                                   | T1   |
| DIS-T2 | "the homepage presents S3 Object Lock in COMPLIANCE mode as the shipped posture and promises resistance even to a leaked root key, while `S3ArtifactStore` defaults to GOVERNANCE and the sole live proof explicitly never tests COMPLIANCE." | `page.tsx` EVIDENCE array + `store.s3.live.test.ts` header — both re-verified this session | T2   |
| DIS-T3 | "the first command every technical champion runs **fails**" — `bunx @caisson-sh/cli@latest`, never published, rendered beside a "ready" status chip.                                                                                          | `dual-door-hero.tsx:119-121` (verified); LEDGER §3                                         | T3   |
| DIS-T4 | "**Kill: nothing.** … an empty kill list is this audit's honest finding, not an evasion."                                                                                                                                                     | E-A3/A9 re-verification; ADR-0226 ledger find                                              | T4   |

Laundering risks, named: DIS-S1's tripwire will be softened to "reassess at 30 days" — the
verbatim is a stop-spend trigger. DIS-T2 and DIS-T3 will be summarized as "polish items" — they
are the factual refutation of "gates GREEN" and must stay adjacent to any send-the-emails
recommendation. DIS-T4 will tempt the synthesis to invent consolidation actions anyway; the
empty kill list is the finding. And note the structural caveat on DIS-T4's producing seat: a
Consolidation Minimalist that concedes every candidate because each keep is "ADR-locked" is
deferring to 328 decisions the same operator's agents authored — the governance corpus is
self-insulating, and sparring rule 3 ("no consolidation that breaks a shipped ADR without naming
it") quietly became "no consolidation that any ADR touches." T1 broke that spell (supersede four
ADRs by name); T4 did not. Preserve both verdicts side by side — their disagreement about the
support bot (T1: scale to zero; T4: keep, frozen at two islands) is real dissent the ledger must
not average away.

---

## 4. Cross-track contradictions

1. **"GREEN gates" vs launch-blocking findings (the big one).** S1's sprint requires "a live
   artifact demo" and $1,449 shown verbatim by day 10; S2 wants the OSS flip + Show HN inside 30
   days and endorses "all technical go-live gates are green"; S3 wants buyers "in front of the
   real artifact." T2 (verified) shows the homepage's WORM posture claim is false as shipped and
   holds the paid gate on four receipts; T3 (verified) shows the artifact's first interaction
   fails and the pay path dead-ends, and explicitly holds "every act of buying or seeding
   traffic" behind a readiness bar. The strategy track's unanimous action rests on a readiness
   premise the tech track factually refuted. Neither track cites the other. The synthesis cannot
   adopt both; the honest merge is T3's bar (days, not weeks: fix the install line, restore or
   resolve the pay path, correct the WORM copy) as a _precondition inside_ S1/S2/S3's 30-day
   contact window — not sequencing debate, dependency.
2. **S3-4 vs T3-3/T3-verified-facts.** S3 infers the site leaves support-scope/month-13
   unresolved; the deployed source answers both (homepage line 258; plans FAQ), leaving only
   T3's placement critique. S3's version must not survive into the synthesis.
3. **S4 vs the evidence pack itself.** DEMAND-LEDGER §6 says the comparison-page program is
   "recommended, not built"; the snapshot ships 21 compare slugs including comp-ai (verified).
   The pack is wrong; S4's correction stands — but S4's own "nothing for the DIY-agent
   alternative" is contradicted by the `build-in-house` slug in the same table.
4. **S1-5 vs E-C1.** "Expanded from 193 to 632 rules in nine days" is not supported by its own
   citation (free-tier 193 unchanged; 632 is total, no baseline total exists). Strike the
   statistic; keep the watch-item.
5. **T1 vs T4 on the Python seller plane.** T1: scale docs + support-bot to zero, superseding
   four named ADRs. T4: keep both Python islands, frozen at two. Direct keep/kill conflict on
   the same subsystem, unreconciled by either.
6. **T1 vs T4 on the provider count.** Eight modes (T1, correct per E-A10) vs "7-provider
   switch" (T4). Trivial, but both claim the same E-id.
7. **S4-3 vs S3-5/E-D10 on price direction.** S4: "the only price-credibility signal on record
   points upward." S3 (citing the same corpus): recorded objections anchor _below_ on
   expectation; direction CONTESTED by sample. S3 is right; S4's directional claim should enter
   the synthesis only in S3's contested form.

---

## Bottom line

The pack's evidence discipline mostly survived contact with eight adversarial seats — but the
board's headline consensus ("send the emails now, everything is ready") was pre-written by the
demand ledger's editorializing and is factually incompatible with the tech track's two verified
findings (dead install command, WORM overclaim) that no seat cross-read. The two FALSE citations
both inflate the strategy narrative (competitor velocity, upward price signal). The synthesis
that matters is one sentence long: **fix the three now-public falsifiable claims this week, then
send the five emails the same week — and diagnose, out loud, why they weren't sent eleven days
ago.** Any synthesis longer than that which drops the T2/T3 preconditions, softens S1's stop-spend
tripwire, or quotes the 193→632 statistic is laundering.
