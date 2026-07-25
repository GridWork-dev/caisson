# Visual audit — full-surface hybrid rubric sweep (2026-07-21)

The 40-point Nielsen rubric critique of the 2026-07-21 prod capture, run as the operator-locked
**hybrid lane**: the repo `/uiux-audit` rubric fleet plus an **opencode × kimi-k3 cross-vendor
pass** (cold-read page critiques + a tool-less adversarial round over the top findings). Run
artifacts: `outputs/visual-audit/2026-07-21/` (gitignored, 965 PNGs incl. the admin-harness leg +
`manifest.json` + `surface-index.json`); harness: `apps/site/scripts/visual-harness.ts` (`--prod`,
CF-Access service token) + a local admin-harness capture (19 admin routes, seeded better-auth
session).

**Run shape:** 141 scored surfaces · 105 rubric lanes + 1 persona walkthrough + 1 cross-surface
synthesis (workflow `wf_681014cd-e9c`, 107 agents, 0 errors) · every lane scored ten Nielsen
heuristics 0–4 against the shots + route source + shared kit + brand doctrine. **Cross-vendor:**
5 cold-read page critiques (home, /compliance, /marketplace, /build-vs-buy, /marketplace/plans)
via `moonshotai/kimi-k2-thinking`, then a tool-less **kimi-k3** adversarial round over the eight
cross-surface findings via the opencode headless lane (XDG-isolated, deny-all permissions).

**Ledger:** `tooling/design-critic/findings.toml` reconciled — **723 rows: 502 new · 105 unchanged
· 34 closed** (advisory). Prior-open re-checks by the lanes: **89 still-present · 33
appears-fixed · 2 not-verifiable** (kept open) · 14 operator-`accepted` rows carried untouched ·
3 legacy surfaces (`marketplace__modules`, `marketplace__build`, `changelog`) verified as 308
redirects and closed.

## Scorecard

**Average 30.9/40.** Bands: 4 exceptional · 87 strong · 46 competent · 4 rough. 502 findings
(4 P0 · 42 P1 · 188 P2 · 268 P3).

| Worst                                  | /40 | Best                                       | /40 |
| -------------------------------------- | --- | ------------------------------------------ | --- |
| dashboard\_\_cart                      | 23  | home                                       | 39  |
| docs\_\_ai-production\_\_credits       | 23  | interaction\_\_marketplace-search          | 37  |
| docs\_\_base\_\_billing                | 23  | build-vs-buy                               | 37  |
| docs\_\_base\_\_billing-orchestration  | 23  | marketplace\_\_modules\_\_agent-trajectory | 36  |
| dashboard\_\_plan / admin\_\_decisions | 24  | popout\_\_module-guardrails                | 35  |

Full per-surface data: scratchpad `all-surfaces.json` → ledger.

## P0 — one root: the docs mobile shell

All four P0s are the same defect: **docs prose and code clip mid-word off the 390px viewport**
(`docs__ai-production__credits`, `docs__base__billing`, `docs__base__billing-orchestration`,
`docs__compliance` — billing-orchestration also loses its Configuration reference table). Every
docs route renders through the single shared `DocsLayout` (`apps/site/app/docs/layout.tsx` +
docs-scoped CSS in `app/global.css`); the same shell also ships **no mobile header/hamburger/
search** — only a sticky TOC pill that occludes the H1 at scroll-top. Kimi-k3: CONFIRM, P1+
"content loss at 390px on the primary evaluation surface is legitimate even pre-traffic";
fumadocs ships mobile nav by default, so its absence is a disablement. Fix once in the shell:
`min-width:0` on the content track, `overflow-wrap:anywhere` scoped to prose (not inline code),
`overflow-x:auto` for code/tables, re-enable the DocsLayout mobile nav, offset the TOC pill.

## Cross-surface P1 roots (synthesis + adversarial verdicts)

1. **Bundle composition count drift** — kimi-k3: CONFIRM, **fix first** ("factual error on the
   purchase surface; violates the ADR-0082 truthful-to-built floor; under an hour"). Headings
   hardcode count words while cards render `record.members.map()`: local-first says "Four
   composed packages." (`page.tsx:245`) over **seven** cards; agentic-dev's "four parts" grid
   lists non-kernel `Local hybrid memory` and omits the governance guards its own intro names.
   Fix: derive counts from `members.length` or delete the number words.
2. **Contrast gate blind spot** — **hard-verified in-session**: `tokens-contrast.test.ts` passes
   accent-on-accentTint at 4.705 (culori, OKLCH strings) but the browser-rendered gamut-mapped
   hexes `#007491` on `#d2eef1` compute **4.413** — an AA fail for the sub-14px eyebrows on 7
   light-mode tint-band surfaces. Kimi-k3: CONFIRM; amend the fix — run the gate against the
   gamut-mapped hexes (not a blanket 4.8 threshold), and darkening the accent token churns every
   accent consumer → golden-file re-snapshot required.
3. **Link a11y is opt-in** — `global.css` resets `a {text-decoration:none}`; `.cs-link` must be
   remembered per anchor (legal pages ship 6 color-alone links, WCAG 1.4.1). Kimi-k3: CONFIRM
   ("highest irony weight" on a compliance product), but verify the G183 3:1+hover exemption
   first, scope the inversion to `.cs-prose a` (a bare `main a:not([class])` underlines MDX
   heading anchors), and the minutes-cheap interim is adding `.cs-link` to the 6 legal anchors.
4. **Code-artifact scroll cue** — both shared primitives (`code-block.css:39`,
   `terminal.css:60`) fade clipped code into the card's own surface color; ~18 surfaces read it
   as content loss (glossary evidence blocks worst — `append-only-audit-log` even ships
   genuinely incomplete `verifyChain` TypeScript). Kimi-k3: WEAKEN — the fade is a standard
   affordance; add a real thin scrollbar + shadow edge but **do not soft-wrap code** (copy-paste
   fidelity of shell commands is the product's worst failure mode).
5. **Buyer dashboard no gutter** — `.cs-shell__main` sets no padding and `DashboardShell` adds
   no wrapper; every `/dashboard/*` page renders flush to chrome (4 pages flagged). Kimi-k3:
   CONFIRM mechanism, demote to P2 (post-purchase surface); audit per-page before padding to
   avoid double gutters.
6. **Admin viewport overflow** — no `overflow-x` guard + `white-space:nowrap` tables push whole
   admin pages past 390px (catalog/components, product, decisions). Scroll the table, not the
   page.
7. **Console NaN emitter** — the `%c%d font-size:0;color:transparent NaN` write fires on ~15
   routes from a vendor chunk via the root layout analytics wiring. Kimi-k3: WEAKEN → **one P3
   ledger item**, not 15; check PostHog for a dropped web-vital before anything; do not patch
   the vendor chunk.
8. **Two code-surface contracts** — theme-following `--cs-surface-1` vs the locked always-dark
   Shiki theme. Kimi-k3: WEAKEN + split — the unambiguous bug is the flat-monochrome glossary
   code (likely an unregistered Shiki lang, P2); the contract unification is a **design-owner
   fork, not an audit decision** → routed to the operator, not auto-decided.

## Notable single-surface P1s

- `marketplace__modules__alerting`: stray `workspace:*` package-protocol token in buyer prose
  (buy-card + FAQ). `local-sync`: ungrammatical hero ("a row a later delete won never
  resurrects"). `org-controls`: internal ADR numbers + code identifiers in the buy-rail.
- `preview__emails`: the shared footer's "not a marketing message" claim is **false** on the
  nurture-follow-up template; money receipts carry no support/contact path.
- `admin__support`: escalations count renders "(0)" when the read failed — asserts zero while
  the body admits the read didn't complete. `admin__decisions`: open-forks panel renders raw
  markdown; mobile rows clip status chips. `admin__architecture`: ReactFlow controls/minimap
  stay light-themed in dark mode + hydration mismatch. `admin__catalog__components`: light-mode
  search input keeps dark UA widget fill; 8× React duplicate-key console errors.
- `agentic-dev` + `local-first`: the composition-drift pair (root #1 above), still-present from
  the 2026-07-09 audit.

## Persona walkthrough (CAISSON-131)

Grounding DEGRADED and flagged, not faked: PostHog caisson-prod returns **0 sessions/90d**
(filtered + unfiltered), so severities are analyst judgment; persona reactions ground in the
standing compliance-buyer corpus, not a fresh Cookiy study. Top leaks: (1) marketplace = 26
equal-weight tiles mixing $199 modules with $1,449 bundles, no anchor/recommended default;
(2) the bundle popout — peak intent — carries no risk-reversal next to the $1,449 CTA; (3)
dashboard Plan "Buy" rows show no price. Builds to preserve: the cart's anxiety-reducer cluster,
magic-link default, honest empty-states. **Kimi-k3 Q1 correction adopted:** the "high" severity
on missing social proof fights the locked ADR-0082 truth floor — reframed as "underused truthful
signals" (Apache-2.0 base, docs depth, build-state transparency), an enhancement item, not a
defect; future persona dispatches must carry the locked ADRs in their constraint set.

## Coverage gaps (named, not averaged)

- `admin__business__*` 500s are a **harness artifact** (`getaddrinfo ENOTFOUND
postgres.railway.internal` from the local seed DB; the page fails loud by design) — those
  routes are unscored for content, not clean.
- Long-tail families (compare ×~20, glossary ×~30, modules ×26) were **sampled**, with all 47
  prior-open surfaces mandatorily covered; unsampled siblings inherit only cross-surface
  findings.
- One prior-open finding went unchecked by its lane (1 of 125) and closed with the
  appears-fixed set.

## Remediation queue (ordered, per adversarial round)

1. **F6 bundle count/composition truth** (≤1h, purchase-path, ADR-0082) — derive or delete.
2. **F5 interim**: `.cs-link` on the 6 legal anchors (minutes), then the scoped `.cs-prose a`
   default inversion.
3. **F3 docs mobile shell** (the 4 P0s + nav + TOC pill) — one layout + one CSS block.
4. **F2 accent token + gate-on-hex** — includes golden-file re-snapshot.
5. **F1 scrollbar/shadow affordance** on both code primitives (no soft-wrap) + the incomplete
   `verifyChain` sample fix.
6. **Admin family**: table-scroll wrapper + overflow guard; ReactFlow dark theme; duplicate-key
   fixes; support "(0)"-on-error honesty fix.
7. **Copy sweep**: `workspace:*` leak, local-sync grammar, ADR numbers in buyer prose, email
   footer claim + receipt support path, em-dash sweep (ADR-0080).
8. **F7**: PostHog web-vitals spot-check for the NaN metric; collapse ledger to one item.

**Operator forks surfaced (NOT auto-decided):** the code-surface contract unification (F8) and
the social-proof/positioning framing (Q1) — both routed to the design owner/operator.
