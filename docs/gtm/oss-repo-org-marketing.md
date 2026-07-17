---
updated: 2026-07-17
status: live
grounds:
  - knowledge/decisions/ADR-0094-open-core-base-apache2.md
  - knowledge/decisions/ADR-0097-registry-schema-service-split.md
  - knowledge/decisions/ADR-0136-license-keyed-registry-gating-tooling-open.md
  - knowledge/decisions/ADR-0318-oss-launch-program-locks.md
  - outputs/research/oss-launch-gtm-2026-07-10.md
  - docs/gtm/positioning.md
  - docs/state/outstanding-work.md
---

# OSS mirror repo presentation and org-setup memo

Research + recommendations for how `caisson-sh/caisson-oss` presents itself once it goes public.
This is prep, not a push to flip early — the public flip (W3, ADR-0318) is **held on business
optics at the operator's 2026-07-17 lock** (all technical gates green; waiting for Mercury/Paddle
to be materially further along before any public GTM motion — `docs/state/outstanding-work.md`
row "`caisson-oss` public flip"). Nothing below argues the timing; it's the punch list for
whenever W3 fires.

## 1. Current state

**Repo:** `caisson-sh/caisson-oss`, private, one commit per release-train ride (not per push —
that trigger retired at Kickoff M/W4). Append-only since the 2026-07-10 cut-over (ADR-0318 F2/F3):
`mirror-sync.yml` clones the repo, replaces the working tree with a fresh
`export-public-mirror.ts` run, and pushes one `chore: mirror sync from <sha>` commit on top —
never a force-push. First real ride: `d5a37a51`, 2026-07-12.

**Open-core boundary that governs everything in the mirror** (ADR-0094, narrowed by ADR-0097 and
ADR-0136): the Base substrate ships Apache-2.0; the four commercial bundles, the compliance
primitives (`field-crypto`, `audit-worm`), the `create-caisson` generator's registry-facing parts,
the registry service, and every update subscription stay `LicenseRef-Caisson-Commercial` and never
appear in the mirror. `cli`, `migrate`, and `license-verify` are open (ADR-0136) because they ship
inside every buyer's generated repo regardless of edition — gating them would break every buyer's
app. The registry Worker's free floor is license-keyed, not edition-keyed, fail-safe-to-open
(ADR-0136) — the code-layer enforcement behind the "Base has no standalone compliance/AI/evidence
value" claim in ADR-0094.

**What the mirror source (`scripts/mirror-assets/` + `export-public-mirror.ts`) already ships:**

- `README.md` — mirror-disclosure sentence on line 3 (closes the "is this AI-generated" HN
  pile-on per the GTM research), quickstart with a real runnable sample
  (`bunx @caisson-sh/cli@latest --sample eu-ai-act-sample`), the full open-package table, a
  pointer to the six commercial bundles, the release-pipeline note, a support section, license.
- `CONTRIBUTING.md` — states the read-only/no-PR posture in prose, redirects bug reports to this
  repo's issue tracker, points anything commercial-bundle-related at caisson.sh.
- `TRADEMARK.md` — full nominative-fair-use policy (required pre-public per ADR-0319: Apache-2.0
  §6 grants no trademark rights).
- `ci.yml` — build/test/lint/format only; a header comment explains exactly why
  standards-gate/registry-index/oscal-conformance/the security-scan floor don't re-run here (they
  need commercial content or the private registry ledger, absent by design).
- `publish.yml` — manual `workflow_dispatch` with a literal `confirm=publish` string gate,
  currently inert (`NPM_TOKEN` unset).
- Per-package `CHANGELOG.md` — already mirrored (`PACKAGE_PROSE_FILES` in the exporter), sourced
  from real changesets. The "Keep a Changelog" ask in the GTM research is already substantially
  met at the package level; there is no root-level rollup.

**Intentionally absent today:** README badges, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`,
issue templates, a root `LICENSE` file (each package carries its own; no repo-root copy),
an `examples/` directory, an org-level `.github` profile repo. None of this blocks the technical
readiness gate — it's presentation debt, the subject of §2–3.

## 2. PR-work recommendations

Everything here lands as a file in `scripts/mirror-assets/` plus one `cpSync(...)` line in
`export-public-mirror.ts` (the exact pattern the existing README/CONTRIBUTING/TRADEMARK/ci.yml/
publish.yml assets already follow, ~line 838-849) — so it flows through the append-only sync like
everything else. **Not created in this pass** — recommendations only.

### SECURITY.md

**What:** A vulnerability-reporting policy — where to send a report, what response to expect, and
an honest statement that there is no dedicated security team or bug-bounty program yet. Point
intake at `admin@caisson.sh` (already the trademark contact) and state that fixes land in the
private monorepo and flow out on the next mirror sync, mirroring `CONTRIBUTING.md`'s existing
pattern for bug reports.

**Why:** GitHub only populates a repo's "Security" tab from a `SECURITY.md` in the root, `docs/`,
or `.github/` folder — and GitHub's own guidance explicitly recommends also linking it from the
README, because the Security tab isn't obvious to everyone. A compliance-positioned product
shipping zero vulnerability-disclosure path is the specific credibility gap this closes.

**Precedent:** GitHub Docs, "Adding a security policy to your repository" (docs.github.com,
current); GitHub Blog, Nancy Gariché, "Coordinated vulnerability disclosure (CVD) for open source
projects," 2022-02-09 — both converge on the same shape: root/`.github`/`docs` file, README link,
set expectations honestly rather than promise a process that doesn't exist yet.

**Effort:** trivial — one file (~30 lines), one `cpSync` line. ~20-30 min.

### README badges (build status, npm version, license)

**What:** Three badges under the H1 — CI status (the mirror's own `ci.yml` badge endpoint),
`@caisson-sh/kernel` npm version (the flagship base package), and an Apache-2.0 license badge.

**Why + precedent:** already researched in-repo — the GTM research's repo-craft checklist names
build status + package version + license as the must-have set and explicitly says skip
star/fork-count badges (shields.io convention has already deprioritized them). Citation:
`outputs/research/oss-launch-gtm-2026-07-10.md` §3, sourcing github.com/badges/shields and the
aelena/repo-badges priority table, fetched 2026-07-10.

**Effort:** small — three markdown lines, no new file. ~30 min (mainly picking the bellwether
package for the version badge).

### CODE_OF_CONDUCT.md

**What:** Adopt the Contributor Covenant verbatim, contact = `admin@caisson.sh`.

**Why:** part of GitHub's standard community-health-file set; a mirror with only an Issues surface
still benefits from stating community norms once issues/comments are open to the public. This is
a low-stakes, drop-in file — not a governance decision.

**Precedent:** GitHub Docs, "Creating a default community health file" (docs.github.com,
current) — names `CODE_OF_CONDUCT.md` as one of the six supported community health files GitHub
recognizes at the repo or org-default level.

**Effort:** trivial — template drop-in, ~15 min.

### SUPPORT.md

**What:** "Ways to get help" — points at Discord and the support-bot (the existing live channels),
not GitHub Issues for anything beyond a confirmed bug. Reinforces the mirror's own
`CONTRIBUTING.md` framing rather than adding a new promise.

**Why:** GitHub links a repo's `SUPPORT.md` automatically from the "new issue" flow. The GTM
research names exactly this pattern (SQLite/Chromium: state the mirror model, give a concrete
alternative channel, explain why) as the fix for a "read-only repo with no visible support path"
reading as neglect.

**Precedent:** GitHub Docs, "Adding support resources to your project" (docs.github.com, current);
`outputs/research/oss-launch-gtm-2026-07-10.md` §3 (sqlite/sqlite, chromium/chromium READMEs,
fetched 2026-07-10).

**Effort:** trivial, ~15 min.

### Minimal issue template

**What:** One bug-report template under `.github/ISSUE_TEMPLATE/` asking for package name,
version, and a minimal repro — the exact three things `CONTRIBUTING.md` already asks for in
prose. A template just structures what's already the stated expectation.

**Why + precedent:** same GitHub Docs community-health-file page as CODE_OF_CONDUCT/SUPPORT above
— issue templates are one of the six recognized file classes and reduce back-and-forth on
low-quality first reports.

**Effort:** small, one YAML/MD file, ~20 min.

### Root-level LICENSE

**What:** An Apache-2.0 `LICENSE` file at the mirror's repo root (today only per-package
`LICENSE` files exist — the README's own License section already says "each package carries its
own `LICENSE`," which is correct for npm publish but leaves the repo root without one).

**Why:** GitHub's license detector reads the repo-root file to populate the "About" sidebar
license field and the license-badge API — without it, GitHub shows "no license detected" at the
repo level even though every package is correctly licensed underneath.

**Precedent:** same GitHub Docs community-health-file convention; standard OSS repo-root practice
independent of the citation above.

**Effort:** trivial — boilerplate Apache-2.0 text + NOTICE, ~15 min.

### Terminal recording in the README

**What:** A real GIF or asciinema/vhs recording of `create-caisson` running, embedded right after
the tagline.

**Why:** the GTM research's highest-leverage single item — a founder-cited 0.9% site-conversion
vs. 24% star-to-install conversion gap, because repo visitors decide in under 10 seconds and a
static feature list doesn't show the product working. This is a content asset, not code — script
the capture (`vhs`/`asciinema`), but have the operator review the recording before it lands,
since it's the single most-seen artifact on the page.

**Precedent:** `outputs/research/oss-launch-gtm-2026-07-10.md` §3 (dev.to "0-to-10k-stars"
2026-03-24; datadab.com 2025-11-19).

**Effort:** small-medium — no code change, but a real capture + review pass, not a pure file drop.

### Deferred / lower priority

- **`examples/` directory** — the GTM research recommends one per bundle, but bundles are
  commercial and don't ship in the mirror; an open-Base-only examples tree (composing
  `kernel`+`tenancy-rls`+`auth`+`billing`) is real example _code_, not a marketing file, and the
  quickstart's `--sample eu-ai-act-sample` already gives a runnable demo. Worth doing eventually;
  scope as its own EXECUTE phase, not this memo's file list.
- **Root-level rollup `CHANGELOG.md`** — already substantially covered per-package (see §1); a
  repo-root aggregate is a nice-to-have, not a gap.

## 3. Operator checklist (GitHub settings — NOT executable by an agent)

These are repo/org **settings**, not files in the mirror source — they can't flow through
`export-public-mirror.ts` or the append-only sync, and this memo does not attempt any of them.
Several can be set now while the repo is still private (topics, description, social-preview
image) without constituting the W3 public flip; others are inert on a private repo and only take
effect once it's public.

- [ ] **Repo topics** (Settings → General, ≤20, lowercase-hyphen, ≤50 chars each) — real
      discovery surface powering topic pages and `topic:` search. Candidates: `compliance`,
      `typescript`, `bun`, `multi-tenancy`, `soc2`, `hipaa`, `audit-log`, `row-level-security`,
      `open-core`, `apache2`.
- [ ] **Repo description** — one line, matched to the locked README lead claim once that copy is
      final (`outputs/research/oss-launch-gtm-2026-07-10.md` §5 has the recommended wording).
- [ ] **Social-preview image** (Settings → General → Social preview, 1280×640px) — the card shown
      on link shares (Show HN, Reddit, X); pairs with the terminal-recording asset in §2.
- [ ] **"Disable pull requests" repo toggle** (Settings → General → Pull Requests, a Feb-2026
      GitHub feature explicitly documented for mirror repos — makes the PR tab disappear entirely
      instead of relying on `CONTRIBUTING.md` prose to turn people away).
- [ ] **Private vulnerability reporting** (Settings → Security → Private vulnerability reporting)
      — the toggle that makes `SECURITY.md` (§2) actionable instead of just informational; lets a
      reporter open a private advisory instead of a public issue.
- [ ] **GitHub Discussions — recommend leaving OFF.** The GTM research's own precedent (SQLite,
      Chromium) is: state the mirror model, give ONE concrete external channel, don't leave a
      void. Discord + the support-bot are already that channel; enabling Discussions too splits
      the same conversation across two surfaces for no gain. Flagging as considered-and-skip, not
      undecided.
- [ ] **`caisson-sh/.github` org-profile repo** — a separate public repo, not a `caisson-oss`
      setting. Carries the org-wide profile README (shown on github.com/caisson-sh) and can host
      org-default community health files (CODE_OF_CONDUCT/SUPPORT/issue templates) so any future
      second public repo inherits them automatically. Out of scope for `caisson-oss`'s own export
      pipeline — a separate, small initiative if the operator wants it.
- [ ] **Pinned repositories on the org profile** — pin `caisson-oss` once public.
- [ ] **Branch protection** — likely moot: the mirror only ever receives bot-pushed append
      commits from `mirror-sync.yml`, never a human merge. Confirm there's nothing to protect
      against before spending time on it.

## 4. Positioning

The mirror is the free flank of the wedge-and-umbrella positioning (ADR-0040/ADR-0094), not a
downsell of the paid bundles — it converts ICP-3 (the Local-first/Privacy Builder,
`docs/gtm/positioning.md`) on contact and builds trust with ICP-1/ICP-2 before either ever sees a
price. It can't cannibalize revenue by design, not just by intent: Base alone has no standalone
compliance/AI/evidence value (ADR-0094), and the registry's license-keyed free floor enforces the
boundary at the code layer (ADR-0136) — nothing commercial is one npm install away. Lead the
README with what the Base _does_ have — compliance primitives that live in code you own, not a
dashboard bolted onto existing infra — and stay honest about what it isn't: no CPA audit, no
bundles, no enterprise-integration breadth (the locked GTM lead claim,
`outputs/research/oss-launch-gtm-2026-07-10.md` §5). Track adoption on signals that actually
correlate with revenue — npm downloads, `create-caisson` completions, issue/Discord response
latency — never star count; two separate OSS launches (Twenty, Maybe Finance) prove stars and
paid conversion move independently, one of them (Maybe Finance) proves it by having 50k stars and
2M downloads and the hosted product still failing to convert.

## References

1. GitHub Docs, "Adding a security policy to your repository" —
   docs.github.com/code-security/getting-started/adding-a-security-policy-to-your-repository
   (fetched 2026-07-17).
2. GitHub Blog, Nancy Gariché, "Coordinated vulnerability disclosure (CVD) for open source
   projects" — github.blog/security/vulnerability-research/coordinated-vulnerability-disclosure-cvd-open-source-projects/,
   2022-02-09.
3. GitHub Docs, "Creating a default community health file" —
   docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file
   (fetched 2026-07-17; covers CODE_OF_CONDUCT/SUPPORT/SECURITY/issue-template conventions and the
   org-level `.github` profile repo).
4. `outputs/research/oss-launch-gtm-2026-07-10.md` §3 "Repo craft checklist" — badges
   (github.com/badges/shields; aelena/repo-badges priority table), topics/description/social-preview
   (GitHub Docs "Classifying with topics" and "Searching for repositories"), the no-PR toggle
   (github.blog/changelog, 2026-02-13), release hygiene (semver.org; keepachangelog.com 1.1.0;
   googleapis/release-please v17.10.3, 2026-07-09) — all fetched/dated 2026-07-10 in that research
   pass.
5. `outputs/research/oss-launch-gtm-2026-07-10.md` §2/§6 — read-only mirror posture precedent
   (sqlite/sqlite 9.9k★, chromium/chromium 23.9k★ READMEs, fetched 2026-07-10) informing the
   Discussions-vs-Discord call in §3 above.
