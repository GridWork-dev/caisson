# Caisson production browser audit — 2026-07-10-full-01

**Advisory:** this run does not gate CI and does not promote Playwright tests.

Mode: exhaustive requested · executed 2026-07-10 to 2026-07-11 · visual auditor: GPT-5.6 · Ring 1 public rendered audit via isolated Chrome/CDP evidence surface · Rings 2/3 authenticated execution blocked because distinct Codex `@Chrome` profiles were not exposed in this session.

Production origins: `https://caisson.sh` · `https://admin.caisson.sh`

Reference lock: [reference-lock.md](reference-lock.md) · decision ledger: [decision-ledger.md](decision-ledger.md)

Evidence retention: the report, findings, journals, metrics, accessibility snapshots, Lighthouse
reports, manifest, and performance trace are tracked. The complete `screenshots/` matrix remains
organized locally in the audit worktree and gitignored to avoid adding approximately 235 MB to
repository history. Screenshot paths below are stable local evidence references; the corresponding
machine-readable evidence is tracked. Promotion verification: [VERIFY.md](VERIFY.md).

## Outcome

- Manifest: 51 surfaces, comprising 27 public, 10 buyer, and 14 admin routes.
- Public render coverage: all 27 routes at 1440×900 and 390×844, light and dark. Every route rendered; no captured state had horizontal document overflow or a broken image.
- Public interaction coverage: mobile nav open/Escape/focus return, docs search/results/Escape, marketplace compare, cart add/open/remove, invalid login input, theme parity, signed-out commercial handoff, and static procurement/legal discovery.
- Signed-out auth boundary: all 10 buyer routes stopped at Cloudflare Access; all 14 admin routes redirected to the operator login with a return path.
- Authenticated Ring 2 and Ring 3 journeys: blocked and therefore `not-covered`. Credential presence passed boolean-only preflight, but the required distinct buyer/admin Codex Computer Use profiles could not be proven or selected. CDP credential injection and Playwright substitution were rejected.
- Production mutations: none. A public browser-local cart item and compare selection were reverted and verified. No purchase, cancellation, message, upload, identity, authorization, probe-account, or admin-fixture mutation occurred.
- Highest risk: four replayed P1 defects affect the homepage proof artifact, docs bypass navigation, marketplace compare targeting, and docs-search focus return.
- Picker: none. Findings have direct accessibility/behavior requirements and do not create an unresolved design fork.

## Audit health score

| #         |         Dimension |            Score | Key finding                                                                                       |
| --------- | ----------------: | ---------------: | ------------------------------------------------------------------------------------------------- |
| 1         |     Accessibility |              2/4 | Docs landmark/skip failure, compare targets below WCAG 2.2 AA, and docs-search focus loss         |
| 2         |       Performance |              3/4 | Mobile home LCP 364 ms and CLS 0.00 under Fast 4G + 4× CPU; graceful WebGL path still logs errors |
| 3         | Responsive design |              3/4 | No overflow or broken imagery, but multiple mobile controls miss the 44px Caisson target          |
| 4         |           Theming |              4/4 | All routes rendered in light and dark with the correct theme control state                        |
| 5         |     Anti-patterns |              4/4 | Distinct, evidence-forward Caisson system; no generic gradient-text/glass/cream/editorial drift   |
| **Total** |                   | **16/20 — Good** | **Address the four P1s before treating the public surface as release-clean**                      |

## Anti-pattern verdict

Pass. The public system reads as Caisson rather than generic AI SaaS: cold-steel surfaces, controlled teal, real code/control evidence, exact commercial copy, and consistent typography survive across themes and breakpoints. The long marketplace is dense by product necessity, not an undifferentiated card-grid aesthetic. The invisible homepage code panel is an implementation defect, not a direction failure.

## Findings

### [P1 · high] CAISSON-PBA-001 — Homepage real-code viewer is present but zero-height

Ring/journey/URL: public · evidence discovery · `https://caisson.sh/`

The “Real paths. Real code. No screenshots.” section promises an interactive code artifact. The tree renders and its radio choices are operable, but `.codeCard` computes to `720×0` on desktop and `342×0` on mobile. Changing the selected package does not make the code visible. A fresh isolated session reproduced the zero-height panel.

Expected: the selected real code card remains visible beside or below the tree, and selection changes update an observable proof artifact.

Evidence: `screenshots/public/repo-codecard-before.png`, `screenshots/public/repo-codecard-after-kernel.png`, `metrics/repo-codecard-clean-replay.json`, `screenshots/public/desktop-dark-home.png`, `screenshots/public/mobile-dark-home.png`.

Rule: Caisson DESIGN.md “artifact is the headline”; Refero Oxide/Warp lock; behavior rubric requires an observable before/after state. Local source seam: `apps/site/components/repo-artifact.module.css:32` and `apps/site/components/repo-artifact.tsx:244`.

Replay: clean session, 1 attempt, reproduced.

### [P1 · high] CAISSON-PBA-002 — Docs skip link has no target and the document has no main landmark

Ring/journey/URL: public · docs keyboard navigation · `https://caisson.sh/docs`

The first focusable control is “Skip to content,” but activating it only changes the hash to `#main-content`; there is no matching target and no `<main>` landmark, so scroll and focus remain at the top. Lighthouse reproduced `landmark-one-main` and `skip-link` failures on mobile and desktop.

Expected: one main landmark with a focusable/scrollable `#main-content` target that bypasses repeated docs chrome.

Evidence: `metrics/docs-skip-link-action.json`, `metrics/docs-skip-link-clean-replay.json`, `screenshots/public/docs-skip-link-after.png`, `lighthouse/docs-mobile/report.json`, `lighthouse/docs-desktop/report.json`, `accessibility/desktop-light-docs.txt`.

Rule: WCAG 2.2 1.3.1 and 2.4.1; Impeccable accessibility; Caisson AA floor. Local source seam: `apps/site/app/docs/layout.tsx:10`.

Replay: clean session, 1 attempt, reproduced.

### [P1 · high] CAISSON-PBA-003 — Marketplace compare controls fail WCAG target size

Ring/journey/URL: public · marketplace comparison · `https://caisson.sh/marketplace`

Each compare checkbox is 13×13px. Its label is approximately 69×19px and overlaps the card’s full-surface preview button, leaving only a 13px safe target in Lighthouse’s hit-area analysis. The checkbox can be toggled, but it fails the 24×24px WCAG 2.2 AA target-size requirement. The clean replay toggled the control and restored it unchecked.

Expected: at least a 24×24px safe target for AA and preferably the locked 44px Caisson/Impeccable touch target, without overlap from the stretched card action.

Evidence: `lighthouse/marketplace-mobile/report.json`, `screenshots/public/marketplace-compare-before.png`, `screenshots/public/marketplace-compare-after.png`, `screenshots/public/marketplace-compare-revert.png`, `metrics/marketplace-compare-clean-replay.json`.

Rule: WCAG 2.2 2.5.8; Impeccable responsive target-size check. Local source seam: `apps/site/components/marketplace.module.css:99` and `apps/site/components/marketplace-surface.tsx:421`.

Replay: clean session, 1 attempt, reproduced.

### [P1 · high] CAISSON-PBA-004 — Docs search loses focus when dismissed

Ring/journey/URL: public · docs search/recovery · `https://caisson.sh/docs`

Search opens as a named dialog, accepts a query, and returns relevant documentation results. Pressing Escape closes it, but focus lands on `<body>` instead of returning to the “Open Search” trigger. A second isolated session reproduced the loss.

Expected: closing the dialog by Escape or close control returns focus to the invoking search button.

Evidence: `screenshots/public/docs-search-open.png`, `screenshots/public/docs-search-results.png`, `metrics/docs-search-focus-return.json`, `metrics/docs-search-focus-return-clean-replay.json`.

Rule: WCAG 2.2 2.4.3; Impeccable product register and behavior rubric require focus return and recoverable modal state.

Replay: clean session, 2 attempts, reproduced.

### [P2 · high] CAISSON-PBA-005 — Docs GitHub SVG has an image role without a text alternative

Ring/journey/URL: public · docs navigation · `https://caisson.sh/docs`

The GitHub navigation link contains an SVG with `role="img"` but no title or accessible label. The surrounding link remains discoverable, yet the malformed image node degrades the accessibility tree and Lighthouse agentic-browsing score.

Expected: mark the SVG decorative or give it an accessible name consistent with the link.

Evidence: `lighthouse/docs-desktop/report.json`, `accessibility/desktop-light-docs.txt`.

Rule: WCAG 2.2 1.1.1; Impeccable accessibility names/roles.

Replay: same-session desktop/mobile evidence, reproduced.

### [P2 · high] CAISSON-PBA-006 — Mobile control sizing is systemically below the 44px product target

Ring/journey/URL: public · responsive navigation and media controls · multiple routes

Across the public shell, cart and mobile-menu controls measure 36×36px; docs search/sidebar controls measure 34×34px; carousel arrows measure 32×32px; many primary links/buttons are 40px tall. Most exceed WCAG’s 24px AA minimum, but they miss Caisson’s stricter touch-target expectation and create avoidable motor-target friction.

Expected: a 44×44px minimum interactive hit area, using invisible padding where the visual control should remain compact.

Evidence: `metrics/mobile-light-home.json`, `metrics/mobile-light-docs.json`, `metrics/mobile-light-compliance.json`, `metrics/mobile-light-provenance.json`, `screenshots/public/mobile-dark-home.png`, `screenshots/public/mobile-dark-docs.png`.

Rule: Impeccable responsive audit; Caisson accessibility credibility principle.

Replay: broad 27-route mobile sweep, reproduced.

### [P2 · medium] CAISSON-PBA-007 — WebGL-unavailable fallback logs repeated renderer errors

Ring/journey/URL: public · homepage first load · `https://caisson.sh/`

When Chrome cannot allocate a WebGL context, the homepage remains readable and the poster-first layout holds, but Three.js emits repeated console errors and Lighthouse best-practices drops to 92. This is a graceful visual fallback with noisy failure handling, not a content-blocking defect.

Expected: capability detection or caught renderer initialization that preserves the poster without repeated error logging.

Evidence: `lighthouse/home-desktop/report.json`, `screenshots/public/desktop-dark-home.png`.

Rule: Caisson poster-first ambient-field contract; Impeccable performance/error-state discipline.

Replay: same-session constrained renderer, reproduced.

## Coverage

| Ring             | Surface count | Render/boundary result                   | Interaction result                                                                               | Mutation result                           |
| ---------------- | ------------: | ---------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Public           |            27 | Covered at desktop/mobile, light/dark    | Primary discovery, nav, search, comparison, cart, login-invalid, legal/procurement paths covered | Browser-local state reverted and verified |
| Buyer probe      |            10 | Signed-out boundary passed on all routes | Authenticated journeys `not-covered`: distinct probe profile unavailable                         | No mutation attempted                     |
| Authorized admin |            14 | Signed-out boundary passed on all routes | Authenticated journeys `not-covered`: distinct authorized operator profile unavailable           | No mutation attempted                     |

Boundaries not covered: authenticated entitled/unentitled buyer states, populated/empty buyer data, admin role/data states, server-side negative/recovery paths, reduced-motion emulation, slow/degraded authenticated dependencies, and probe/admin reversible mutations. These are not passes.

## Performance evidence

- Homepage mobile trace under Fast 4G and 4× CPU: LCP 364 ms, TTFB 92 ms, render delay 271 ms, CLS 0.00.
- DOM: 1,271 elements, maximum depth 14, largest layout update 41 ms, style recalculation 45 ms; no estimated Lighthouse savings.
- Third-party impact: Plausible 519 B; Cloudflare main-thread work 25 ms; no estimated savings.
- Render sweeps found no horizontal document overflow or broken images across the 108 public route/theme/viewport combinations.

## Mutations

No production mutation was authorized or attempted. Public local-only state exercises:

- Marketplace compare: unchecked → checked → unchecked, verified in a clean context.
- Cart: empty → Compliance item → empty, `cs-cart-v1` verified as `[]` and all dialogs closed.
- Login invalid email: browser validation blocked submission; input reset to empty.

Authenticated mutation journal is empty, `mutation_lock` is false, and no residue is known.

## Positive findings

- All public routes have a single H1, stable titles, `lang="en"`, and no broken captured images.
- Marketing pages consistently expose a working skip link and main landmark; the docs subtree is the exception.
- Light/dark parity is coherent, with correct theme-control state and no identity drift.
- Mobile nav is a real dialog: Escape closes it, scroll lock clears, and focus returns to “Open menu.”
- Docs search returns relevant results for “row level security.”
- Invalid email submission stays on the field with native recovery guidance.
- Commercial copy clearly distinguishes one-time code, yearly plans, update windows, renewal consequences, and merchant of record.
- Signed-out buyer/admin surfaces fail closed.

## Candidate deterministic tests

None staged. The four P1 findings have clean replay evidence, but candidate tests require operator acceptance, deterministic fixtures/selectors, and a separately authored/reviewed Playwright change.

## Recommended actions

1. **[P1] `/impeccable harden`**: restore measurable height and selection behavior to the homepage real-code viewer at both breakpoints.
2. **[P1] `/impeccable audit`**: add the docs main landmark/target and correct the docs GitHub SVG accessibility tree.
3. **[P1] `/impeccable adapt`**: enlarge marketplace compare safe targets and remove overlap with the stretched preview action.
4. **[P1] `/impeccable harden`**: return focus to the docs search trigger on every dismissal path.
5. **[P2] `/impeccable adapt`**: raise public-shell, docs, carousel, and CTA hit areas to the 44px internal target.
6. **[P2] `/impeccable optimize`**: make the WebGL poster fallback silent after capability detection.
7. **[P2] `/impeccable polish`**: re-run the four-route Lighthouse set and the 108-state visual sweep after fixes.

Re-run `/impeccable audit` after fixes to measure the score change.
