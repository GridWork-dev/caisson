# OSS launch GTM research — caisson-oss (2026-07-10)

Synthesis of five research lanes (comparable launches · commit-history norms · repo craft ·
channels · positioning) into launch decisions for `caisson-sh/caisson-oss` — the read-only,
scope-renamed public mirror of the private Caisson monorepo (currently PRIVATE, one 416-file
snapshot commit, publish gated on a manual `confirm=publish` dispatch). Every claim carries a
URL + date; low-confidence claims are flagged inline.

---

## Executive summary

1. **Ship the single-snapshot repo as-is — it is the industry default, not a red flag.** Citus,
   OmbuLabs, Windows Calculator, and near-universal HN-documented practice all open private→public
   with a squashed/orphan initial commit for secret/IP/license scrubbing. Windows Calculator (30k+
   stars) drew zero criticism doing exactly this. (citusdata.com 2022-09-12; blogs.windows.com
   2019-03-06)
2. **The backlash fires on _unexplained_ thin history, not thin history.** A named company shipping
   a known commercial product with a real site forecloses the "is this AI-generated / is this legit"
   pile-on — as long as one README sentence states it is a generated mirror snapshot. (HN item
   47554056; HN item 47444192, both 2026)
3. **Never backdate or synthesize commits — ever, even cosmetically.** Backdated timestamps are the
   signature of documented repo-laundering ("Operation Long Shadow," 3,150+ laundered repos) and
   individually-caught IP-theft scams; author/date are trivially forgeable and increasingly
   auto-detected. (copyleftdev/long-shadow 2026-04-26; checkmarx.com 2022-07-15)
4. **Show HN is the anchor launch event for this product; Product Hunt is a secondary week-2 event.**
   Open-core compliance/devtool is the exact shape that lands engaged HN threads (Lumoar SOC2, Comp
   AI); multiple 2026 postmortems show PH underperforms for devtools without a pre-built list.
   (HN 43966471; indiehackers.com 2026-05-08)
5. **Sequence beats spike.** Show HN's star-impact half-life is ~24h and 92% is gone by 48h; the
   winning pattern across the cohort is a 10–14 day staged sequence + weeks of pre-launch
   groundwork, not a big-bang. The Cloudflare-tool PH case is explicit: "the launch boosted momentum
   that already existed." (danfking.github.io 2026-04-23; DEV 2026-06-01)
6. **Stars are a bad KPI in this category specifically.** ~6M suspected fake stars concentrate in
   AI/LLM/tooling repos (peer-reviewed, ICSE 2026); track `@caisson-sh/*` npm downloads,
   `create-caisson` completions, and issue/Discord latency instead. (arxiv.org/abs/2412.13459)
7. **Lock the license story BEFORE the launch thread.** Twenty flipped MIT→AGPL live in its Launch
   HN and survived, but "why isn't X open" is a predictable first comment — Caisson's Apache-2.0
   base / commercial-bundle split (ADR-0094/0097) must already read as settled. (HN 36791434
   2023-07-19)
8. **Lead the README with "compliance primitives live in code you own," not "pass an audit."**
   Vanta/Drata/Comp AI sell evidence-collection dashboards bolted onto existing infra; none ship WORM
   audit-log storage, field-crypto, or OSCAL-conformant RLS tenancy _as application source_. That is
   the real undefended gap. (trycomp.ai; workos.com 2026-05-06)
9. **"Bun-native" is a safe, uncontested claim today — but the window is closing.** Every
   commercially serious competitor is Node/npm; next-forge only moved to Bun-_as-package-manager_ in
   March 2026, not Bun-runtime-native. (vercel.com/changelog/next-forge-6 2026-03-13)
10. **Ship `llms.txt` for the coding-agent use case, never as an "AEO channel."** Five independent
    large datasets find zero AI-citation lift; but the benchmark-supported use (steer Claude
    Code/Cursor toward current bundle ids, away from legacy aliases — Stripe's pattern) is directly
    relevant to Caisson's alias-forever architecture and worth 30 minutes. (SE Ranking 300k domains;
    OtterlyAI 62,100 requests; llms-txt.io 2026-06-03)

---

## 1. Comparable launches

### Case-study table

| Project           | Launch shape                                                                      | Anchor channel                                | Time → traction                                                                | Where it is now                                                        | Key lesson                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Supabase**      | "Open-source Firebase alternative" alpha, timed to YC S20                         | HN (accidental pre-launch, then formal alpha) | 8→800 DBs in 3 days (accidental); 30k visitors / 1,400+ signups in launch week | 100k stars, 8M devs (2026-04)                                          | The _framing_ ("open source X alternative") did the work; they shipped a "beta" HN post 6 months later once product caught up                    |
| **Cal.com**       | Alpha "Calendso" built in ~3 weeks off a waitlist+Slack                           | Product Hunt                                  | #1 Day→Week→Month (Apr 2021)                                                   | OSS `cal.diy` (46k stars) split from commercial `cal.com` (~$5.1M ARR) | Brand was NOT locked at launch — renamed Calendso→Cal.com 5 months in without resetting momentum; later split OSS artifact from commercial brand |
| **Trigger.dev**   | Recurring multi-day "launch weeks"                                                | Launch week + PH re-launches                  | 4,000 stars by $3M seed (~9 mo)                                                | Multiple GA launch weeks through 2025                                  | Launch is a _cadence_, not an event — each week bundles GA features + a PH re-launch to re-trigger discovery                                     |
| **Infisical**     | Show HN + same-day Reddit + next-day newsletters                                  | Show HN (#3 front page)                       | ~90→3,000 stars in 2 months, purely organic                                    | 7k+ stars by mid-2023                                                  | Most copyable solo playbook: Reddit day-of (riding cofounder karma), TLDR/Console.dev day-after, Show HN with a multi-week "half-life"           |
| **Novu**          | Two Show HNs (different framings) + third-party PH                                | Show HN + PH                                  | steady compound                                                                | 38,584 stars (2026-02)                                                 | Multi-year compounding, not a single spike; PH pitched by an advocate, not the founders                                                          |
| **Documenso**     | Launched the _idea_ first — waitlist for a v0.1 that shipped "early 2023"         | Blog + build-in-public                        | ~4k stars (2023) → 10k (2025)                                                  | 13.7k stars, 34k+ users, 340+ paying customers                         | "Launch early" named as the single biggest lesson; category objection is legal-acceptance, not code                                              |
| **Twenty**        | Launch HN (YC format)                                                             | Launch HN                                     | 20k+ stars (+12k in 12mo), 280+ contributors by $5M seed                       | ~20k stars                                                             | Settled MIT→AGPL live in the thread; won the category-skepticism comment by naming a narrower wedge (SMB/UX), not disputing it                   |
| **Maybe Finance** | THE FLOP (twice) — closed SaaS died, OSS relaunch went viral then also wound down | Single viral tweet                            | 50k+ stars, 2M+ downloads in a year                                            | Archived unmaintained (2025-07); pivoted to B2B                        | **Stars ≠ revenue, proven twice**: self-hosted OSS "wildly popular," hosted commercial offering failed to convert                                |

Sources: startupfounderstories.com 2024-02-18; supabase.com/blog 2020-07-10 & 2026-04-02;
producthunt.com/stories 2021-05-26; cal.com/blog 2022-09-09; aiinsider.in 2026-05-17;
trigger.dev/launchweek/0 & /blog/3m-dollar-seed-round 2023-08-25; infisical.com/blog 2023-01-16;
ycombinator.com/launches/I6Z-infisical; githublb (novu) 2026-02-18; documenso.com/blog
2025-12-31; openpioneers.com 2024-07-24; HN 36791434 2023-07-19; tech.eu 2024-11-19;
newsletter.failory.com 2024-01-18; thebootstrappedfounder.com 2024-02-07; zachgollwitzer.com
2025-07-24.

### Lessons for Caisson

- **Star count ≠ revenue — twice over (Maybe Finance).** 50k stars and 2M downloads did not save the
  hosted product. Caisson's bundle/dashboard/support revenue needs its own conversion proof
  independent of `caisson-oss` star velocity. Don't let good HN reception become the success metric
  for the paid side.
- **The platform mix that actually worked is Show HN / Launch HN + a same-week Reddit + newsletter
  push**, not a single big-bang. Infisical's memo is the most copyable low-cost template.
- **License clarity locked before the thread** (Twenty survived a live flip, but don't rely on it).
- **Expect the category-skepticism comment on day one.** Twenty got "CRM value is integrations, not
  UI; incumbents took 15 years." Caisson's likely equivalent: "compliance is a trust/legal problem,
  not a code problem" (an exact echo of Documenso's own framing). Win it by naming a narrower
  beachhead, not by disputing it.
- **Real-money proof points travel further than stars.** The sources cited years later carry dollar
  or paying-customer numbers (Cal.com "$5.1M ARR," Documenso "340+ paying"). Lead the launch post
  with committed pricing + a real paying-customer/revenue point once available.

---

## 2. Commit-history norms

**This section feeds a live fork decision (§6). Be precise about what the evidence supports.**

### The three patterns and what the evidence actually says

**(a) Single squashed/orphan snapshot — the dominant, well-documented default.** Multiple
independent "how to open source a private repo" writeups (OmbuLabs 2020-10-06; osso.nl 2017;
wincent.dev; the reused gist `pqt/reset_git_history.sh`) converge on `git commit-tree HEAD^{tree}`
or an orphan-branch reset, explicitly to avoid auditing years of history for secrets, IP
provenance, and unflattering comments. Truffle Security documents this as the _most common_
real-world flow — and warns it is frequently done wrong (dangling commits and cross-fork leaks
still expose the "squashed" history). Citus Data (Microsoft) used exactly this in 2022:
`git commit -m 'Make enterprise features open source'` as one audited commit.
(trufflesecurity.com/blog/securely-open-sourcing-on-github; citusdata.com/blog/2022/09/12)

_What it supports:_ Caisson's current one-snapshot `caisson-oss` is squarely inside the norm. No
credibility penalty when done by a named org with a real product. **What it does NOT support:** any
claim that thin history _helps_ — it is neutral, chosen for scrubbing convenience.

**(b) Full real history replayed — rarer, always staged/scrubbed, never raw.** Hack Club's HCB
(7-year PII-bearing Rails codebase) open-sourced with history intact but hired "scrubbers" for
~5,000 issues/PRs, used `git-filter-repo` to strip secrets, force-pushed, and had GitHub purge
cached history — keeping the _real_ multi-year graph. BlockApps' STRATO did it in two phases: a
squashed snapshot first, then "all 30,000+ commits and eleven years" a year later — a rare explicit
upgrade from (a)→(b). Kubernetes is the inverse cautionary tale: Google's internal repo history was
_lost_ in the 2014 transition (process failure, not choice), and it shipped effectively
history-less-forward-only from 2014-06-06 with no damage to adoption (now 88k+ contributors).
(blog.hcb.hackclub.com/posts/open-source; strato.ghost.io 2026-03-04; itnext.io/kubernetes-the-road-to-1-0 2024-07-15)

_What it supports:_ If Caisson ever wants perceived depth, HCB/STRATO show a credible two-step path
— ship the scrubbed snapshot now (done), then optionally replay the _actual_ scrubbed private
history later with `git-filter-repo`. This is **optional, not required** — Kubernetes proves
forward-only doesn't cap adoption.

**(c) Synthetic / hand-authored "milestone" history — does not exist as a legitimate corporate
practice, and the adjacent thing that does exist is malicious.** Search turned up _no_ real company
hand-authoring fake milestone commits to narrate a launch. What exists instead: (i) legitimate
tools that generate _narratives from real logs_ after the fact (`git-story`, `chronicle`,
`GitFables` — they read unaltered history, they don't fabricate it); and (ii) outright fabrication
for deception — `fake-git-history`, `git-auto-commit-backdater`, `git-forge` — which backdate
commits to inflate contribution graphs. Checkmarx (2022-07-15, picked up by Cybersecurity Dive)
showed both author and timestamp are trivially forgeable via `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`
with zero verification unless GPG/SSH-signed.
(github.com/artiebits/fake-git-history; checkmarx.com/blog 2022-07-15)

### Risk evidence on synthetic/backdated history (the hard "do not" case)

- **"Operation Long Shadow" (copyleftdev/long-shadow, 2026-04-26):** a forensic investigation into a
  four-cluster GitHub operation forward-dating fabricated commits into 2037 to bubble
  laundered/stolen repos to the top of AI-code search — confirmed against 3,150+ laundered repos, 9
  named real-OSS victims, and forged `claude-code@anthropic.local` author identities.
- **HN item 43860744:** an individual's real-time discovery of a competitor backdating commits to
  pre-date their patent filing — top comment: "faking Git timestamps is trivial."
- **`Speedevs/GitHub-spoof-detector`** catalogs real caught spoofs (709 commits falsely attributed
  to a Solana founder from a 1-day-old account).

None are open-core SaaS companies — they are adjacent abuse patterns — but they establish that
backdated/fabricated history is an _actively policed red flag_, not a neutral stylistic choice.

### Skepticism on legitimate single-commit dumps (split, not unanimous)

HN item 47554056 ("single commit… Was this AI generated?") shows the exact debate: critics say "one
big commit… erodes trust in the author"; defenders say "I don't owe it to anyone to show how the
sausage was made." HN item 47444192 (an NVIDIA release) shows experienced commenters explaining
squash-to-public as _standard big-company practice_ (internal repo → legal review → scrub → squash →
push), with skeptics noting squashed history is unfalsifiable either way. The sharpest real trust
damage in this genus was Twitter/X's 2023 "algorithm open source" — Wired called it "a red herring,"
a former exec called it "completely dishonest" — but that was about _withheld data/incompleteness_,
not squashed history per se. (Engadget 2023-04-06; archive.ph of Wired 2023-04-07)

### Discovery-algorithm reality check

GitHub Trending is driven by **star/fork velocity in a 24h/7d/30d window** — commit count, commit
age, and history depth are _not_ factors in the (undocumented, reverse-engineered) algorithm.
_However_, downstream third-party "is this legit" scoring does penalize thin history (a
repo-discovery heuristic applies a hard "slop penalty" for "<2 commits beyond initial"), and
Checkmarx confirms humans prefer owners "with a track record going back years." So history depth
affects _human_ + _tooling_ credibility judgment, not Trending eligibility.
(ossinsight.io 2026-03-24; MJWNA/github-repo-discovery; Cybersecurity Dive 2022-07-18)

---

## 3. Repo craft checklist (read-only mirror)

Actionable, ordered by leverage. Each item is a same-day task against material Caisson already has.

**README (the actual landing page — buyers decide in <10s, and repo-conversion can dwarf site
conversion; one founder cited 0.9% site vs 24% star→install):**
(dev.to 0-to-10k-stars 2026-03-24; datadab.com 2025-11-19)

- [ ] **Line 1 = the problem, not "this is a library for…"** Lead with the positioning
      ("compliance wedge under a production-rigor umbrella"), not a feature list.
- [ ] **Mirror disclosure in the first screen** (not CONTRIBUTING.md): "This is a generated,
      read-only mirror snapshot of a private monorepo (npm scope renamed `@caisson/*` → `@caisson-sh/*`)."
      This single sentence forecloses the "AI-generated / is-this-legit" HN pile-on. (HN 47554056)
- [ ] **A real terminal GIF/screenshot of `create-caisson` running** immediately after the tagline.
- [ ] **One-command quickstart** — target clone-to-running under 10 minutes.
      (freecodecamp.org 2025-11-07)
- [ ] **3 concrete use cases** (compliance module, AI-production module, agentic-dev module).
- [ ] **Section order** (freeCodeCamp canonical): title/tagline → features → tech stack → quick
      start → repo structure → architecture → API examples → env vars → testing/CI → versioning →
      contributing (= "we don't take PRs here, go to X") → license.

**Read-only / no-PR posture (GitHub shipped a native feature for exactly this):**
(github.blog/changelog 2026-02-13; github.com/sqlite/sqlite & chromium/chromium READMEs 2026-07-10)

- [ ] **Flip the native "disable pull requests" repo toggle** (Feb 2026 feature — the PR tab
      disappears entirely). Explicitly documented as "particularly useful for mirror repositories."
- [ ] **Redirect to a concrete channel, don't leave a void.** Both highest-star mirror examples
      (`sqlite/sqlite` 9.9k, `chromium/chromium` 23.9k) (a) state "this is a mirror" in the first
      screen, (b) give a _concrete_ alternative channel (forum/bug tracker/email), (c) briefly explain
      _why_ so it doesn't read as neglect. Point Caisson contributors at Discord / support-bot / the
      commercial repo's issue path.

**Examples directory (the "product-marketing layer" of a devtool repo):**
(github.com/vercel/examples DeepWiki 2025-09-12; sanity commit 3548bd0 2025-06-16)

- [ ] **Ship `examples/`**, one per bundle at minimum, scaffolded consistently (per-example README +
      demo instructions + `.env.example`) — Vercel/Sanity treat this as a first-class trust signal. It
      doubles as `create-caisson` template dogfooding.

**GitHub SEO (the actual indexed surface — there is no separate "GitHub SEO" field):**
(GitHub Docs "Classifying with topics" & "Searching for repositories," fetched 2026-07)

- [ ] **Topics** (≤20, lowercase-hyphen, ≤50 chars each): a real discovery/ranking surface powering
      topic pages + `topic:` search + related-repo browsing.
- [ ] **Tight repo description** + **social-preview image** — with README content, this is the
      entire indexed surface (`in:readme`/`in:topics`/`in:description`).

**Release / tag hygiene:**
(semver.org; keepachangelog.com 1.1.0; github.com/googleapis/release-please v17.10.3 2026-07-09)

- [ ] **SemVer** + **Keep a Changelog** (human-written, dated `[x.y.z] - YYYY-MM-DD`, categorized —
      not a `git log` dump).
- [ ] **Wire `release-please`** (or equivalent) onto the mirror-sync/publish pipeline. Caisson's
      commits are already Conventional, so this is close to free and fixes tag/changelog hygiene before
      the first public tag.

**Badges (convention has already downgraded star badges):**
(github.com/badges/shields; aelena/repo-badges priority table, fetched 2026-07-10)

- [ ] **Must-have:** Build status + package version (`@caisson-sh/*` npm) + License. **Recommended:**
      Coverage/Docs. **Skip:** raw star/fork count badges (lowest value; the convention itself
      deprioritizes them).

**Skip as a launch priority:**

- [ ] **`llms.txt` as an SEO/AEO play — skip.** Best-controlled 2026 study (2,500 sites, 3 engines)
      found no citation lift, corroborating SE Ranking (300k domains), ALLMO, OtterlyAI. Ship it anyway
      for the _coding-agent_ reason (§4). (generixmarketing.com 2026-04-15; llms-txt.io 2026-06-03)
- Low-confidence note: several `llms.txt` "2026 guide" pages (llmpulse.ai, crawlytics.app,
  smartmoneymedia.org) read as content-farm output — cited above only where corroborated by named
  third-party studies.

**Do NOT chase stars as a launch KPI** — ~6M suspected fake stars concentrate in AI/tooling repos
(peer-reviewed, ICSE 2026); track npm downloads, `create-caisson` completions, and issue/Discord
latency. (arxiv.org/abs/2412.13459; blog.stateshift.com 2026-02-04)

---

## 4. Channel plan (sequenced, concrete)

**Governing principle: sequence beats spike.** Show HN's star-impact half-life is ~24h, 92% gone by
48h; HN score explains only ~8% of star variance. The lever is concentrated multi-channel timing +
weeks of pre-launch groundwork, not one big post. (danfking.github.io 2026-04-23)

### Weeks −3 to −1 (pre-launch foundation — do regardless of exact date)

1. **`caisson.sh/llms.txt` + `/llms-full.txt`** (30 min). Stripe pattern: steer coding agents toward
   current bundle/module ids, away from legacy aliases (directly relevant to Caisson's
   alias-forever ADR-0257/0269). Verify `robots.txt` explicitly allows `GPTBot`, `ClaudeBot`,
   `PerplexityBot`, `OAI-SearchBot`, `Google-Extended` (accidental blocking is the #1 failure).
   (llms-txt.io 2026-06-03; LangChain/Lance Martin benchmark)
2. **PR into 3–5 relevant `awesome-*` lists** (awesome-typescript, awesome-nodejs,
   awesome-selfhosted-adjacent compliance) — one line, no marketing language. "A single PR into the
   right Awesome list can outperform a paid Product Hunt launch." (saascity.io 2026-04-22)
3. **Submit to Node Weekly** via `nodeweekly@inboxshield.ca` (confirmed free organic-submission
   channel — "send us your open source Node project"). (Node Weekly Issue 155, 2026-03-03)
4. **List on DevHunt, Console.dev, StackShare, LibHunt** (dofollow tier-1 devtool directories,
   standing value independent of launch timing). (saascity.io 2026-04-22)
5. **Begin daily X presence from the existing account** — real product screenshots (not designed
   graphics), posted _inside_ Build-in-Public communities (12x engagement vs raw timeline in a 16-day
   A/B test), quote-tweeting small 100–1k-follower indie/compliance accounts. Don't wait for a
   follower number. (DEV 2026-07-05)
   - _Timeline caveat (flagged):_ X build-in-public has an ~8-month time constant to 20k followers —
     it does NOT fit "launch imminent (weeks)." Use the fast-acting placement tactics above stacked
     on the existing account, not as a pre-launch audience-building project. (InnMind 2026-06-09)

### Launch week (Tue–Thu — but check current HN competition; the 188k-post analysis shows

Sunday-evening / Monday-00:00-UTC actually beats the "everyone knows" 9am ET slot, likely because
that slot is when competition peaks)

- **Day 0 — Show HN (anchor).** Title: `Show HN: Caisson – an Apache-2.0 TS/Bun base + compliance
bundles for SOC2/HIPAA-shaped SaaS` (rigid format: no adjectives, a concrete claim). **First
  comment pre-written** and structured: what it is (technical) · the personal "why" (production-rigor
  - compliance pain) · one honest limitation named before critics find it (e.g. "the compliance
    bundle needs your own auditor relationship — we don't issue the attestation") · one open question.
    **No signup wall on the linked page** — the OSS repo _is_ the demo. Founder present in-thread the
    full first 2–4h (ideally 6); reply to substantive comments within ~15 min for the first two hours.
    **Do not solicit upvotes anywhere** (even an indirect tweet triggers ring detection → permanent
    shadowban). (flowjam.com 2025-11-14; okara.ai 2026-06-24; s2p.dev 2026-06-13)
- **Day 0–1 — Reddit r/node**, code-first post (working example, explicit "why not the free base
  alone," TypeScript-support stated upfront). **Save the r/SaaS "Share Your SaaS Saturday" slot for
  a later week** — r/SaaS enforces a hard 1-self-promo-per-60-days limit with cross-account ring
  detection (April 2026). (reddit-radar; soar.sh 2026-05-05)
- **Day 1–2 — Product Hunt (secondary).** 12:01am PT Tue/Wed, gallery = real screenshots + a
  30–90s demo video, Maker's comment written personally, GitHub-signup as lowest-friction CTA. Treat
  any result as bonus. One devtool founder's explicit verdict: "Reddit > Product Hunt — for dev
  tools, Reddit is 10x better." (pristren.com 2026-05-17; indiehackers.com 2026-05-08)
- **Day 2–4 — Newsletter follow-through.** TLDR Dev (470k) / TLDR AI (1.1M) free-submission path once
  there's a concrete "we launched" hook — newsletters favor coverage of things that already have
  traction. (tldr.tech/dev)
- **Days 3–7 — "prove" phase.** Publish an honest numbers post (signups, stars, what surprised us)
  on X + dev.to. The launch-week data is consistent that this out-converts the original launch post
  and is the asset most likely to get picked up by Perplexity's freshness weighting.
  (flowjam.com 2025-08-20)

### Ongoing (weeks 2+)

- **GitHub Marketplace listing** for `cli`/`migrate`/`license-verify` (mandatory-tier if they ship
  as a GitHub App/Action). LibHunt/SaaSHub/AlternativeTo set-and-forget dofollow listings.
- **Weekly (not daily) technical build-in-public threads** — specific technical-decision posts
  ("we chose X over Y because Z") convert; generic hot takes don't; daily cadence burns out.
  (DEV 2026-03-26)
- **AEO: budget zero effort beyond the crawlability floor.** What actually correlates with AI
  citation: allowing the AI bots in robots.txt, a direct answer in the first 40–60 words,
  dated/sourced claims, topical-cluster depth. **Perplexity is the most accessible engine for a new
  domain** (weights freshness, cites newer sources); ChatGPT/Claude web-search mostly mirror Google
  top-5, so ranking on Google is the reliable _indirect_ path. JSON-LD schema is contested (Ahrefs:
  no clear uplift over 1,885 pages). (claudeguide.io 2026-04-26; marquiq.com 2026-04-16)

**The rule floor is real and asymmetric:** one misstep (vote-ring, wrong-subreddit self-promo,
delete-and-resubmit Show HN) can produce a permanent shadowban costing more than any single launch.
Default to one clean, well-prepared shot per channel — not an aggressive multi-account cadence.

---

## 5. Positioning

### Competitor table

| Product                 | License / price                | What it is                                            | Overlap with Caisson                                                               | Gap Caisson exploits                                                                                                                                   |
| ----------------------- | ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **create-t3-app**       | MIT, free, ~29k ⭐             | CLI scaffolder (Next+tRPC+Prisma+NextAuth)            | The default "TS starter" mental model                                              | No billing/tenancy/compliance — "bring your own libraries"; too thin to be a base competitor                                                           |
| **next-forge** (Vercel) | MIT, free, 7.1k ⭐             | Turborepo template (Clerk/Stripe/Sentry/Arcjet)       | Closest free full-stack template; **Bun as package-manager since v6** (2026-03-13) | Not Bun-runtime-native; no multi-tenancy, no compliance/WORM/audit primitives; Vercel distribution is its moat                                         |
| **ShipFast**            | Closed, $199–299 one-time      | Deliberately minimal SaaS starter                     | "ship fast" niche                                                                  | _Explicitly_ no RBAC/multi-tenancy/enterprise; moat is community (8,300 customers), not depth — a different buyer                                      |
| **Makerkit**            | Closed, $299–599 + free "lite" | Real B2B depth (org modes, seat/metered billing, MCP) | Multi-tenancy + billing                                                            | No compliance/audit-trail/WORM/OSCAL surface in any tier                                                                                               |
| **Supastarter**         | Closed, €349–1,499             | Next+Nuxt multi-tenant starter                        | Multi-tenancy + payments                                                           | No compliance-specific primitives (no SOC2/audit-log/WORM claims)                                                                                      |
| **Vanta**               | SaaS, $10k–250k+/yr            | Compliance-automation dashboard                       | Compliance buyer                                                                   | Watches _existing_ infra; ships no application code; CPA audit is a separate $15–50k line                                                              |
| **Drata**               | SaaS, $7.5k–50k+/yr, $100M ARR | "Compliance as code" = CI control-enforcement         | Compliance buyer, 300+ integrations                                                | Still a monitoring layer bolted on; audit fee separate; 4.8/5 G2 (integration breadth is _its_ moat)                                                   |
| **Comp AI** (trycompai) | AGPLv3 open-core, ~2k ⭐       | "Open-source Vanta/Drata alternative," TS/Next/Prisma | **Closest hybrid analog**                                                          | Still a vertical compliance-ops _dashboard_ you run alongside your app — no WORM storage / field-crypto / RLS baked into _your_ product code           |
| **WorkOS**              | API, free→per-connection       | Enterprise-readiness API (SSO/SCIM/Audit Logs/RBAC)   | `@caisson/auth` + tenancy ambition                                                 | Hosted dependency (ongoing per-connection billing, data leaves your infra) vs. owned/self-hosted Apache-2.0 code; **owns "enterprise-ready" language** |
| **Supabase**            | Apache/MIT/PG, 106k ⭐         | Open-core infra (DB/auth/storage/realtime)            | Reference open-core success                                                        | One layer _below_ Caisson — most starters _depend on_ it; not a same-abstraction competitor                                                            |

Sources: github.com/t3-oss/create-t3-app, vercel/next-forge (2026-07-10); vercel.com/changelog
2026-03-13; shipfa.st & dupple.com 2026; makerkit.dev 2026-06-29; supastarter.dev 2026;
soc2auditors.org 2026-04-24 & 2026-02-01; github.com/trycompai/comp & trycomp.ai/vanta-alternative
2026-07-10; workos.com/pricing & /blog 2026-05-06; opentechhub.io 2025-12-12.

### Bun-native check

Searched specifically: only hobbyist-scale Bun-runtime-native starters exist
(`bunworks/bun-turbo-starter` 18 ⭐, `xthezealot/saas-starter-ts` 2 ⭐). No commercially significant
competitor is Bun-runtime-native. **"Bun-native" is a safe, uncontested claim today — but expect the
window to close** (next-forge already moved on the package-manager front). (GitHub search 2026-07-10)

### README lead-claim recommendation

**Lead with: "Compliance primitives that live in the code you own — WORM audit-log storage,
field-level crypto, per-org RLS tenancy, and OSCAL conformance, shipped as Apache-2.0 TypeScript/Bun
source, not a dashboard bolted onto your infra."**

Rationale, from the evidence:

- **The real undefended gap.** Vanta/Drata/Comp AI/WorkOS all sell evidence-collection or
  enterprise-API layers that watch/augment _existing_ infra after the fact; none ship WORM
  audit-log storage, field-crypto, or OSCAL-conformant tenancy _as application source_. That is a
  real, specific, ownable claim.
- **Bound it honestly.** Do NOT claim to replace the CPA audit or the monitoring dashboard (Caisson
  has 0 integrations vs Drata's 300+). Position as the _technical substrate that makes that audit
  cheaper and faster_, not a Vanta swap-in.
- **Don't lead with stars/community.** A fresh mirror looks tiny next to create-t3-app (29k),
  Supabase (106k), even Comp AI (2k). Let code quality + the compliance angle carry the README.
- **Avoid "enterprise-ready."** WorkOS owns that phrase + authored its canonical checklist and will
  out-feature Caisson on integration breadth. Be specific (WORM S3 Object-Lock, per-org RLS, OSCAL,
  license-gated registry) rather than reaching for the adjective WorkOS owns.
- **Don't race ShipFast/Makerkit on "ship fast."** Caisson's base is heavier by design; that buyer
  is not Caisson's buyer.
- **Bun-native as the uncontested secondary claim** — lead line + Bun-native subhead.

---

## 6. Implications for the open forks

Six decisions the evidence directly informs. Confidence flagged per item.

### History shape — KEEP the single snapshot (high confidence)

The current one-commit `caisson-oss` is the _industry default_ for private→public with money/
license/secret surfaces to scrub (Citus, OmbuLabs, Windows Calculator, near-universal HN practice).
Windows Calculator (30k ⭐) drew zero criticism doing exactly this. Commit-history depth is **not** a
Trending factor and **not** a credibility gate for enterprise-sourced projects with a named,
reputable owner. **Do not spend effort on history cosmetics.** The optional upgrade path exists
(HCB/STRATO two-step: replay real scrubbed history later with `git-filter-repo`) but is
marketing-driven, not required — defer unless there's concrete upside.

### Commit dating — NEVER backdate or synthesize (maximum confidence, hard rule)

Unambiguous across the evidence: backdated timestamps are the signature of "Long Shadow"
repo-laundering and individually-caught IP-theft scams; unsigned author/date are trivially forgeable
and increasingly auto-detected. If Caisson ever wants to show provenance, _sign_ the commit
(GPG/SSH) and let the real push date stand — never manufacture a backstory. This forecloses any
"synthetic milestone history" idea entirely — it does not exist as a legitimate practice, only as a
malicious one.

### Fresh-repo-vs-keep — KEEP `caisson-sh/caisson-oss` as-is, add one disclosure sentence (high confidence)

No reason to start a fresh repo or restructure. The one gap to close is _narrative_, not _history_:
add a first-screen README sentence stating this is a generated, read-only mirror snapshot (scope
renamed `@caisson/*` → `@caisson-sh/*`). That single sentence forecloses the documented "is this
AI-generated / is this legit" HN pile-on that fires on _unexplained_ thin history — the backlash
targets brand-new anonymous accounts, not named companies with a real product and site.

### Read-only posture — flip GitHub's native no-PR toggle + redirect (high confidence)

Use the Feb-2026 "disable pull requests" repo setting (PR tab disappears — GitHub explicitly names
mirrors as the use case) rather than relying on README prose. Mirror the SQLite/Chromium pattern:
state "mirror, no PRs" in the first screen, give a _concrete_ channel (Discord / support-bot /
commercial issue path), briefly say why. Don't leave a void that reads as neglect.

### npm scope / delivery — the mirror IS the public artifact; publish stays gated (high confidence)

`@caisson-sh` npm scope is the public delivery surface (self-hosted registry gates the commercial
bundles). Keep the publish pipeline gated on the manual `confirm=publish` dispatch through the
launch — and wire `release-please` onto the mirror-sync/publish pipeline now so tag/changelog
hygiene is right before the first public tag (Caisson's commits are already Conventional → near-free).

### Timing — pre-launch groundwork weeks BEFORE any Show HN, publish flip is the anchor gate (high confidence)

Sequence beats spike. Run the mirror-public + Awesome-list PRs + Node Weekly + directory listings
for 2–4 weeks _before_ the Show HN/PH event, so the launch boosts existing momentum instead of
creating it from zero (the Cloudflare-tool PH case is explicit on this; the 24–48h HN half-life
confirms a cold big-bang wastes the groundwork). The `confirm=publish` flip should be timed to open
the pre-launch window, not the launch day itself — the repo needs to be public and discoverable
_before_ the anchor Show HN so early organic signal (stars, an Awesome-list entry, a newsletter
mention) is already visible when the HN traffic lands.

---

_Compiled 2026-07-10 from five research lanes. All external claims carry a URL + date above;
low-confidence sources (content-farm `llms.txt` guides; single-analyst statistical studies) are
flagged at point of use. No metrics invented; where a lane reported a range or a contested figure,
the range/contest is preserved._
