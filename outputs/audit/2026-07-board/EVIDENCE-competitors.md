# Evidence: Competitive & Category Deltas — Phase-0 Board Audit

```
collector: Phase-0 evidence collector C (gw-market-intel lane)
window:    2026-07-09 → 2026-07-22/23 (deltas since baseline dates only)
baseline read first: outputs/research/market-competitive-analysis.md (Perplexity Computer,
  2026-06-27, imported 2026-06-29) + outputs/research/market-intel-2026-07-09.md
  (first gw-market-intel monthly run) — both in caisson-audit-ro (read-only mirror)
also read (in-repo, post-baseline, treated as prior art not re-derived):
  outputs/research/auditkit-gap-category-sweep-2026-07-19.md,
  outputs/research/sentrik-socket-supply-chain-recon.md (2026-07-13),
  outputs/research/agent-runtime-audit-2026-07-15.md,
  outputs/research/agent-runtime-options-expansion-2026-07-16.md (internal build-decision
  docs, referenced only where they carry competitor facts)
sources this session: mcp__exa__web_search_advanced_exa (date-filtered ≥2026-07-09) +
  mcp__crawl4ai__md (live vendor pages) + mcp__pal__chat (openai/gpt-5.2 via OpenRouter,
  ranking sanity check per rule 4)
scope note: this is a WATCH document, not a decision. No pricing calls, no positioning
  locks. Per explicit task instruction, NO Linear tickets were drafted this run — see
  "Pending Linear" note at the end instead of a filed-tickets section.
```

## How to read this

Each baseline watch-item gets an explicit line — "no movement, checked" is evidence, not
a skipped row (rule 2). New items this cycle are numbered E-C1... in **PAL-adjusted
threat/opportunity rank** (`mcp__pal__chat`, openai/gpt-5.2, continuation
`20f278c3-5f12-4d25-9a73-ea093db63f6c` — my draft order was reordered on its
recommendation; see the note under E-C5). Rank = proximity to Caisson's compliance/
AI-governance wedge × recency × source credibility.

---

## E-C1. Sentrik — vague early-access → fully-packaged direct competitor (rank: highest)

**Status: MOVED, high confidence.** The 2026-07-13 in-repo recon note
(`outputs/research/sentrik-socket-supply-chain-recon.md`) described Sentrik as early-access,
"6 standards packs, 193 rules" free tier, contact-gated paid pricing, unclear
funding/incorporation. Live crawl today (sentrik.dev, 2026-07-22) shows a materially more
developed product:

- **632 rules across 26 frameworks** (SOC2, HIPAA, PCI-DSS, ISO 27001, GDPR, EU AI Act,
  NIST 800-53, CMMC 2.0, IEC 62304, DO-178C, ISO 26262, MISRA-C, 21 CFR Part 11, + more).
- **Agent task-scope binding**: `sentrik task-bind "<intent>" --path "<glob>"` — an AI agent
  declares its authorized file scope; Sentrik flags and blocks the moment it writes outside
  that scope, with a signed, tamper-evident incident record. This is close to a 1:1 overlap
  with Caisson's own "governed AI execution + evidence pack" positioning
  (`agent-runtime-audit-2026-07-15.md`'s framing of Caisson's differentiation).
- **Signed attestations** (`sentrik attest`, HMAC-SHA256, per-commit, verifiable), an
  **auditor portal** (read-only, token-gated evidence sharing), **air-gapped/offline license
  validation**, and a **"Vibe Coding Risk Score" lead-gen quiz** funnel.
- Pricing: Free (6 packs/193 rules, unchanged from 07-13) → Team/Organization/Enterprise,
  all still contact-gated — no published numeric price tiers as of this crawl.
- Cites a16z's "Everything, Everywhere is Compliance" (May 2026) and the same EU AI Act
  Aug 2 / Dec 2027 dates Caisson's own materials use.

**Why it matters:** of everything found this cycle, this is the single closest positioning
mirror — TypeScript-adjacent (multi-language, but the MCP/Claude Code/Cursor integration is
front-and-center), agent-governance-plus-evidence-pack shaped, moving fast. Not yet
commercially proven (still contact-gated pricing, no funding record), but the product
surface closed most of the gap versus Caisson's own pitch in 9 days.

**Evidence:** sentrik.dev, crawled 2026-07-22 (live product); prior state:
`outputs/research/sentrik-socket-supply-chain-recon.md`, 2026-07-13.

---

## E-C2. Comp AI + Probo — two significant entrants the 2026-07-09 baseline missed (rank: 2nd)

**Status: NEW, high confidence.** Neither appears anywhere in `market-competitive-analysis.md`
or `market-intel-2026-07-09.md`. Both surfaced in an internal 2026-07-19 category sweep
(`auditkit-gap-category-sweep-2026-07-19.md`) and are confirmed live and larger by
traction than AuditKit.dev — the 07-09 baseline's #1-ranked threat.

- **Comp AI** (`trycompai/comp`): **1,689 GitHub stars**, active Discord, AGPLv3 open-core +
  commercial `/ee`. "AI-native" GRC platform (SOC2/ISO27001/HIPAA/GDPR), Next.js/Prisma/T3
  stack — the largest OSS player found in the entire sweep. Framed by third-party coverage
  as "the standout choice for start-ups" (SolidSmack 2026 review, via Noah Intelligence,
  2026-06-16). Cloud pricing not itemized — site frames cost-avoidance ($30-150K
  "traditional" cost) rather than a price table.
- **Probo** (`getprobo/probo`): **1,227 GitHub stars**, MIT license (no `/ee` split — fully
  open), YC-backed (batch label inconsistent across sources — "YC X25" per aVenture,
  "YC P25" per multiple LinkedIn/startuphub.ai posts; funding figures also conflict: $500K
  per aVenture/LinkedIn vs. $3M Series A per startuphub.ai — **unreconciled, flag for
  next cycle**). Full GRC lifecycle: risk register, access-review campaigns, vendor risk
  (automated site assessment, DPA/BAA), DPIA/TIA, Statement of Applicability, public
  "Compliance Page," 270+ MCP tools, `prb` CLI. Real HN traction (2 separate Show-HN
  threads, a Shipfox.io customer testimonial). **Positioning note:** current live marketing
  copy (saashub.com listing, checked 2026-07-12) frames Probo as **"Compliance, Done for
  You"** — a managed-service framing — layered on top of the open-source core, a shift from
  the pure self-hostable-platform framing the 07-19 internal sweep described. If this
  services drift continues, it moves Probo toward Caisson's own documented "loss condition"
  (buyer needs managed services) rather than deeper into the "owned code" overlap — worth
  re-checking next cycle, not resolved here.

**Why it matters:** both exceed AuditKit's traction (2★, 3 contributors per the 07-19 sweep)
by roughly three orders of magnitude in GitHub stars. The baseline's compliance-wedge threat
ranking under-weighted the category because it only found AuditKit — the real OSS-GRC
frontier is bigger and more credible than one vendor.

**Evidence:** github.com/trycompai/comp; github.com/getprobo/probo; noah-news.com
2026-06-16; aventure.vc/companies/probo-san-francisco-ca-us, 2026-06-25;
startuphub.ai/startups/probo, 2026-06-01; saashub.com/probo-status, checked 2026-07-12;
news.ycombinator.com/item?id=43100521 and id=42711545 (Probo Show-HN threads, both
pre-window but still the cited buyer-pain evidence); full category table in
`auditkit-gap-category-sweep-2026-07-19.md` §1.

---

## E-C3. AuditKit.dev — capitalizes on the Delve scandal directly + ships an adjacent free tool

**Status: MOVED, high confidence** (direct crawl, 2026-07-22). Since the 07-09 baseline:

- Homepage now leads with **"Trust matters — After Delve"** and **"After the Delve scandal —
  where 494 fake SOC 2 reports were exposed — auditors want proof your evidence is real"** —
  AuditKit is using the exact same scandal Caisson's own briefing flagged as GTM ammunition,
  in its own landing copy, ahead of Caisson.
- Shipped a **new free/OSS tool, `aidevshield`** ("like `npm audit`, but for AI workflows") —
  a CLI security scanner for AI-coding-tool configs (prompt injection in CI workflows, npm
  lifecycle-script supply-chain attacks, hidden-Unicode backdoors in `.cursorrules`/AI config
  files). This is a new acquisition/community surface adjacent to, but distinct from, its
  core audit-log SDK — and edges toward the AI-agent-config-security territory Sentrik
  (E-C1) and Caisson's own Agentic-Dev bundle also touch.
- **Pricing-page inconsistency, flagged not resolved:** the FAQ section states Free (1K
  events, 7-day retention) → Pro $39/mo → Business $99/mo → Supersize $349/mo, while the
  pricing cards on the same page show Starter $99/mo → Pro $299/mo → Business $499/mo →
  "Supersize + Milkshake" $999/mo. Net range is unchanged from the 07-09 baseline ($99-999/mo
  top-line), but the two in-page numbers don't reconcile — either a mid-restructure caught
  half-published, or stale FAQ copy. Re-check next cycle; not a pricing call (routes to
  `gw-pricing-analyst` if it matters).

**Evidence:** auditkit.dev, crawled 2026-07-22 (homepage + pricing section); prior state
`market-intel-2026-07-09.md` §Ranked-findings-#2 and `auditkit-parity-2026-07-10.md`.

---

## E-C4. Microsoft Agent Governance Toolkit — expanded scope since the 04-02 initial ship

**Status: MOVED, medium-high confidence.** Baseline (07-09) had this as a "longer-horizon,
medium confidence" watch item based on the original 2026-04-02 open-source announcement.
New coverage (2026-07-07, Noah Intelligence, secondary source — flag accordingly) describes
a materially expanded scope: **execution containers** (a controlled runtime that evaluates
agent actions before they proceed, not just post-hoc monitoring) plus an Agent Governance
Toolkit now spanning **seven packages across Python, TypeScript, Rust, Go, and .NET**, a
**stateless policy engine checking agent actions against security rules in under a
millisecond**, and **cryptographic agent identity**.

**Why it matters:** the TypeScript package specifically lands in Caisson's own language/stack
lane, and "free from Microsoft" remains the hard price floor the 07-09 baseline already
flagged against Caisson's Agentic-Dev bundle ($329, its narrowest edition). This is
escalation of an existing watch item, not a new one — but the addition of TS support and a
sub-millisecond runtime policy engine narrows the gap between "watch" and "urgent."

**Evidence:** noah-news.com/microsofts-new-runtime-controls-introduce-rigorous-governance-for-autonomous-ai,
2026-07-07 (secondary aggregator — recommend an operator pass to find Microsoft's own
primary announcement before treating package/timeline specifics as final).

---

## E-C5. Delve scandal — escalated, now entangled with a named AI-Production-Kit competitor (LiteLLM)

**Status: MOVED, mixed confidence — split the fact from the inference.** PAL's review
recommended NOT ranking this #1 despite its high salience, because the most consequential
claim rests on weak sourcing; recorded here as advised.

**Confirmed, high credibility (multiple independent infosec outlets, 2026-07-09/07-10):**
Darktrace detected a compromised AWS EC2 instance ("LiteLLM-Proxy") — running **LiteLLM**,
the open-source AI gateway named in Caisson's own baseline competitor matrix
(AI Production Kit section) — hijacked for cryptomining after a credential-theft malware
incident, with privileged Amazon Bedrock access. Corroborated by SiliconANGLE, hackread.com,
expertinsights.com, cyberpress.org, all dated 2026-07-09/07-10, describing the same
Darktrace-attributed incident consistently.

**Asserted, LOW credibility — needs a cross-vendor check before use, not yet usable in
board materials as fact:** a cluster of aggregator/content-mill sites (xix.ai,
sparechangegames.org, raycologon.com, hallofhorrors.com, openarmsproject.org,
yfgcinternational.com, bridgewaterretirement.org — none a recognized outlet, several reading
as templated/SEO-generated prose) claim LiteLLM had obtained security certifications through
**Delve** specifically, and that LiteLLM subsequently **dropped its Delve partnership** and
is "redoing security certifications" as a result — i.e., the Delve scandal (already flagged
07-09) allegedly caused a second named competitor's compliance posture to unravel. This
would be a genuinely notable cross-competitor domino if true (Delve's collapse damaging
LiteLLM's own trust story), but it comes from sources this collector cannot vouch for.

**Recommendation carried to Gaps:** run a `gw call`/PAL cross-vendor check (or ask the
operator to check LiteLLM's own GitHub security advisories / blog directly) before citing
the LiteLLM-Delve decoupling claim anywhere board-facing. The malware/cryptomining fact
itself is solid; the compliance-vendor entanglement is not, yet.

**Evidence:** siliconangle.com/2026/07/09/darktrace-finds-ai-gateway-amazon-bedrock-access-hijacked-cryptomining;
hackread.com/ai-gateway-amazon-bedrock-hijacked-cryptomining; expertinsights.com/news/amazon-bedrock-ai-gateway-compromised-cryptomining-malware,
2026-07-09; cyberpress.org/ai-gateway-amazon-bedrock-cryptomining, 2026-07-10 (confirmed
facts). xix.ai/ainews/litellm-drops-controversial-delve-plugin-amid-access-layer-scrutiny,
2026-07-16, and 4 similar aggregator posts 2026-07-14→07-22 (unconfirmed claims).

---

## E-C6. EU AI Act Article 50 (Aug 2, 2026) — confirmed unmoved; a "delayed to 2027" rumor is circulating and being debunked

**Status: MOVED (clarified), high confidence.** Baseline (07-09) already flagged this as
"confirmed not extended by the Digital Omnibus" with 24 days to go. Since then:

- The **European Commission published its own Article 50 interpretive guidelines on
  2026-07-20** (nicfab.eu, digital-strategy.ec.europa.eu — primary EC source), aimed at
  helping providers/deployers meet the transparency obligations that apply from 2026-08-02.
- Multiple independent legal/compliance sources (astraea.law 2026-07-18, licentium.io
  2026-07-17, dastra.eu 2026-07-17) confirm the date is unchanged; **letslaw.es published a
  piece titled "The EU AI Act Has Not Been Postponed... Regardless of What You May Have
  Read" (2026-07-15)**, explicitly debunking a rumor that had "taken hold" claiming the Act
  was pushed to 2027. The Digital Omnibus amendment did move the **high-risk** obligations
  timeline (per the baseline's own prior finding) — plausibly the source of the confusion —
  but Article 50 transparency obligations were never part of that deferral.

**Why it matters:** the timing-hook window from the baseline (24 days out on 07-09) is now
~10-11 days out. The market-confusion angle is new and double-edged: it's a live rumor
Caisson's own launch copy should not accidentally reinforce or get caught flat-footed by,
and correcting it authoritatively ("the deadline everyone thinks moved, didn't") is itself a
sharper content hook than the deadline alone.

**Evidence:** digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content;
nicfab.eu/en/posts/ai-act-art50-guidelines, 2026-07-20; astraea.law/insights/eu-ai-act-august-2026-us-companies,
2026-07-18; letslaw.es/en/the-eu-ai-act-has-not-been-postponed, 2026-07-15;
dastra.eu/en/blog/ai-act-transparency-rules-what-changes-august-2-2026, 2026-07-17.

---

## E-C7. Boilerplate competitors — no material movement beyond routine promo

**Status: NO MOVEMENT, checked 2026-07-22 (direct crawl).**

- **ShipFast** (shipfa.st): pricing unchanged — Starter $199 (list $299), All-in $249 (list
  $349), +CodeFast bundle $299 (list $648). Identical structure to the 07-09 baseline.
- **MakerKit** (makerkit.dev/pricing): running a **"Summer Flash Sale — 20% off"** promo
  ($349→$279.20 lifetime Pro; $649→$519.20 Teams) through 2026-07-31 — a seasonal discount,
  not a structural pricing change. MCP-server/AI-agent-rules messaging (flagged as the
  category's #3 threat in the 07-09 baseline) is unchanged, still headline-positioned.
- **Supastarter**: **still could not verify.** `crawl4ai` returned a 500
  (`correlation b120388af623`) on `supastarter.dev/pricing` again this cycle — the exact
  same failure mode as the 07-09 baseline (different correlation ID, same 500). This is now
  two consecutive monthly cycles unable to reach this vendor's pricing page. Recommend an
  operator-run manual check or a different fetch path next cycle rather than a third
  automated retry.

**Evidence:** shipfa.st, makerkit.dev/pricing, both crawled 2026-07-22; supastarter.dev/pricing
crawl4ai error, 2026-07-22.

---

## E-C8. Vanta / Drata / Secureframe — no self-serve tier found this cycle either

**Status: NO MOVEMENT, checked 2026-07-22.** Searched specifically for a new self-serve or
developer-priced tier from any of the three; found none. One tangential data point: a
third-party network-security tool, **NSAuditor AI Enterprise**, shipped GRC "push"
connectors for Vanta and Drata (0.32.0) and added Secureframe (0.32.2, 2026-07-10/11) — it
pushes a compliance scanner's evidence _into_ these platforms' workspaces, it is not a
pricing or product move _by_ Vanta/Drata/Secureframe themselves, and it's a network/infra
scanner (AWS/Azure/GCP config auditing), not a Caisson-shaped code-embedded compliance
library. Noting as a minor watch item (E-C11 below), not a change to this row's verdict.
The 07-09 baseline's read — real DX investment, list pricing still enterprise-quote-only
($7.5K-$100K+/yr) — holds unchanged.

**Evidence:** search across 6+ pricing-comparison and vendor-blog sources, 2026-07-22, no
new self-serve tier found; network-security-magazine.com/.../nsauditor-ai-ee-0-32-2-grc-trio-secureframe,
2026-07-11 (tangential).

---

## E-C9. Evidentia (Polycentric-Labs) — incremental version bump only

**Status: NO MATERIAL MOVEMENT, checked 2026-07-22.** Baseline (07-09) cited v0.10.17,
"shipped the day of that briefing," 5 stars/1 fork, no commercial motion. GitHub releases
page today shows the project has advanced to **v0.11.0** — active development continues, but
no material change to the competitive read: still Python-stack (no direct TS-buyer overlap),
still no visible commercial motion. Watch item stands as-is.

**Evidence:** github.com/Polycentric-Labs/evidentia/releases, checked 2026-07-22.

---

## E-C10. Adjacent capital signals — different ICP/lane, mixed confidence, noted for context only

**Status: NEW, informational — not direct Caisson competitors.** Surfaced incidentally while
searching for Sentrik/Delve follow-ups. None target Caisson's TS-boilerplate-buyer ICP
directly, but each validates a piece of the "AI needs a trust/compliance layer" thesis the
baseline's Trends section already asserts.

- **Hadrius** — $27M combined Seed+Series A (Series A $22M led by CRV + YC + Pathlight,
  announced 2026-07-14), "agentic compliance infrastructure" for **financial-services**
  firms (RIAs/broker-dealers) — a different buyer (CCOs at investment advisers), not a
  software/SaaS compliance-as-code buyer. Real traction claimed (500+ firms). Context only.
- **Meticulous** — $15M Series A led by Chemistry (2026-07-15/16), London-based, "AI-code
  verification" — automated testing/edge-case simulation for AI-generated code (Notion,
  ElevenLabs, Dropbox, Wiz, LaunchDarkly customers claimed). Adjacent to the "trust layer
  for AI-generated code" narrative but a **testing** company, not compliance/audit — a
  different lane from Caisson's wedge, still a capital-market signal that the thesis has
  investor appetite.
- **SynthetIQ** — a claimed $175M Series C ($265M total) for "regulated AI workflow
  automation," reported 2026-07-16. **LOW CONFIDENCE — flagging, not asserting.** Single
  source (techdailyshot.com), templated/generic-sounding copy, no corroborating outlet
  found, no verifiable company presence checked. Treat as unverified until a second
  independent source confirms; do not cite as fact.

**Evidence:** hadrius.com/insights/series-a and prnewswire.com/news-releases/hadrius-raises-27-million...,
both 2026-07-14; techfundingnews.com/ai-writes-code-faster-than-developers-can-review-it...,
2026-07-16; eustartups.news/london-ai-code-verification-startup-meticulous-raises-15m-series-a-led-by-chemistry,
2026-07-15; techdailyshot.com/blog/synthetiq-raises-175m-automate-regulated-ai-workflows,
2026-07-16 (low confidence, single source).

---

## E-C11. NSAuditor AI — new minor watch item, not a direct competitor

**Status: NEW, low urgency.** A network/infra security-auditing tool (AWS/Azure/GCP config
scanning across SOC2/HIPAA/NIST-CSF/PCI-DSS/ISO27001/CIS/GDPR) shipping an MIT-licensed
Community Edition plus a paid Enterprise tier, with GRC "push" connectors to Vanta, Drata,
and (as of 0.32.2, 2026-07-10/11) Secureframe. Different shape from Caisson (infra-config
scanner, not an embedded application-level compliance library) — noted as a category-scan
data point, not a threat requiring action.

**Evidence:** network-security-magazine.com, 3 release posts 2026-07-10 through 07-13.

---

## E-C12. Carried forward, not re-verified this cycle — explicit gap, not a "no movement" claim

Per rule 2, every baseline item needs a line — these were not re-checked this session due to
research-budget prioritization toward the higher-weighted items above. No contrary signal
was found for any of them incidentally; that is a research gap, not a confirmed "still
stable" finding. Re-check next cycle:

- **SaaS Pegasus** (07-09 baseline: 50%-off sale + "Built for the AI Era" section, Django
  stack) — not re-crawled.
- **create-t3-app / create-t3-turbo ecosystem** — not re-checked.
- **Nextless.js** ($699 premium AWS-serverless niche) — not re-checked.
- **"BoilerplateHub" aggregator** — not re-checked.
- **LangChain / LlamaIndex commercial moves** — not re-checked.
- **Eval/guardrails vendors** (Braintrust, Langfuse, Humanloop) — not re-checked.
- **HN/Product Hunt "compliance starter" / "AI starter kit" launches** — not specifically
  re-scanned this cycle (Sentrik, E-C1, was found via a different research thread, not this
  scan).
- **General SaaS pricing-model volatility** (one-time vs. subscription) — not re-checked.

---

## Gaps

1. **The LiteLLM-Delve decoupling claim (E-C5) is sourced only to low-credibility
   aggregators** — the single highest-priority open item. Recommend a `gw call`/PAL
   cross-vendor check or a direct look at LiteLLM's own GitHub security advisories/blog
   before this appears in any board-facing narrative as fact. The underlying malware/
   cryptomining incident is independently well-corroborated; the compliance-vendor fallout
   is not.
2. **Probo's funding figures and YC batch label are internally inconsistent across sources**
   ($500K vs. $3M raised; "YC X25" vs. "YC P25") — unreconciled, noted in E-C2, re-check.
3. **Supastarter pricing is now unverifiable for two consecutive monthly cycles** (crawl4ai
   500 both times, different correlation IDs) — recommend an operator manual check or an
   alternate fetch path (the `web_fetch_exa` fallback wasn't retried this cycle; do so next
   time before escalating further).
4. **E-C12's eight carried-forward items were not re-verified this session** — a deliberate
   scope cut under time/budget pressure toward the higher-weighted new findings, not a
   claim of continued stability.
5. **AuditKit's internal pricing-page inconsistency (E-C3) is unresolved** — could indicate
   an in-progress restructure; worth a follow-up crawl in 1-2 weeks rather than this cycle.
6. **Linear liveness was not checked and no tickets were drafted**, per this run's explicit
   scope instruction ("Do NOT draft Linear tickets for this run") — this is a scope
   decision, not a Linear outage. See "Pending Linear" note below for what would have been
   drafted had ticket-filing been in scope.
7. **PAL sanity check was run once** (`mcp__pal__chat`, openai/gpt-5.2, continuation
   `20f278c3-5f12-4d25-9a73-ea093db63f6c`) on the overall ranking, not per-item — if a
   specific item above needs a second-model consensus check (`gw consensus`), E-C5 is the
   one to prioritize (see Gap 1).

## Pending Linear (drafted here only — not filed, per this run's scope)

Had ticket-filing been in scope, the actionable items below would have been drafted (each
citing the evidence item above; no pricing or positioning calls — those route to
`gw-pricing-analyst` / `docs/state/decisions-and-forks.md` respectively):

1. **Competitive check: Sentrik (E-C1) vs. Caisson's agent-governance + evidence-pack
   surface** — feature-for-feature comparison, especially task-scope binding vs. whatever
   Caisson's Agentic-Dev bundle ships today.
2. **Competitive check: Comp AI + Probo (E-C2) vs. the Compliance bundle** — both exceed
   AuditKit's traction; the gap-analysis exercise AuditKit already got
   (`auditkit-gap-category-sweep-2026-07-19.md`) should extend to these two specifically.
3. **Verify or retract the LiteLLM-Delve claim (E-C5, Gap 1)** before any GTM copy
   references it.
4. **Correct-the-rumor content angle (E-C6)** — "the EU AI Act deadline everyone thinks
   moved to 2027, didn't" as a sharper hook than the deadline alone, time-boxed to before
   2026-08-02.
5. **Re-check AuditKit's pricing page (E-C3)** in 1-2 weeks for whether the FAQ/pricing-card
   inconsistency resolves into a real restructure.

## Operator decides

Every finding above is a ranked observation, not a decision, per this run's scope. The two
most sharply time-boxed items are the EU AI Act correct-the-rumor angle (E-C6, ~10 days
left) and verifying-or-retracting the LiteLLM-Delve claim (E-C5) before it reaches any
board or GTM material. Positioning responses to the new-entrant cluster (Sentrik, Comp AI,
Probo) and any pricing reaction to AuditKit route through their normal lanes
(`gw-pricing-analyst`, `docs/state/decisions-and-forks.md`) — not this document.
