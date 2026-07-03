# ADR-0237 — Site presentation rework: eight fork locks (marketplace hub, nav rebuild, depth pages, renames, analytics)

**Status:** accepted · 2026-07-03 (fifth picker round, second sitting). Locks all eight forks of
`outputs/specs/site-presentation-rework/SPEC-site-presentation-rework.md` plus the operator's two
posture riders. **Supersedes ADR-0191's three-route marketplace** (F1) and **the ADR-0082
Agentic-Dev labeled-roadmap exception** (rider 2); **extends ADR-0118** (F8); consumes the
section-union renderer (ADR-0232/0235); pricing numbers untouched (ADR-0227). **Three picks are
operator OVERRIDES of the tabled recommendation** (F1 unified hub, F5 true id renames, F7
full-surface copy). Append-only; supersede with a later ADR, never edit.
**Tags:** `ui`, `frontend`, `billing`.

## Posture riders (operator, same sitting)

1. **Brand system is tweakable, not a frame.** ADR-0078/0189 stop being a hard ceiling for this
   rework: the designer lane may evolve the brand system (tokens, accent usage, elevation, motion,
   the new icon language) where the presentation earns it. Every tweak lands as an explicit
   design-system change in the build PRs (reviewable diff, contrast/a11y gates still binding) —
   evolution is authorized, silent drift is not.
2. **FULL V1-live launch posture.** The marketing surface speaks as a shipped V1 product,
   everywhere: **no roadmap labels, no "coming soon", no future-phase framing, no
   fast-follow disclaimers.** True-to-built still holds as the floor (nothing fabricated — the
   catalog is genuinely built now), but hedged/roadmap register is retired — including the
   ADR-0082 Agentic-Dev labeled-roadmap exception, which this rider supersedes. The F7 copy
   rewrite and the depth pages are written in this posture.

## Decision

| Fork                       | Lock                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F1 — marketplace IA**    | **OVERRIDE: unified `/marketplace` hub** — tabs Editions · Modules · Build · Plans; `/pricing` 301s into it (`/modules` and `/build` fold in as tabs/deep-links). Supersedes the ADR-0191 three-route lock. Single buy-verb (0192) and the cart drawer (0193) unchanged.                                                                                                                                                                                                                                              |
| **F2 — depth surfaces**    | Real routes: `/marketplace/modules/[slug]` (or equivalent under the hub) for all 15 modules on the section-union renderer + one new `media` section kind; edition pages gain the media slot + card grammar; subscriptions get depth sections in the Plans tab. Product/Offer JSON-LD on every depth page. **Media slot ships with placeholder brand art — real media is a later phase, TBD.**                                                                                                                         |
| **F3 — nav arrangement**   | Logo left → **centered link row** (dropdown panels) → one right utility cluster: search · cart · Get-started · theme toggle. 900px drawer split + WCAG 2.2 AA (0194) stay.                                                                                                                                                                                                                                                                                                                                            |
| **F4 — dropdown set**      | **OVERRIDE of the two-panel rec: THREE card-panel dropdowns** — Editions (4 rich cards: icon + one-liner + price) · Marketplace (Modules / Build / Pricing-Plans as cards) · Resources (Docs · Glossary · Changelog · Security). The ADR-0190 panel pattern generalizes.                                                                                                                                                                                                                                              |
| **F5 — name collision**    | **OVERRIDE: rename the colliding module identifiers PROPERLY** — through catalog ids, entitlement slugs, registry/manifest surfaces, and Paddle product names (the `compliance` and `ai-kit` module↔edition collisions at minimum). Pre-launch, so the ripple is tolerable; the ADR-0216 manifest-retirement ledger is the registry mechanism. Replacement names are proposed in the build PR (the operator merge is the sign-off gate). Type chips (Module/Edition/Plan) additionally appear on every price surface. |
| **F6 — icons**             | **Bespoke in-brand icon set** (~21 marks: 15 modules + 4 editions + plans) via the designer lane, inside the ADR-0078 system, single-accent 0189-compliant — used in nav panels, cards, depth pages.                                                                                                                                                                                                                                                                                                                  |
| **F7 — copy scope**        | **OVERRIDE: full marketing surface rewrite** — home, marketplace hub, all card/depth copy, nav microcopy, edition pages, security, procurement, changelog framing. All through the house content pipeline (draft → honesty/copy-law skeptic → gate; ADR-0235 Fork-B pattern), ADR-0080 laws binding.                                                                                                                                                                                                                  |
| **F8 — analytics posture** | **Split by surface** (extends ADR-0118): marketing stays cookieless — Plausible custom-event funnel (`view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, nav/search engagement); PostHog captures `purchase` + revenue **server-side from the Paddle webhook** (authoritative), its JS client staying dashboard-only. Both sinks env-gated no-ops.                                                                                                                                                             |

## Consequences

- **Build waves (sequenced after the glossary batch-1 merge — shared nav/routes/footer surface):**
  wave 1 = hub IA + nav rebuild + footer derivation + renames; wave 2 = depth pages + placeholder
  media + icons + copy rewrite; wave 3 = analytics wiring + SEO coherence pass + sweep. Clear items
  (footer, analytics wiring per F8, SEO pass, sweep, placeholder-media approach) are pre-authorized
  by the SPEC.
- **F1 SEO care:** the `/pricing` 301 must preserve equity — permanent redirects, sitemap +
  canonical + internal links updated in the same change; `/modules`/`/build` redirect likewise if
  their paths move under the hub.
- **F5 is a breaking ripple by choice:** registry ids, members maps, entitlement slugs, and Paddle
  product names change together in one wave with a migration/mapping for any existing sandbox
  grants; the mirror/oss export and docs sweep ride the same PR set.
- Design research front-half per doctrine: refero patterns → `gw-frontend-designer` +
  `impeccable`; `gw-persona-walkthrough` critiques the rebuilt funnel before SHIP. EVAL n/a; UI
  review fires at SHIP (`ui`/`frontend` tags).
- Rider 2 sweep: the F7 rewrite greps the whole marketing surface for roadmap/future register
  ("roadmap", "coming soon", "planned", "will ship", "fast-follow") — zero hits ship; the
  Agentic-Dev page reads as live as Compliance.
