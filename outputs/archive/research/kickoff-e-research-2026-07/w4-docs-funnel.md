# W4 Research 2/2 — Docs Conversion Instrumentation (Gap #12)

## 0. Locked precedent (quoted)

**ADR-0237 F8** (site-presentation-rework-locks.md:37), extending ADR-0118:

> "**Split by surface** (extends ADR-0118): marketing stays cookieless — Plausible custom-event funnel (`view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, nav/search engagement); PostHog captures `purchase` + revenue **server-side from the Paddle webhook** (authoritative), its JS client staying dashboard-only. Both sinks env-gated no-ops."

**ADR-0236** (ask-ai-question-text-capture.md:13-20) — consent precedent for any new first-party capture:

> "**Capture question TEXT server-side, with a visible consent notice in the widget.**... **Disclosure:** the widget carries a one-line notice ('Questions are stored to improve the product — don't include secrets or personal data') visible before first submit, plus the same line in the site privacy copy. No dark-pattern burying."
> "**Scope of the record:** `{day, lane, question_text, answered|escalated}` — no IP, no user id, no answer text."

**ADR-0118** (web-analytics-plausible.md:6-8, 12): Plausible is "cookieless, no consent banner"; script is env-gated on `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, no-op when unset.

**Gap #12** (`docs/gtm/gaps-and-plays.md:33`): "No docs discover→quickstart→signup conversion instrumentation | **TRIGGER-PARKED** | Fumadocs + ask-AI intent capture exist; attribution tracking waits for real traffic."

---

## 1. Current wiring (file:line)

**Plausible** — marketing + docs, cookieless, no consent banner:

- `apps/site/components/plausible-init.tsx:12-27` — mounted once in `apps/site/app/layout.tsx:74` (ROOT layout). Env-gated on `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; no-op (no import, no network) when unset.
- Custom events: `apps/site/lib/analytics.ts:5-23` — typed union `view_item | add_to_cart | view_cart | begin_checkout | nav_panel_open | search_open`. Fired from `track-view.tsx:11`, `add-to-cart-button.tsx:33`, `cart-provider.tsx:78`, `nav-panels.tsx:107`, `nav-search-trigger.tsx:26`, and `paddle-checkout.ts:76` (`begin_checkout`, fired only past the Paddle no-op guards).
- **Docs are already inside Plausible's blast radius**: `apps/site/app/docs/layout.tsx` (`DocsLayout` from fumadocs-ui) nests under the root `app/layout.tsx` — no separate `<html>`/`<body>`, so `PlausibleInit` (and its automatic pageview tracking) covers every `/docs/**` route today, for free. What does **not** fire on docs pages: the marketing `SiteNav`/`NavPanels`/cart custom events — docs use fumadocs' own nav shell (`apps/site/lib/layout.shared.tsx:6-19`, wordmark only, no `NavPanels` import), so `nav_panel_open`/`view_item`/`add_to_cart` never fire there. Only bare pageviews.
- **Deploy state**: Plausible Cloud, **$9 Starter plan**, confirmed active and collecting (`docs/state/providers.md:140`).

**PostHog** — two disjoint surfaces, deliberately not unified client-side:

- Client (dashboard-only): `apps/site/components/posthog-init.tsx:24-47`, imported **only** from `apps/site/app/dashboard/layout.tsx:7,50` — never the root layout, so the cookieless docs/marketing pages never load PostHog JS. `persistence: "memory"` (no cookie/localStorage), `person_profiles: "identified_only"`, `posthog.identify(accountId)` fired on every mount.
- Server (webhook, authoritative): `services/license/src/posthog-capture.ts:49-84` — `capturePostHogPurchase()` fires a `purchase` event with `distinct_id: accountId` (same id the dashboard `identify()` uses), `revenue`, `amount_minor`, `currency`, `entitlements[]`, wired into the grant path at `services/license/src/app.ts:366,379` and `server.ts:121,143`. Never throws (money path can't depend on analytics); config-gated on `POSTHOG_CAPTURE_KEY` (unset → `posthogCapture: null` injected, `server.ts:121`). **Not yet confirmed set in `docs/state/providers.md`** — code shipped, deploy-state unconfirmed.

**Consent posture today**: no banner anywhere. Plausible = cookieless-by-design, no PII, no consent surface needed (ADR-0118). PostHog dashboard client = cookieless via `persistence: 'memory'` + `identified_only`, lawful basis = privacy policy accepted at signup (authed route only) — same reasoning documented inline at `posthog-init.tsx:11-23`. PostHog server capture = no PII beyond `accountId` + purchase facts, no client script at all. The one precedent for a **visible consent notice** is ADR-0236's ask-AI widget (`components/ask-ai/ask-ai-panel.tsx:240`, `app/legal/privacy/page.tsx:124`) — used because that capture stores free-text user input; nothing proposed here captures free text, so that precedent doesn't force a new banner, but it is the template to reuse _if_ a future step ever captures text.

**Signup completion event — does NOT exist yet.** No `trackEvent`/`posthog.capture` call in `app/(marketing)/login/login-form.tsx` or anywhere in `packages/auth/`. The only post-auth analytics signal today is the _side effect_ of `PostHogInit`'s `identify(accountId)` firing on first `/dashboard` mount (dashboard layout, `app/dashboard/layout.tsx:50`) — that's an identity binding, not a discrete "signup complete" event, and it doesn't distinguish new signup from returning login.

---

## 2. Can new instrumentation land without a new consent surface?

**Yes, entirely** — for both halves, by staying inside each tool's existing gate:

- **Plausible custom events are cookieless by construction** (no persistent id, no cross-session join) — adding `view_docs_page`/`quickstart_reached`/`view_docs_getting_started` goals is identical in privacy shape to the six events already live (`view_item`, `nav_panel_open`, etc.). No new banner, no new ADR needed for this half — it's a straight extension of the already-locked F8 event set onto docs routes that are already inside Plausible's mount boundary.
- **PostHog on docs would be different**, and here's the ADR-0237 F8 exact-language test: F8 says PostHog's "**JS client stay[s] dashboard-only**." Docs pages are pre-auth, unauthenticated marketing-adjacent surface — not `/dashboard`. Loading PostHog JS on `/docs/**` would **violate the literal lock** ("dashboard-only" is unambiguous) and would also reintroduce exactly the risk ADR-0118 rejected ("a full PostHog session-capture would undercut [cookieless] positioning" — ADR-0118:14-15). **Verdict: extending PostHog's JS client onto docs pages needs a superseding/rider ADR, not just an implementation PR.** It is not a hygienic reading of "dashboard-only" to mean "dashboard-only, plus docs" — that's the one term in the whole lock precise enough to fail a rider-free extension.
- **A server-side PostHog capture for a _docs_ event** (no client script) would be consent-clean the same way `posthog-capture.ts` already is, but there's no natural server-side signal for "visitor read the quickstart" — that's an inherently client-observed action (a page render), unlike a webhook-delivered purchase.

**Net**: everything before signup lands as Plausible-only goals with zero new consent surface. Anything that wants PostHog's session/funnel machinery on pre-auth docs pages needs a rider ADR first.

---

## 3. Funnel event schema candidates

**Discover → quickstart → signup, Plausible side (add to the existing `MarketingEvent` union in `apps/site/lib/analytics.ts`):**

| Event                | Fired from (candidate)                                                                                                                                               | Properties                                                                                                                                                                        | Notes                                                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs_view`          | `apps/site/app/docs/[[...slug]]/page.tsx` (or a thin client wrapper akin to `track-view.tsx`)                                                                        | `{ slug: string }`                                                                                                                                                                | Discover-stage; distinguishes docs pageviews from marketing pageviews without over-fragmenting Plausible's page-path breakdown (Plausible already buckets by URL — this property is mostly redundant with the URL path itself; **may be unnecessary**, see §5). |
| `quickstart_reached` | mount on `content/docs/getting-started.mdx` specifically (the "spine of the setup guide" per its own Callout, `getting-started.mdx:5-7`)                             | none needed — a Plausible **goal** on the exact `/docs/getting-started` path covers this with zero code, using Plausible's built-in page-goal feature (no custom event required). | Cheapest option — configure as a Plausible dashboard goal, not code.                                                                                                                                                                                            |
| `docs_cta_click`     | any "Get started" / "Sign up" CTA rendered inside docs pages (if one exists — currently the docs surface has no signup CTA rendered inline; confirm before building) | `{ source: "docs" }`                                                                                                                                                              | Marks docs→auth handoff intent.                                                                                                                                                                                                                                 |

**Signup, cross-surface join point (the hard part):**

There is currently **no `signup_complete` event on either sink**. The precedent-safe place to add it:

- **Plausible side**: fire a custom event `signup_complete` from `app/(marketing)/login/login-form.tsx` on the password-signup success branch (`passwordMode === "signup"`) and on the magic-link/OAuth callback landing (`next` redirect target) — but Plausible has **no stable identity to join to**, so this only gives an aggregate count, never a per-visitor path from a specific docs pageview to a specific signup.
- **PostHog side** (reuse, not build): the dashboard's `PostHogInit` already calls `posthog.identify(accountId)` on first `/dashboard` mount (`posthog-init.tsx:39`) and the license webhook's `purchase` capture uses the identical `distinct_id: accountId` (`posthog-capture.ts:63`). **This is the existing join key** — `identify()` + `purchase` are already stitched. What's missing is a discrete `account_created` event distinguishing "just signed up" from "returning session, Nth login" — cheapest fix: pass a `isNewSession`/`justSignedUp` flag through the post-auth redirect (query param or session cookie set at signup, read once in `DashboardLayout`) and call `posthog.capture('account_created')` alongside the existing `identify()` call in `posthog-init.tsx`. Small, additive, no new consent surface (same authed-only, memory-persistence, `identified_only` posture already justified inline in that file).

**Cross-surface join reality**: Plausible (pre-auth, no identity) and PostHog (post-auth, `accountId`-identified) **cannot be joined at the individual-visitor level** — Plausible is cookieless by design and carries zero stable identifier across the auth boundary. The only available joins are:

1. **Aggregate rate joins** — "N docs-getting-started pageviews this week" (Plausible) vs "N signups this week" (Plausible custom event or PostHog `account_created`) — a ratio, not a per-user path.
2. **UTM/referrer stitching** — if a docs CTA appends `?ref=docs-quickstart` to the signup link, PostHog can capture that as a property on `account_created`/`purchase`, giving a coarse "came from docs" flag without ever joining to the specific Plausible pageview event. This is the practical middle ground.

**Plausible plan/funnel-feature caveat**: the repo is on Plausible Cloud's **$9 Starter plan** (`docs/state/providers.md:140`). Plausible's native "Funnels" report (multi-step conversion funnel UI) is a paid feature gated to higher tiers in Plausible's own pricing (Starter is the entry tier) — confirm current tier gating against Plausible's live pricing page before committing to it as the delivery mechanism; do not assume Starter includes it. Even where Plausible funnels ARE available, they operate on goals/pageviews within **one site/property** — same-domain within `caisson.sh` is fine (docs + marketing already share the property), but a funnel step defined as "signup" still can't be identity-joined to a specific earlier pageview, only counted as an aggregate step.

---

## 4. Tool-assignment options

**Option A — Plausible goals only (top-of-funnel), no PostHog change.**
Add `getting-started` as a Plausible page-goal + a `signup_complete` custom event fired from the login form. Zero PostHog change, zero ADR needed (straight extension of the already-locked F8 event set).

- Consent: no change (cookieless, already exempt).
- ADR-0237 compliance: fully compliant, no rider needed.
- Confidence: **high** this is buildable as-is. Gives conversion **rate**, not per-user path.

**Option B — PostHog funnels only, extend JS client onto docs pages.**
Load PostHog JS on `/docs/**` (anonymous, `person_profiles: 'always'` or similar) to get PostHog's native funnel UI end-to-end including pre-auth.

- Consent: forces a real design decision — anonymous PostHog tracking pre-auth is a different lawful-basis case than the current authed-only capture; likely needs the ADR-0236-style visible-notice treatment or a cookie-consent banner, undercutting the compliance-positioning rationale ADR-0118 explicitly protects (ADR-0118:14-15).
- ADR-0237 compliance: **violates F8's literal "dashboard-only" clause** — requires a superseding/rider ADR before build, not a silent implementation choice.
- Confidence: **low** as a "ship it" option; this is the one path that reopens a closed lock.

**Option C — Split: Plausible top-of-funnel (discover→quickstart→signup-click) + PostHog post-auth (signup-complete→purchase), joined only by a referrer/UTM property.**
Plausible gets the goals/events from Option A. PostHog gets the missing `account_created` event added to the existing `identify()` call (§3), carrying a `signup_source` property threaded through from a docs/marketing CTA (`?ref=` param → cookie/query → read once at signup → stamped on the PostHog event). No new client surface on docs pages.

- Consent: no change on either sink — both stay inside their already-justified postures.
- ADR-0237 compliance: fully compliant, no rider — PostHog JS client never moves off `/dashboard`.
- Confidence: **high** — this is additive on already-existing, already-audited code paths (`analytics.ts`'s event union, `posthog-init.tsx`'s identify call), and reuses the existing `accountId` join key rather than inventing a new one.

**Option D — Do nothing (hold the TRIGGER-PARKED status).**
Gap #12's own note: "attribution tracking waits for real traffic." Pre-launch, funnel volume may be too low for any of the above to produce actionable signal yet.

- Confidence: **medium** this is still the right call operationally, independent of which technical option is "correct."

---

## 5. Recommendation

**Option C, deferred behind Option D's timing gate** — i.e., the _design_ is Option C (split assignment, reuse the existing `accountId` join, referrer-property stitching for the docs-attribution question), but do not build it until gap #12's own stated trigger fires (real traffic volume). Confidence: **high** on the tool-assignment call (C over A/B), **medium** on timing (D's judgment call, matches the gap ledger's own annotation).

Rationale: Option C is the only path that (a) touches zero consent surfaces, (b) needs zero new ADR/rider, (c) reuses infrastructure that's already built and already reviewed (`posthog-capture.ts`'s `distinct_id` convention, the `MarketingEvent` union) rather than inventing new plumbing, and (d) doesn't ask Plausible's Starter-tier funnel feature to do a per-user join it structurally cannot do (no stable cross-auth identity). Option B is the one live trap in this space — it reads like the "just add PostHog everywhere" instinct but directly contradicts F8's own sentence; flag it explicitly if anyone proposes it. Skipped for now: building the actual event-firing code and the `?ref=` stitching plumbing — add when gap #12's real-traffic trigger fires, per the ledger's own parked note.
