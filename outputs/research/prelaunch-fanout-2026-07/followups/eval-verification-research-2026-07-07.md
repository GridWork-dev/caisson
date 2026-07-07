# Evaluation License Verification Flow Research Memo

**Date:** 2026-07-07  
**Scope:** Five-leg grounded research feeding ADR-0274 (evaluation access: generator demo mode + verified time-boxed eval licenses) decision-making.  
**Audience:** Operator, for picking a concrete verification flow before SPEC authoring.

---

## A. Comparable Commercial-Source Eval Vendors

**Metabase (Pro/Enterprise):**

- **Verification:** Email + password only, no company info gate.
- **Window:** 14 days.
- **Gate mechanism:** Source already public (GitHub); runtime license-token check on compiled EE features (not source access).
- **Leaks:** n/a — enforcement surface is token on compiled jar, not source gating.
- **Verdict:** Different model (open source + token) — not a source-eval analog.

**Keygen (EE):**

- **Verification:** Sales-assisted form (no instant self-serve).
- **Window:** 30 days.
- **Gate mechanism:** Cryptographically signed license file, checked at boot; **dogfoods its own Fair Core License product** on itself.
- **Leaks:** DOSP (Delayed Open-Source Publication) clause: FCL code becomes Apache-2.0 on the 2-year anniversary. Neo4j/ONgDB bypass case (below) shows the license-key-only gate was litigated and lost — defeated by a competing vendor stripping the license-restriction notices and relicensing under AGPL.
- **Verdict:** 30-day window + license-key gate + legal anti-circumvention clause; DOSP is the "vendor lock-in escape hatch" mechanism relevant to evaluators' expiry-access question.

**Craft CMS:**

- **Verification:** None at technical layer; domain classification only (localhost vs. public).
- **Window:** Unlimited time-bound by domain type (private trial indefinitely; nag-only on public domains).
- **Gate mechanism:** Soft enforcement via admin-only banner; **fails open** (throws before rendering the banner if config missing).
- **Leaks:** GitHub issue #18094 shows bypass (missing config → no license warnings displayed).
- **Verdict:** Guilt-based nag model, not hard technical gate — poor precedent for source eval.

**Sidekiq Pro/Enterprise:**

- **Verification:** Payment-gated; explicitly no pre-sales trial.
- **Window:** No pure trial; paid month with money-back guarantee.
- **Gate mechanism:** Private gem server with HTTP Basic Auth credentials + runtime kill-switch (refuses boot without valid env var in production).
- **Leaks:** Credential-embedding in `.bundle/config` / Gemfile is well-known (not a platform-specific leak), and license checks are inconsistent across environments per one documented issue (#6928).
- **Verdict:** Credentials-in-env-or-config gate, not identity-verification — different tier.

**JetBrains (IDEs):**

- **Verification:** Account (email) only; no company verification.
- **Window:** 30 days per major version (new trial per version is an abuse vector).
- **Gate mechanism:** Online activation against JetBrains Account, plus offline signed activation codes; periodic live validation to `jetbrains.com` with DNS-bypass to public resolvers.
- **Leaks:** **Strong evidence base**: per-version trial reset exploited by JetNinja (public GitHub tool, auto-generates unlimited accounts); leaked/suspended license keys circulate in public gists with working instructions to block validation via DNS blocking or iptables.
- **Verdict:** 30-day window but trial-reset abuse is documented and unresolved; live validation + DNS-bypass is an arms race, not a durable gate.

**Unreal Engine:**

- **Verification:** **Multi-step, identity-linked — strictest found**: GitHub OAuth + Epic Games account + EULA acceptance + 7-day GitHub org-invite acceptance (must be managed/personal account, not enterprise).
- **Window:** Perpetual (not time-boxed); revenue-gated (5% royalty on sales >$1M).
- **Gate mechanism:** Private GitHub org membership + fork-based revocation (fork deleted on org removal).
- **Leaks:** August 2021 platform-side incident (silent accidental org de-invites); pre-2013 leaks of an older, unrelated distribution model. No evidence of current GitHub-linked-account model being technically defeated.
- **Verdict:** Most rigorous identity verification found; perpetual grant (not eval-specific); fork deletion is the revocation mechanism.

**ag-Grid Enterprise:**

- **Verification:** Email via lead-gen form.
- **Window:** 30 days.
- **Gate mechanism:** Runtime client-side license-key check; watermark + console warnings without key.
- **Leaks:** Not found in this pass.
- **Verdict:** 30-day lead-gen trial with runtime watermark (similar to Metabase, but source distributed pre-built).

**n8n:**

- **Verification:** None; source-available license (Sustainable Use License).
- **Gate mechanism:** License-key-only checks on EE features in `.ee.`-suffixed files.
- **Leaks:** **Strongest "defeats static gate" evidence in vendor survey**: public GitHub repo (`vektormemory/n8n-enterprise`) and maintained Gist patch make `isLicensed()` always return `true`, survives upstream updates. Community forum shows user uncertainty on legality of removing a non-`.ee.` license-check decorator.
- **Verdict:** Static license-key check is trivially defeatable by patching; only legal remedy is a breach-of-license claim.

**Neo4j / ONgDB:**

- **Verification:** None (source-available).
- **Gate mechanism:** Commons Clause + proprietary "Neo4j Sweden Software License" (AGPL + reuse restrictions).
- **Leaks:** **Litigated case**: ONgDB fork stripped the Clause and License notices, relicensed under AGPL, marketed as free drop-in replacement. Federal court found trademark infringement, false advertising, and DMCA violation (CMI removal). Damages awarded. Litigation (DMCA + Lanham Act), not technology, was the deterrent that worked.
- **Verdict:** Defeats any static license-gate model; legal remedy required.

**DevExpress / Telerik (.NET/JS component vendors):**

- **Verification:** 30-day trial via download.
- **Window:** 30 days.
- **Gate mechanism:** Runtime key check; source access is paid-subscription-only benefit (not part of free trial).
- **Leaks:** **Thriving black market**: warez sites (nulledfrm.com, downloaddevtools.com, digitalcrackpro.com) offer DevExpress Universal and Telerik Ultimate with keygens/patchers, dated 2026. No platform-level enforcement against crack distribution.
- **Verdict:** 30-day trial; paid source access; cracks exist and circulate openly.

**Time-Delayed Open-Source Publication (FSL, BSL, DOSP):**

- **Pattern:** Sentry (Functional Source License, 2-year change date), HashiCorp (Business Source License, 4-year change date), Keygen (Fair Core + 2-year DOSP), Craft CMS (no change date).
- **Verdict:** The inverse model to eval windows — grants perpetual, not temporary, access; used by the commercial-open-source cohort (Couchbase, CockroachDB, MariaDB, Confluent, Redis, Elastic) as the vendor lock-in escape hatch.

**Synthesis:**

- **30-day trial window** is the de-facto standard (Metabase, Keygen, JetBrains, ag-Grid, DevExpress/Telerik).
- **Static license-key gates** (JetBrains, ag-Grid, n8n, Neo4j, DevExpress) are consistently defeated by public tooling, patching, or litigation.
- **Identity verification before grant** ranges from "email only" (JetBrains, ag-Grid) to "multi-step GitHub org invite + EULA" (Unreal Engine) — Unreal is the strongest.
- **Leaks anyway** are documented as a pervasive pattern: per-version trial resets (JetBrains), maintained public bypass patches (n8n), thriving keygen/crack markets (DevExpress, Telerik), and litigated re-licensing (Neo4j/ONgDB).
- **No vendor found enforcing "one eval per company domain"** specifically — closest is Sidekiq's money-back guarantee and Keygen's per-policy machine dedup.

---

## B. Work-Email / Company-Domain Verification Mechanics

**Disposable-Email Detection:**

- **Free static blocklists:** 4,000–277,000 domains (Rohithzr/email-provider-filter = 71.6K disposable, 69.9K free-mail, daily-updated). Low false-positive, thin coverage.
- **Paid APIs:** Kickbox ($0.006–$0.01/check), ZeroBounce ($0.0025–$0.008/check), Mailgun ($0.008–$0.012/check), DeBounce ($0.00045/check). Lowest cost DeBounce or IPQualityScore (~$0.0003 at scale).
- **False-negative rate:** No vendor publishes a measured rate. Industry consensus: 4,000+ new disposable domains registered monthly that aren't on public blocklists. Static-list-based approach is a baseline, not a full solution.
- **Verdict:** Free list (~$0, covers 80% of obvious cases) + optional paid API (~$0.01/check, handles new domains and free-mail detection) as two tiers.

**MX Record + Domain-Age Checks:**

- **MX validation:** Free via native Node/Bun `dns.resolveMx()` (no cost, no quota).
- **Domain-age:** Free via RDAP/WHOIS (ICANN-mandated, no cost). `lissy93/who-dat` (MIT, self-hostable) or `rdapapi.io` (freemium, caches 24h).
- **Signal strength:** Domain age <30 days = high-signal fraud indicator (40% of new .com/.net registrations are abuse infrastructure per IPQualityScore; phishing-domain studies show 7% <7-days-old; supplier-vetting benchmark: <12 months for business claiming years of history = flag).
- **Verdict:** $0 in cost; domain-age thresholds calibrated against phishing (fast fraud), so they're weak against *patient* abusers (spend $1 on a domain, wait 4 weeks, apply). Operator manual review is the override for borderline cases.

**Enrichment Lookups (Clearbit-style):**

- **Clearbit is dead** (HubSpot acquired, rebranded Breeze Intelligence, now requires $15/mo HubSpot subscription + $0.20/enrichment credit minimum 100-credit blocks). Impractical for lightweight gate.
- **Alternatives:** Apollo.io ($49–$119/mo seat, 0 credits if no match), Hunter.io ($34–$104/mo, 0.5 credit per email), Abstract API ($99/mo, billed even if no match found).
- **"Not found" handling:** None of the APIs distinguish "small/new company not in database" from "fake company" — absence is not evidence. Any gate must treat "no enrichment data" as neutral, not negative.
- **Verdict:** Enrichment can add confidence but doesn't definitively prove company legitimacy. Manual LinkedIn glance is free and catches most obvious fakes.

**LinkedIn / Company-Site Cross-Checks:**

- **LinkedIn API is gated** behind the Partner Program (not practically obtainable by a single operator).
- **Proxycurl is dead** (LinkedIn sued; settled 2025; permanently injuncted). Apollo.io and Seamless.ai had LinkedIn data pulled mid-enforcement wave.
- **Legal risk:** scraping public LinkedIn profiles still violates LinkedIn ToS (contract claim, separate from CFAA); third-party data purchases don't shield the buyer from liability.
- **Manual path:** human search "person name + company" on LinkedIn/Google by hand. ~30–60 sec/lookup, ~2-min total verification time per applicant (per supplier-vetting guide), non-scalable, no legal risk.
- **Verdict:** Manual LinkedIn glance is the only safe/practical option. Scripted/API-based LinkedIn checking carries legal exposure that outweighs the marginal speed gain.

**Manual Review Queue (Single Operator):**

- **Benchmark:** KYC/KYB cost data (2026 PYMNTS Intelligence): $26/case consumer, $51/case KYB, hybrid $17–29. No source found specifically benchmarking eval-license review cost, so treat KYB as an upper bound.
- **Practical checklist (~2–3 min/application):** WHOIS domain age (`whois.domaintools.com`), MX record type (`mxtoolbox.com`), SSL cert first-issuance via CT log (`crt.sh`), LinkedIn glance for employee profiles, website homepage for HTTPS + real contact info. Catches the obvious fakes (brand-new domain, free MX, no LinkedIn footprint).
- **Honest ceiling:** Catches the lazy/obvious cases. A moderately sophisticated adversary (aged domain, proper MX, plausible LinkedIn presence) passes a 2-min glance. Documented 23% decision-quality variance across analysts, measurable fatigue effects (Friday approvals 8% lower than Tuesday), per a 40-deployment KYC benchmarking study.
- **Cost:** $0 in tooling; operator time (~2–3 min/request).
- **Verdict:** Free first-pass filter; works for the obvious cases; human fatigue + variance are real risks if volume grows above ~5–10/day.

**Synthesis:**

- **Tier 1 (automated, $0–$0.01/check):** MX validation + domain-age (free RDAP) + optional paid disposable-detector. Catches the majority of obvious fakes.
- **Tier 2 (manual, $0, ~2 min/check):** Operator glance at WHOIS/CT/LinkedIn/website. Catches false-positives from Tier 1 and moderately-sophisticated impersonation attempts.
- **No silver-bullet API exists** that definitively proves "this person works at this company" without legal/ToS risk.

---

## C. Paddle Card Verification Capabilities

**Question: Does Paddle support a $0-authorization card verification step (capture card, zero charge)?**

**Answer: No true $0-auth primitive; closest is "free trial with card on file."**

**Paddle Billing trial types (official docs, developer.paddle.com):**

1. **Free Trial (GA):** customer enters card at checkout, Paddle holds it on file, _no charge_ during trial, charged on `next_billed_at` (trial end date). Requires a priced `product`/`price` (trial charge is `null`/zero).
   - _Workaround for "eval only"_: set trial length = evaluation window (e.g., 14 days), then the customer can let the subscription lapse/cancel before first charge.
   - _Matches requirement?_ Card captured + verified (real, chargeable card) + zero immediate charge = closest fit to "$0 auth + friction."

2. **Paid Trial:** charge a nominal amount ($1+) during trial, then the full price on renewal. Charges are refundable.
   - _Matches requirement?_ Actually-charged card is closer to real authorization + capture, but violates the "no charge" requirement (even if refundable).

3. **Cardless Trial (Developer Preview, not GA):** no card collected at all (waitlist, early access only).
   - _Not applicable._

**Card-authorization behavior on free trials:** Paddle's public docs do **not** state whether a card-network authorization hold (e.g., $0 or $1 test authorization) occurs during a free-trial checkout. This is genuinely undocumented in the retrieved sources — flagged as a gap rather than inferred.

**MoR fraud scoring:** Paddle (as Merchant of Record) owns all fraud decisioning; no merchant-configurable rules engine is documented. Risk scores are opaque.

**Verdict:**

- **Paddle does not offer a pure "$0 authorization-only" mechanism** (like Stripe's SetupIntent).
- **Free trial (card captured, zero charge) is the documented equivalent** — matches "identity + friction, no charge" better than alternatives.
- **Smallest workaround if a real charge is needed:** Paid trial with immediate refund, or a $1 trial charge + refund (explicitly documented as refundable).

---

## D. Source Watermarking for TS Tarballs

**Core finding: Per-licensee fingerprinting of source code is a solved problem in theory, fragmented in practice, and defeated by any intentional rewrite.**

**1. Whitespace/Comment Steganography:**

- **Trailing spaces/tabs encode bits** (stegsnow tool, `SNOW` codec, 3 bits per 8-column sequence). Real 2021 malware precedent: 300KB payload hidden in trailing whitespace after a license-agreement comment block, decoded via PHP `bindec(tab=1/space=0)`.
- **Unicode space variants** (em-space U+2003 vs. regular space) are an alternate channel.
- **Evasion:** `prettier --write` collapses blank lines and removes trailing whitespace → steganography destroyed. Any linting rule that normalizes whitespace destroys this.
- **Visibility:** Not stealthy — requires recipient to _not_ run standard formatting.

**2. Per-License Embedded Constants:**

- **Academic precedent (SrcMarker, IEEE S&P 2024):** semantic-preserving AST transforms + variable-name substitution to embed ID bitstrings in JavaScript/C/Java source. Research prototype, not a shipped tool.
- **Commercial vendors (unverified):** BetterGuard (.NET), Stunnix JS obfuscator, Jscrambler; claim per-licensee IDs in metadata/encoding variations. No independent audits found.
- **Practical tool closest to Caisson's use case:** `@vektormemory/prov` (single-author, Apache-2.0, npm). CLI `prov stamp` embeds a `Licence-Fingerprint` header; `prov canary issue --licensee "Acme Pty Ltd"` generates a unique per-licensee fingerprint. No independent security review found; treat as unverified.
- **Evasion:** Prettier and minifiers preserve comment _content_ and string literals → constants survive formatting/minification, _if_ the constants are reachable code (not dead data — tree-shaking can eliminate unused constants).

**3. Build-Time Ordering/Formatting:**

- **Status: Theoretically possible but high-ceiling evasion.** Academic survey ("Software Watermarking by Code Re-Ordering") concludes this entire family is "highly susceptible" to semantics-preserving transformations and recommends dynamic watermarking instead.
- **Modern tools actively defeat this:** `eslint-plugin-import` `order` rule (auto-fixable, canonical import sorting) would silently destroy an import-order watermark on the next `--fix` pass. Webpack/Vite deliberately standardize build output for caching stability, moving _away_ from order-dependent fingerprints.
- **No TS/JS-specific implementation found.** Academic precedent targets Java bytecode constant pools and compiled binary function tables.
- **Verdict: Not recommended** — too fragile and easily defeated by standard tooling.

**4. Honest Evasion Limits:**

| Transform                              | Whitespace Stego                                       | Embedded Constants                                           | Order-Based                                          |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------- |
| `prettier --write`                     | Destroyed (trailing spaces/blank lines removed)        | Survives (comment/string content untouched)                  | Survives (bare prettier doesn't reorder)             |
| Minifier (terser)                      | Destroyed (whitespace eliminated)                      | Survives if reachable (if dead-code-eliminated, may be lost) | Destroyed (identifiers renamed, structure flattened) |
| `eslint --fix` with import sort        | Survives (linter doesn't touch whitespace in comments) | Survives                                                     | **Destroyed** (import order canonicalized)           |
| Clean-room rewrite                     | Destroyed (new bytes written)                          | Destroyed (content not retyped verbatim)                     | Destroyed (different structure)                      |
| Git history stripped (`.git/` deleted) | Survives (no-op, affects metadata only)                | Survives (no-op)                                             | Survives (no-op)                                     |

**5. Real-World Case Studies:**

- **Document/data watermarking (strong precedent):** Xerox printer dots (identified NSA leaker), Apple iOS canary traps (caught internal leak), Canadian voter-list bogus entries (identified distribution path), WordPress P2 background watermarks (announced but no confirmed successful trace documented).
- **Binary/executable watermarking:** Ambermoon (1990s) — embedded journalist name in encrypted blocks, caught a press leaker (confirmed first-person account).
- **Source-code tarball watermarking:** **No independent case study found.** Vendors claim capability; no public trace recorded. Claude Code npm source leak (2026-03-31) is a useful _contrast_ case: broadcast packaging accident, no per-licensee watermark involved; DMCA against verbatim copies only, unable to reach clean-room rewrites within hours — illustrates point 4's "clean room defeats static marks" live.

**Verdict:**

- **Embedded constants (string/UUID/ID in real code) + comment watermarks** are the highest-fidelity option for TS source tarballs. Survives formatting + minification if the constant is reachable.
- **Watermarking is attribution-on-discovery, not a detection mechanism** — requires pairing with active monitoring (GitGuardian-style perimeter scan or GitHub Code Search sweep for the watermark token).
- **Any intentional rewrite defeats all static marks.** A determined abuser who cleans-room reimplements the code (reads behavior, rebuilds from spec) bypasses watermarking entirely.
- **Theft is catchable after the fact (DMCA, legal action) only if the watermark makes the leak _traceable to a specific licensee_.** The watermark's job is attribution, not prevention.

---

## E. Known Abuse Patterns & Countermeasures

**Floor mechanisms (from ADR-0274):**

- (a) Verified work email on company domain (no free-mail)
- (b) One-active-eval-per-domain + global concurrent-eval cap
- (c) $0 card-on-file authorization
- (d) Operator manual review queue
- (e) Per-eval source watermarking
- (f) No-redistribution terms + deny-set on expiry

### Pattern 1: Burner/Disposable Domains

| Mechanism               | Effectiveness                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| (a) No free-mail        | Partial — blocks obvious free-mail; a real, aged, MX-valid $1 burner domain passes syntactic checks                 |
| (b) One-eval-per-domain | Partial — caps reuse of _same_ domain; doesn't stop registering a _new_ $1 domain per cycle                         |
| (c) $0 card auth        | Partial — forces real card into loop; $0 auths don't verify card-holder matches claimed company                     |
| (d) Manual review       | **Strongest** — catches pattern (brand-new domain, no corporate website, WHOIS privacy flag, no LinkedIn footprint) |
| (e) Watermarking        | No (downstream, doesn't prevent grant)                                                                              |
| (f) Deny-set            | No (prevention), but reactive revocation on flag                                                                    |

**Honest ceiling:** Domain-age is weak against patient abusers who spend $1 + wait 30 days. Manual review catches obvious laziness; a 2–3-minute human glance misses moderately-sophisticated impersonation.

### Pattern 2: Domain Squatting / Lookalike

| Mechanism               | Effectiveness                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| (a) No free-mail        | Weak — a lookalike domain _is_ a valid company-style domain; the control by design can't distinguish "real Acme domain" from "acme-cnsulting.com" without external company-identity cross-check                    |
| (b) One-eval-per-domain | No — the squat domain is distinct from the real company's                                                                                                                                                          |
| (c) $0 card auth        | Partial — billing-name/address mismatch vs. claimed company is a real signal; requires operator to cross-check manually                                                                                            |
| (d) Manual review       | **Strongest** — human checking "does this domain resolve to a corporate site, does the applicant's LinkedIn/role match, does the domain look like a plausible typo" is the only mechanism capable of catching this |
| (e) Watermarking        | No (post-grant)                                                                                                                                                                                                    |
| (f) Deny-set            | Indirect (reactive)                                                                                                                                                                                                |

**Honest ceiling:** No automated way to prove "this domain really belongs to company X" without a third-party KYB verification service (not included in Caisson's floor mechanisms). Manual review is the only lever.

### Pattern 3: Serial Evaluators (One Actor, Many Accounts)

| Mechanism                            | Effectiveness                                                                                                                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) No free-mail                     | Partial — validates individual applications; doesn't link applications together                                                                                                                                                                                 |
| (b) One-eval-per-domain + global cap | **Strong but incomplete** — global cap bounds _total_ attempts; per-domain uniqueness alone is defeated by N different domains (each individually compliant)                                                                                                    |
| (c) $0 card auth                     | **Strong, if fingerprint-checked** — card _fingerprint_ reuse across applications is the single highest-signal cross-account link (per Stripe, SEON, Sardine literature); but only if Caisson checks `card.fingerprint` collisions, not just "did auth succeed" |
| (d) Manual review                    | Moderate — catches it if a human is shown cross-application correlation (same IP/device/card); review-in-isolation won't surface the pattern                                                                                                                    |
| (e) Watermarking                     | No (doesn't prevent re-application)                                                                                                                                                                                                                             |
| (f) Deny-set                         | No (targets post-expiry misuse, not repeat requests)                                                                                                                                                                                                            |

**Critical gap:** None of Caisson's six floor mechanisms include a device-fingerprint or payment-fingerprint _cross-linking_ layer — this is the single most consistently-cited defense in industry literature (Stripe, Stytch, SEON, Sardine, TrustSig) and is currently absent.

### Pattern 4: Repost-to-GitHub / Public Leak

| Mechanism                        | Effectiveness                                                                                                                                                                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a)–(d)                          | No (pre-grant gates; irrelevant once legitimate evaluator has source)                                                                                                                                                                                     |
| (e) Per-eval watermarking        | **Necessary but not sufficient** — establishes _whose copy leaked_ once found; doesn't _detect_ the leak itself. Requires pairing with active monitoring (GitGuardian honeytoken pattern, or scheduled GitHub Code Search sweep for the watermark token). |
| (f) No-redistribution + deny-set | Provides the _legal_ and _access-revocation_ lever (not detection); enables DMCA takedown once a leak is found (precedent: Anthropic Claude Code, 8.1K repos taken down in one DMCA notice).                                                              |

**Real precedent:** Anthropic's 2026-03-31 DMCA takedown against Claude Code npm source leak (broadcast packaging accident → mass forking → DMCA against entire network) shows the mechanism works at scale. GitHub's EULA process can handle "take down this entire fork network" in one legal action.

**Detection gap:** Active monitoring (GitGuardian's honeytoken feature, or a scheduled sweep of GitHub for the unique watermark string) is the missing piece in Caisson's current floor. Watermarking provides the _attribution_ (whose copy is this); monitoring provides the _discovery_ (is it on GitHub).

### Pattern 5: General Trial-Abuse Prevention Frameworks

**Industry consensus ("one trial per company"):**

- Stripe, Stytch, SEON, Sardine, TrustSig all recommend **device-fingerprint + payment-fingerprint linking** to detect multi-accounting across nominally-different applications.
- Keygen's own trial-license best-practice pattern (used by other vendors on Keygen): separate "trial" vs. "paid" policies, with machine-ID dedup (`UNIQUE_PER_POLICY` fingerprint) to block repeat trials from the same hardware.
- Quick License Manager (QLM, commercial trial-license platform): `maxRegistrationsPerUser`, `minimumDaysBetweenTrials`, `preventMultipleRegistrationsPerProduct`, `numberOfTrialLicensesAllowedPerClient` keyed on machine ComputerID.

**Verdict:** Caisson's current floor mechanisms (email verification, domain cap, card auth) are all _static_ gates. The most-cited industry defense against serial abuse is _linking_ — device fingerprint + payment fingerprint cross-referencing across applications. Adding this layer would materially raise the bar against the Pattern 3 (serial evaluator) attack.

---

## Candidate End-to-End Verification-Flow Designs

**All three options below map against ADR-0274's floor (verified work email, one-eval-per-domain + global cap, $0 card auth, operator review queue, watermarking, no-redistribution terms, deny-set on expiry). The differences are in automation vs. manual, cost, and coverage against abuse patterns.**

### Option 1: Cheap & Manual ("Operator-Intensive")

**Flow:**

1. **Applicant submits eval request** via a form (email, company domain, brief use case).
2. **Automated pre-gate:** MX check (free DNS), domain-age check (free RDAP), disposable/free-mail filter (free static list or $0.00045/check).
   - _Reject if: no MX, domain <30 days old, free-mail provider, known disposable._
3. **Operator manual review** (~2–3 min): WHOIS domain history, LinkedIn glance, website reality-check.
   - _Reject if: obvious fake (new domain, no corporate site, no LinkedIn footprint), typosquat of known company, already approved competitor under different domain._
4. **If approved:** Generate eval-grant with:
   - Unique watermark (UUID + company name embedded in tarball).
   - 14-day expiry (set `next_billed_at` = today + 14 days).
   - Deny-list entry recorded for revocation on expiry.
5. **Delivery:** Tarball download or npm private registry link (credentials scoped to this eval only).
6. **Expiry:** Deny-set applied automatically; source access revoked.

**Cost:**

- Tooling: $0 (free MX + RDAP + disposable list).
- Operator labor: ~2–3 min/request.
- Watermarking: ~1 min (embedded UUID + comment).
- **Throughput:** ~15–20 requests/day before human fatigue risk.

**Coverage:**

- **Burner domains:** Caught by domain-age + manual review (catches the obvious ones; patient 30-day waits pass).
- **Squatting:** Caught by manual review (LinkedIn/website check).
- **Serial evaluators:** Not caught (no device/payment fingerprinting; one eval-per-domain cap only).
- **GitHub leaks:** Watermark provides attribution; requires manual GitHub search or DMCA monitoring.

**Best for:** Operator with time; single-digit evals/day; high trust in manual judgment; low volume justifies no automation investment.

---

### Option 2: Moderate Automation ("Hybrid Manual-Automated")

**Flow:**

1. **Applicant submits eval request** with email, company domain, company size (optional but requested).
2. **Automated pre-gate:**
   - MX + domain-age (free).
   - Disposable detection (free static list).
   - Company enrichment lookup (optional, Apollo.io or Hunter.io, $0 if not found → no cost for unknowns).
   - **Risk scoring:** domain-age + enrichment-found + employee-count-plausible → a scored recommendation ("auto-approve," "manual review," "auto-reject").
3. **Conditional manual review:**
   - "Auto-approve" (aged domain, enrichment found, plausible company): operator skips, grant issued automatically.
   - "Manual review" (borderline): operator does the 2–3 min glance.
   - "Auto-reject" (brand-new domain, no enrichment, or flagged as disposable): denied with standard reason ("company domain too new; please apply again after 30 days").
4. **Payment-fingerprint tracking (optional add):** if using Paddle checkout for card auth, record `card.fingerprint` hashes and flag if the same card is reused across nominally-different applicants within a week (alerts operator to potential multi-accounting).
5. **Watermarking + expiry** (as Option 1).

**Cost:**

- Tooling: $0–$50/mo (optional enrichment API tier).
- Operator labor: ~30 sec/request (review + auto-approve only for borderline cases).
- **Throughput:** ~40–50 requests/day.

**Coverage:**

- **Burner domains:** Caught by automation + optional manual (reduces false-negatives for borderline cases).
- **Squatting:** Manual review for borderline cases.
- **Serial evaluators:** Partially caught (card-fingerprint alerting flags suspicious reuse; operator can then investigate).
- **GitHub leaks:** Watermark + optional automated GitHub Code Search sweep for the watermark token string (GitGuardian-style, could be a scheduled job).

**Best for:** Operator expecting 20–50 evals/week; wants to automate the obvious accepts/rejects; manual review for ambiguous cases; card-fingerprint visibility as an early-warning layer.

---

### Option 3: Scaled Automation ("Mostly Hands-Free")

**Flow:**

1. **Applicant submits eval request** (email, company domain, company size, use case).
2. **Automated scoring pipeline:**
   - MX + domain-age + RDAP data.
   - Disposable detection (paid API, $0.003–$0.01/check, covers new-domain disposables).
   - Company enrichment (Apollo.io or Hunter.io, $0 if not found).
   - Device fingerprint (optional: Stytch or SEON device signal, if integrating card auth via Paddle — extra cost ~$49–99/mo for the service tier, but gives per-device multi-account detection).
   - Payment-fingerprint tracking (via Paddle integration, if card auth is enabled).
   - **ML-trained risk scorer** (trained on 100+ historical applications, flagging combinations like "new domain + no enrichment + free MX + same device as previous rejected applicant" → likelihood of fraud).
3. **Outcome:**
   - **Score ≥ 0.9 (auto-approve):** grant issued immediately, no operator touch.
   - **Score 0.5–0.9 (review queue):** sent to operator for a quick 1–2 min final check.
   - **Score < 0.5 (auto-reject):** denied with templated reason.
4. **Real-time deny-set application:** on expiry or abuse-flagging, deny-set applied within minutes (automated revocation).
5. **Automated GitHub leak detection:** scheduled hourly GitHub Code Search sweep for the unique watermark UUIDs; on finding, automated DMCA prep (generates draft notice, alerts operator).

**Cost:**

- Tooling: $50–200/mo (enrichment, device-fingerprinting, ML trainer).
- Operator labor: ~1 min per review-queue item (maybe 5–10% of requests).
- **Throughput:** 200+ requests/week.

**Coverage:**

- **Burner domains:** Caught (ML learns the pattern; new-domain disposable detector).
- **Squatting:** Partially (enrichment + domain WHOIS history in scoring).
- **Serial evaluators:** Caught (device fingerprint, payment fingerprint, and timing patterns all feed the scorer).
- **GitHub leaks:** Automated detection + DMCA prep.

**Best for:** Operator expecting 100+ evals/week at launch; tolerates false-positive/negative tradeoff; ongoing ML refinement; wants to minimize manual review labor and stay ahead of multi-accounting attacks.

---

## Summary & Recommendation

**Immediate next step:** Pick one of the three flows above as the baseline, then lock it into a SPEC (per ADR-0274's "rider: verification thresholds stay operator-tunable config, not code constants").

**Key decision points before drafting SPEC:**

1. **Domain-age threshold:** 30 days (phishing-baseline) or 90 days (higher bar for business legitimacy)? Option 1/2 can reach 30; Option 3 has the ML flexibility to adjust after observing abuse patterns.

2. **Device/payment-fingerprint cross-linking:** Is multi-accounting detection critical to launch, or a Phase-2 add? (Option 3 includes it; Options 1/2 skip it, leaving a known gap against Pattern 3.)

3. **Card auth via Paddle:** Does Caisson use Paddle's free-trial checkout + card-on-file (closest to "$0 auth")? Or skip the card-auth layer and rely on email verification + operator review only?

4. **Watermarking + leak detection pairing:** Is watermarking alone (attribution-on-discovery) sufficient, or does Caisson want scheduled GitHub searches for the watermark token (GitGuardian-style, implies Option 3 automation)?

5. **Operator throughput expectation:** 1–20 evals/day (Option 1) vs. 20–50/day (Option 2) vs. 100+ evals/week (Option 3)?

**Launchable today (before code):** Option 1 (cheap, manual, no vendor dependencies, operator judgment-heavy). Ship 14-day evals with watermarking + manual domain checks; refine based on observed abuse patterns; graduate to Option 2/3 if volume justifies automation.

---

## References

All citations retrieved 2026-07-07. See detailed findings above for URL links and extended discussion per section.

**Section A (Comparable Vendors):**

- Metabase: metabase.com/pricing, GitHub metabase/metabase enterprise/ license.
- Keygen: keygen.sh/docs + Fair Core License + DOSP lineage.
- Sidekiq: sidekiq.org/wiki/Commercial-FAQ + GitHub sidekiq/sidekiq COMM-LICENSE.txt.
- JetBrains: jetbrains.com/help/pycharm/register.html + GitHub JetNinja + Gist "JetBrains IDE trial reset."
- Unreal Engine: web.archive.org snapshot + GitHub SleepTheGod/Unreal-Engine-Source-Code + forums.unrealengine.com incidents.
- n8n: GitHub vektormemory/n8n-enterprise fork + maintained Gist patch.
- Neo4j/ONgDB: federal court damages order (storage.courtlistener.com) + litigation precedent.
- DevExpress/Telerik: warez sites nulledfrm.com, downloaddevtools.com, digitalcrackpro.com (2026 listings).

**Section B (Email Verification):**

- Disposable detection: Rohithzr/email-provider-filter (141K+ domains), Kickbox/ZeroBounce/Mailgun pricing.
- RDAP: lissy93/who-dat + rdapapi.io + whoisxmlapi.com.
- Enrichment: HubSpot Breeze Intelligence (formerly Clearbit) + Apollo.io + Hunter.io + Abstract API pricing.
- LinkedIn: Nubela post-mortem + LinkedIn Corp. v. Nubela (N.D. Cal. 2025) + hiQ Labs v. LinkedIn (9th Cir. 2022).
- Manual review: PYMNTS Intelligence KYC/KYB benchmarking + supplier-vetting guide (source.reevol.com).

**Section C (Paddle):**

- Paddle Billing docs: developer.paddle.com/build/trials + API reference.
- Free-trial mechanics: https://developer.paddle.com/build/trials/create-trial.
- Zero-amount transaction: `update-payment-method-transaction` for existing subscriptions only.

**Section D (Watermarking):**

- Stegsnow: manpages.org + Sucuri Blog (PHP malware, 2021-02-02).
- SrcMarker: arxiv.org 2309.00860 (IEEE S&P 2024).
- BetterGuard, Stunnix/jo, javascript-obfuscator: vendor pages + GitHub docs.
- @vektormemory/prov: dev.to + Medium writeups (author self-published).
- Prettier evasion: prettier.io/docs/rationale + GitHub prettier/prettier issue #6793.
- Terser: terser.org docs.
- Clean-room defeat: Simon Willison "chardet LGPL relicensing" (2026-03-05/06) + ccleaks.com Claude Code analysis.
- Formal robustness: arxiv 2403.17983 ("Is Watermarking of LLM-Generated Code Robust?") + arxiv 2507.05512 ("Disappearing Ink").

**Section E (Abuse Patterns):**

- Disposable/domain-age: domain-age phishing research (Allure Security, 2026-02-18) + IPQS 40% abuse-infrastructure stat.
- Serial evaluators: Stripe "Detecting Fake Users and Multiaccount Abuse" (2026-04-18) + "Preventing Free Trial Abuse" (2026-05-04) + dev.to "Card Fingerprint Field Could Save You from Fraud" (2025-05-14) + Stytch docs + SEON docs.
- GitHub leaks: GitHub DMCA policy + Anthropic case (github/dmca 2026-03-31) + GitGuardian docs (honeytoken) + GitHub 2026-07-01 secret-scanning announcement.
- Case studies: Ars Technica "Yellow Dots" (2017-06-06) + "Canary Traps" (2026-05-04) + Cult of Mac (2023-05-10) + 404 Media Automattic/P2 (2025-04-16) + Jurie Horneman Ambermoon (2023-05-18).
