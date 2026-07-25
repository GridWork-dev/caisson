# ADR-0378 — Media overhaul program: candidate locks (triad floor · toolbar catalog · drawer + strip · decision band)

- **Status:** LOCKED (operator, 2026-07-22)
- **Supersedes:** extends ADR-0377 (blueprint vocabulary + migrate-all) into the full
  media + marketplace + cart program; amends the ADR-0374-era marketplace surface layout.
- **Context:** CAISSON-145 expanded by operator lock into ONE program: standardized
  per-entity media set + marketplace desktop rework + cart/stack consolidation +
  homepage stack-module replacement. Candidates were produced dual-opinion — fable
  (in-session) and kimi-k3 (independent opencode agent session, worktree
  `caisson-wt-kimi`, `CANDIDATES-KIMI.md`) — over a 4-agent research sweep (refero +
  exa) and a full apps/site code recon; the operator reviewed both slates on a
  tailnet candidates page and locked via pickers.

## Grounding corrections (kimi, verified against source)

- The sellable catalog is **26 modules + 6 bundles = 32 entries** (`apps/site/lib/pricing.ts`
  `MODULE_PRICES`/`BUNDLE_PRICES`) — supersedes the "14 modules" framing used in the
  kickoff brief. All sizing below is for 26 + 6.
- A cart slide-over drawer, nav `CartTrigger`, and detail-page add-to-cart CTAs
  **already ship** — the cart work is consolidation and polish, not invention.

## Lock 1 — Media-set floor: A1 "proof triad" (joint pick, both slates independently)

Every module page carries: **bespoke schematic sheet + one interactive "poke" + the
code-artifact slide**; existing live component slides stay where shipped (ui-pro's
live kit slide IS its poke). Bundles **borrow, never fork**: strata sheet +
composition slide + the hero member's poke reused verbatim (Compliance ← field-crypto,
AI-Production ← ai-meter, Agentic-Dev ← agent lifecycle stepper, Local-first ←
local-store RRF explorer, Provenance ← audit-worm tamper lab; Everything stays
strata + composition). Slide order: depth pages lead with the sheet; the marketplace
card viewer leads with the poke. The 21 shared mechanism diagrams retire as bespoke
sheets land (ADR-0377 migrate-all lock). Produced Remotion loops (kimi's A3) are
explicitly DEFERRED to a later kickoff.

## Lock 2 — Poke discipline (binding build rules)

- One paradigm per module class, shared rigs under `apps/site/components/poke/`;
  kimi's 12-class / 9-rig / 25-poke table (CANDIDATES-KIMI.md §B) is the build-spec
  baseline; flagship four first: field-crypto envelope bench, audit-worm break-the-chain,
  ai-meter breaker console, guardrails boundary.
- Every poke runs the REAL primitive client-side (WebCrypto HKDF/AES-GCM/SHA-256, the
  package's own pure math) — no backend calls, no canned lookups dressed as computation.
- Every security-adjacent poke ships a tamper/break-it control; trust copy stated on
  the surface ("runs entirely in your browser").
- **Golden-pinned:** each poke's deterministic output is asserted against the package's
  own `__golden__` fixtures so demo and product cannot diverge silently.
- Honest-artifact floor: every rendered identifier exists in `packages/*` and is cited.
- Interactive slides must NOT use `MediaFrame decorative`; the carousel's arrow-key /
  focus interplay with focus-owning slides must be resolved in the flagship pilot.

## Lock 3 — Marketplace desktop: C1 "toolbar catalog" at 1140px (joint pick, kimi variant)

The 13rem facet rail AND the 21rem StackRail both die. A sticky filter toolbar
(segmented Type control All 32 / Bundles 6 / Modules 26 · Category + Price disclosure
panels · media toggle · search) sits above the grid; chip row + aria-live count stay.
Bundles band (`cs-grid--3`) leads, hairline divider, modules band (`cs-grid--3`,
≈341px cards) — inside the EXISTING 1140px `cs-container` (the fable ~1400px widened
variant was NOT taken; revisit only with evidence). `PreviewDialog`, compare tray,
`?view=` deep links, and URL-synced filtering all survive.

## Lock 4 — Cart & stack: D2 = kimi's amended drawer + an earned marketplace strip (fable variant)

- StackRail (desktop) and the mobile `<details>` stack dock are DELETED site-wide.
- The shipped `<dialog>` drawer is the one cart surface: widened 24rem → 26rem,
  true bottom sheet below 48rem (max-height 85vh, grab handle, safe-area padding),
  ghost "Keep browsing" close.
- **First-add-per-page rule (kimi):** the first `addItem` per page view auto-opens the
  drawer (confirmation + bundle-savings-nudge impression); subsequent adds on the same
  page view only pulse the re-keyed badge (compositor-only, reduced-motion safe).
  Never auto-opens on /cart or /dashboard/cart.
- **Marketplace summary strip (fable):** on /marketplace ONLY, once the cart is
  non-empty, a slim sticky bottom strip (count · subtotal · Review → opens the drawer)
  — the research-backed secondary trigger for long catalogs. Site-wide docks stay
  rejected.

## Lock 5 — Homepage: E2 "decision band" (kimi pick)

`StackBuilderLazy` (homepage section 11) is DELETED. Replacement: a slim band —
"Pick the path. The bundle follows." — with three persona path cards priced from the
pricing SOT (Pass an audit → Compliance $1,449 · Ship AI features → AI-Production
$739 · Build offline-first → Local-first $629), each deep-linking to the marketplace
with that bundle's viewer open (`?view=bundle:<id>`), never adding directly; ghost
link "Does it fit your stack?" → `/stack-fit`. Zero cart chrome on the homepage.

## Cadence (both slates agree)

Flagship-4 pokes + their sheets first (they sit on the wedge seams) → operator
screenshot review → class rigs + remaining sheets in parallel lanes, with the
C1/D2/E2 surface work as its own lane. PR #326 (pilot sheets) stays held on the
kickoff branch per its standing lock; the flagship pokes land on top of it.

## Provenance

Candidates page (tailnet, session-ephemeral) + `CANDIDATES-KIMI.md` (kimi worktree) +
4-agent research findings (session scratchpad). Dual-opinion disagreements were
surfaced verbatim to the operator: D (strip vs no strip — operator took the strip)
and E (picker vs band — operator took the band).
