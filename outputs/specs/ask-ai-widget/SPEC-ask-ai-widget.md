---
title: "Ask AI" docs widget — pre-purchase self-serve answers over the docs corpus
status: FORKS TABLED — spec-only; no product code until an ADR locks the forks below (the one operator rule, CLAUDE.md)
tags: [ai, frontend, ui, security, billing]
proposed-adr: "the next free ADR number at lock time (0233+; ceiling 0232 after the 2026-07-03 fourth picker round — re-verify per ADR-0088). Filed ONLY once the forks lock."
adr-interactions: reuses ADR-0096 (services/docs retrieval contract) · reuses ADR-0009/0105 (support-bot grounded-RAG discipline, provider-agnostic model) · reuses ADR-0007 (integer money, if a credit/cost cap is metered) · extends ADR-0219 (CF front rate-limit for docs-api / a new site route) · relates ADR-0118 (Plausible sitewide + PostHog dashboard-only) · relates ADR-0196 (sitewide ⌘K)
linear: "(none yet — file a CAISSON issue in project 'Site & Buyer Dashboard' at PLAN, gitBranchName → feature/ask-ai-widget)"
originating-backlog: docs/state/opportunity-backlog.md:61 — "No pre-purchase 'ask AI' surface … Candidate: on-site widget or a docs-bot bridge; needs a small spec"
---

# SPEC — "Ask AI" docs widget

## Goal (WHAT + WHY)

**WHAT:** A buyer/prospect-facing "Ask AI" surface on `caisson.sh` that takes a natural-language
question, retrieves from the live docs corpus, and streams back a grounded answer with clickable
citations to the source doc pages — embedded in the docs reading experience.

**WHY now:** The originating gap (`docs/state/opportunity-backlog.md:61`): everything downstream of
a purchase is real and deployed, but **BUY has no pre-purchase AI surface**. The support bot answers
grounded questions from the exact same corpus — but it is reachable **only inside Discord**
(`services/support-bot`), which a prospect must join a server to use. The public site offers only
`⌘K` keyword search (`apps/site/app/api/search/route.ts` — a static Orama index, not semantic) and an
email address. A prospect evaluating Caisson cannot ask "does the compliance edition do HIPAA?" and
get a cited answer without talking to a human. This is **conversion-deflection + sales-assist**: the
grounded RAG that already answers buyers in Discord, surfaced where prospects actually are.

The asset already exists — the corpus, the retriever, and the grounding discipline are all built and
deployed. This widget is a **thin browser-facing front** over them, not a new AI system.

## Current state (what EXISTS — ground the design here)

**Retrieval — `services/docs` (live on Railway as `docs-api`):**

- `POST /query` is **retrieval-only**: it returns `{ chunks: ScoredChunk[] }` (RRF-scored doc
  sections with `source`/`title`/`section`/`pkg`/`license`), it does **NOT** synthesize an answer —
  `services/docs/src/app.ts:139-165`.
- It is a **server-to-server contract, not a browser surface**: Bearer-gated on `DOCS_SERVICE_TOKEN`
  (timing-safe SHA-256 compare, fail-closed) and **sets no CORS header** by explicit design —
  `services/docs/src/app.ts:1-5,70-77`. → A browser **cannot** call it directly; a server-side caller
  holding the token must front it.
- Input contract: Zod `.strict()`, `query` trimmed 1–2000 chars, `k` 1–20 —
  `services/docs/src/app.ts:22-28`.
- Abuse posture already built: per-IP + header-independent global token bucket, `X-Real-IP`-keyed
  (Strix vuln-0001), `/query` default budget **20 req / 60s** per IP, fail-**open** on limiter error —
  `services/docs/src/rate-limit.ts:24-74,141-202`. It is a **grey origin** (no CF WAF today) whose
  `/query` is "unauth-floodable spend (live OpenRouter embedding $ per hit)" —
  `services/docs/src/rate-limit.ts:5-8`.

**Synthesis — `services/support-bot` (the grounding discipline to reuse, Python, Discord-only):**

- `rag.py` is the full grounded pipeline: **retrieve → ground → generate → decide** —
  `services/support-bot/src/caisson_support_bot/rag.py:113-181`.
- Its grounding prompt is the reusable asset: answer **only** from the fenced, numbered context;
  treat retrieved text as **untrusted data**, never instructions; cite inline by path; emit the
  `INSUFFICIENT_CONTEXT` sentinel rather than guess (ADR-0009) — `rag.py:36-48`. Plus a context cap
  (`_MAX_CONTEXT_CHARS = 12_000`, `rag.py:63-64`), fence-tag neutralization against context-breakout
  injection (`rag.py:67-83`), a sentinel-lead escalation, and an output leak-guard (`rag.py:95-98,153-174`).
- Generation is an OpenRouter chat/completions client: `anthropic/claude-3.5-sonnet`, temp 0.1,
  max_tokens 800, k=6, question ≤ 2000 chars, 20s timeout, `HTTP-Referer`/`X-Title` attribution —
  `inference.py:30-79`, `config.py:38-49`. Model is provider-agnostic/env-swappable (ADR-0105).

**Site — `apps/site` (Next 16 App Router, Railway):**

- Docs surface: `app/docs/[[...slug]]/page.tsx` + `app/docs/layout.tsx` (Fumadocs). Corpus source =
  `apps/site/content/docs/**`.
- `⌘K` today = `app/api/search/route.ts` → Fumadocs static Orama, browser-side, `force-static` —
  keyword, **not** semantic, and no LLM.
- Auth: better-auth; `getSession` yields a session with `accountId` (fail-safe to personal account).
- Telemetry: **Plausible sitewide** (cookieless, env-gated `NEXT_PUBLIC_PLAUSIBLE`) — `app/layout.tsx:72-74`;
  **PostHog is dashboard-authed-only** — `app/dashboard/layout.tsx:48-50`. Docs pages are public → the
  widget's telemetry home is **Plausible**, not PostHog.
- CSP: `connect-src 'self' https://plausible.io https://*.paddle.com` — `app/security/page.tsx:124-126`.
  → A **same-origin** `/api/*` route works; a browser calling OpenRouter directly would be CSP-blocked
  **and** leak the key. This forces the design: **synthesis is server-side.**
- `fetchWithTimeout` is available from `@caisson/kernel` — `apps/site/lib/byok.ts:13`.

**Edge:** ADR-0219 flips `docs-api` to CF-proxied with a Free-tier rate-limit rule; any new
site route inherits the caisson.sh CF front. Docs-api comment length was capped in PR #82.

## Design (reuse-first — the spine is one route + one widget)

The whole feature is: **a same-origin Next Route Handler that ports `rag.py`'s grounding to TS and
streams, plus a docs-embedded widget that calls it.** No new service, no new dependency, no new
corpus. `services/docs` stays pure retrieval (its charter); synthesis lives in the site where the
browser session, CSP, and Plausible already are.

**Route: `POST /api/ask` (same-origin, `apps/site/app/api/ask/route.ts`, `runtime = 'nodejs'`)**

1. Zod `.strict()` body — `{ question: string.trim().min(1).max(2000) }` — mirror the docs contract
   exactly (`app.ts:22-28`) so a bad body dies here, not at OpenRouter.
2. **Rate-gate** (abuse budget — Fork F5). MVP reuse of the token-bucket pattern
   (`services/docs/src/rate-limit.ts`), `X-Real-IP`-keyed via CF, in-process single-replica (same
   ceiling as docs-api; a shared store is the multi-replica follow-up already noted there).
3. **Retrieve:** `fetchWithTimeout` → `services/docs` `POST /query` with the `DOCS_SERVICE_TOKEN`
   Bearer (server-side only — the token never reaches the browser), `k=6`. Empty/failed retrieval →
   escalate (no ungrounded answer), same as `rag.py:121-138`.
4. **Ground + generate (streaming):** compose the fenced, numbered context + the ported grounding
   prompt (reuse `rag.py:36-48` verbatim as the TS system prompt; keep the fence-neutralize
   `rag.py:67-83`, the 12k context cap, sentinel escalation, and leak-guard — these are the
   security controls, not optional polish). OpenRouter chat/completions with `stream: true`;
   `fetchWithTimeout` bounds connect, the stream itself is read incrementally.
5. **Stream to browser** as SSE / `ReadableStream` of text deltas, then a terminal `citations` event
   carrying the deduped `source` paths (mapped to their `/docs/...` URLs, client-side clickable).
   On sentinel/leak/empty → a single "couldn't answer from the docs — ask in Discord / email" event
   with the support links (the escalation path, mirroring `rag.py`'s `resolved: false`).

**Widget UI (`apps/site/components/ask-ai/*`, embedded per Fork F3):** a docs-sidebar entry point
that opens an input + streamed-answer panel with inline citation chips linking to doc pages. Design
via `gw-frontend-designer` + the brand floor; keep it a client component that only talks to
`/api/ask` (CSP `'self'`).

**Auth posture (Fork F1):** the route reads the better-auth session if present (to relax the rate
budget / tag telemetry for signed-in buyers) but does not _require_ it under the Recommended
anonymous posture. The `DOCS_SERVICE_TOKEN` and `OPENROUTER_API_KEY` are **server-only env** — never
`NEXT_PUBLIC_*`.

**Telemetry (Fork F6):** MVP = Plausible custom events (`ask_ai_opened`, `ask_ai_asked`,
`ask_ai_answered{resolved}`, `ask_ai_escalated`) — counts only, cookieless, matches the public-page
privacy posture (`app/layout.tsx:72-74`, legal/privacy already commits to Plausible-only on public
pages). Question-**text** capture is a privacy fork, not MVP.

**Cost/abuse budget (Fork F2 + F5):** every `/api/ask` hit is real OpenRouter spend. The layered cap
= same-origin CF edge rule (ADR-0219) → per-IP token bucket → global ceiling → per-request
`max_tokens`/`k` → a short streamed answer. A hard daily/global spend ceiling that fails closed to the
escalation message is in scope; per-account credit metering is a fork.

**Failure modes (all fail to the escalation message, never a wrong answer):** docs-api down/timeout →
escalate; OpenRouter non-2xx/timeout/malformed → escalate; sentinel or framing-leak → escalate;
rate-limit tripped → 429 + Retry-After surfaced as "busy, try again / Discord"; malformed body → 400.
Grounding is fail-safe by construction (ADR-0009): a refusal is always preferred to a hallucination.

## Atomic tasks (each = one commit; verify command per task)

1. **Port the grounding core to TS** — `apps/site/lib/ask-ai/rag.ts`: the system prompt
   (`rag.py:36-48`), fence-neutralize, context builder + 12k cap, sentinel-lead + leak-guard
   detectors. Pure functions, no I/O. _Verify:_ `bun test apps/site/lib/ask-ai` — port `test_rag.py`'s
   cases (sentinel escalation, injected `</context>` neutralized, leak fingerprint tripped).
2. **Retriever client** — `apps/site/lib/ask-ai/retrieve.ts`: `fetchWithTimeout` → docs `/query` with
   Bearer, Zod-validate the `{chunks}` response (reuse the `ScoredChunk` shape, `types.ts`). _Verify:_
   `bun test` with a stub fetch — 2xx maps chunks; non-2xx/timeout → throws the escalate error.
3. **Streaming synthesis + route** — `apps/site/app/api/ask/route.ts`: Zod body, rate-gate, retrieve,
   stream OpenRouter deltas, terminal citations/escalation event. _Verify:_ `bun test` route test with
   stubbed retriever + fake streaming inference (fake-inference pattern, `inference.py:87-99`): grounded
   Q → streamed text + citations; empty retrieval → escalation event; injected body → 400.
4. **Rate limiter** — reuse/adapt `services/docs/src/rate-limit.ts` token bucket for the route
   (`X-Real-IP` key). _Verify:_ `bun test` — N+1th request in window → 429 + Retry-After; window reset
   refills; global ceiling trips independent of IP.
5. **Widget UI** — `apps/site/components/ask-ai/*` + docs-layout entry point; streamed panel + citation
   chips; escalation state. _Verify:_ `bun run --filter @caisson/site build` green; `bun run --filter
@caisson/site typecheck`; visual pass via `gw-frontend-designer`.
6. **Telemetry + env wiring** — Plausible events; document `DOCS_QUERY_URL`, `DOCS_SERVICE_TOKEN`,
   `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and the rate/cost-cap vars in the site env + Railway.
   _Verify:_ `bun run --filter @caisson/site check`; env doc updated; no `NEXT_PUBLIC_*` secret.
7. **EVAL (`ai` tag)** — a small grounded-answer eval set (10–15 real prospect questions with known
   doc answers + a few unanswerable/injection probes); assert grounded answers cite the right source
   and unanswerable ones escalate. _Verify:_ the eval run passes tolerance (gw-eval, Act 6).

Standards gate: this is `apps/site` (outside the packages standards-gate; still runs the site
`check`/`build`/`typecheck`). No `packages/*` changed → no changeset. Security floor:
`fetchWithTimeout` on both outbound calls, timing-safe Bearer only server-side, Zod `.strict()` at the
route boundary, no secret client-side, security headers on the route response.

## Goal-backward verification (Act 4)

Re-ask the SPEC goal against the diff: **Can an anonymous prospect on a docs page ask a natural
question and get a streamed, correctly-cited answer from the docs corpus — with hallucination and
abuse both closed?** Confirm: (a) a real question streams a grounded answer whose citations resolve to
the right `/docs/...` pages; (b) an unanswerable question escalates, never invents; (c) a prompt-
injection probe in a retrieved chunk cannot exfiltrate the system prompt or break the fence; (d) the
docs `Bearer` and OpenRouter key never reach the browser (grep the built client bundle); (e) rate/cost
caps trip under a flood and the route fails closed to the escalation message. Any (a)–(e) failing →
new PLAN, do not ship.

## Risks

- **Cost blast radius** — the headline risk: a public, unauth LLM route is directly monetizable abuse.
  Mitigation = the layered cap (F2+F5); a hard global daily ceiling that fails closed is non-negotiable
  regardless of which abuse fork is chosen.
- **Prompt injection via retrieved docs** — our own corpus is trusted today, but the fence-neutralize +
  untrusted-data framing + output leak-guard from `rag.py` must be ported intact, not paraphrased.
- **Answer quality / brand risk** — a confidently-wrong answer on a sales surface is worse than none;
  the `INSUFFICIENT_CONTEXT` grounding contract (ADR-0009) is the floor, enforced by the EVAL task.
- **Corpus scope confusion** — the corpus is docs+READMEs (`types.ts` `DocKind`); it does **not** index
  marketing/pricing pages, so "how much is the compliance edition?" may retrieve nothing → escalate.
  This is the docs-only-vs-docs+marketing fork (F4).
- **Streaming under Railway/CF** — SSE through the CF proxy + Next standalone needs a
  no-buffer/`text/event-stream` response; verify end-to-end on Railway, not just locally.
- **Single-replica rate limiter** — in-process buckets don't span replicas (same known ceiling as
  docs-api); acceptable at launch scale, shared-store is the noted follow-up.

## OPEN FORKS (operator-owned — TABLED; recommend + wait, do NOT auto-decide)

### Fork F1 — Anonymous prospects, or auth-gated to signed-in buyers?

- **A (Recommended — high confidence).** **Anonymous**, with the abuse budget (F5) as the guardrail.
  The entire value is _pre-purchase_ deflection + sales-assist; gating it behind sign-in defeats the
  backlog's own framing ("pre-purchase 'ask AI' surface"). Read the session if present to relax
  limits, don't require it.
- **B.** **Auth-gated** (better-auth session required). Eliminates anonymous cost abuse and question
  telemetry ambiguity — but only existing buyers benefit, so it becomes a support convenience, not a
  conversion lever. Keep as the fallback if F5's caps prove insufficient in practice.
- _Rationale:_ A is the only option that serves the stated goal; B's safety win is fully recoverable
  via F5 without abandoning prospects.

### Fork F2 — Model lane + cost budget (which OpenRouter model)?

- **A (Recommended — high confidence).** **Reuse the support-bot's lane** — `OPENROUTER_MODEL` default
  `anthropic/claude-3.5-sonnet`, temp 0.1, max_tokens ~800 (`config.py:38-49`). Same grounded corpus,
  same answer quality bar, one model story to reason about; env-swappable (ADR-0105) so the operator
  can drop to a cheaper model without a code change.
- **B.** **A cheaper/faster model for the public lane** (e.g. a Haiku-class or a cheap open model) to
  cut per-answer cost, accepting a lower answer ceiling on a first-touch surface.
- _Rationale:_ A gets a proven-good answer live with zero new tuning; if cost telemetry later says the
  public lane is too pricey, flipping one env var to B is free. Start high, drop on evidence.
- _Operator input needed:_ the **hard daily/global spend ceiling** (a dollar/credit number) — the spec
  fails closed to escalation at the cap; only you set the number.

### Fork F3 — Placement: docs-sidebar widget, ⌘K "Ask AI" tab, or both?

- **A (Recommended — medium-high confidence).** **Docs-sidebar/inline widget first**, ⌘K a fast-follow.
  The docs layout is a clean, owned embed point; today's ⌘K is Fumadocs' static Orama dialog
  (`api/search/route.ts`) and grafting an LLM tab into that component is more surface for less MVP value.
- **B.** **⌘K tab (ADR-0196 sitewide palette) as the primary** — one discoverable entry everywhere,
  but couples the MVP to the Fumadocs search-dialog internals.
- **C.** **Both from day one** — most reach, most surface area, slowest to ship.
- _Rationale:_ A ships the value where evaluators already read docs; ⌘K reach is an additive follow-up
  once the route is proven. Avoid coupling the MVP to the search-dialog component (B/C) up front.

### Fork F4 — Corpus scope: docs-only, or docs + marketing/pricing?

- **A (Recommended — high confidence).** **Docs-only** — the corpus _is_ docs + READMEs
  (`types.ts` `DocKind`); it's what's indexed and deployed. Pricing/edition/marketing questions
  retrieve nothing → clean escalation. Set expectations honestly ("ask about the docs").
- **B.** **Add marketing/pricing pages to the index** so it answers "what does compliance cost?" too —
  a real sales-assist win, but it's a **corpus-pipeline change in `services/docs`**, not this widget,
  and pricing text drifts (a stale cited price is a liability). File it as its own item.
- _Rationale:_ A ships against the built corpus with zero pipeline risk; B is a separate,
  higher-liability corpus project the widget can consume later for free.

### Fork F5 — Abuse posture: per-IP caps only, Turnstile challenge, or both?

- **A (Recommended — high confidence).** **Layered caps, no challenge, for MVP**: CF edge rule
  (ADR-0219) → per-IP token bucket (reuse `rate-limit.ts`) → header-independent global ceiling → a hard
  daily spend cap that fails closed. Zero UX friction on a conversion surface; it's the exact posture
  docs-api already runs, hardened by Strix.
- **B.** **Add Cloudflare Turnstile** (invisible/managed challenge) gating `/api/ask`. Strongest
  anti-automation, but adds a third-party script + a CSP `connect-src`/`script-src` entry and some
  first-touch friction. Hold in reserve — turn on if A's telemetry shows real abuse.
- **C.** **Both immediately.** Belt-and-suspenders; unnecessary friction/cost before there's evidence
  of abuse.
- _Rationale:_ A matches the proven docs-api posture with no friction; B is a clean escalation lever
  kept ready, not spent pre-emptively.

### Fork F6 — Telemetry depth: Plausible counts only, or capture question text?

- **A (Recommended — high confidence).** **Plausible custom-event counts only** (opened/asked/
  answered/escalated) — cookieless, no question text, consistent with the public-page privacy posture
  and the legal/privacy commitment (`app/layout.tsx:72-74`, `legal/privacy`). Enough to prove
  deflection value.
- **B.** **Capture question text** (into PostHog or a table) to mine what prospects actually ask —
  genuinely valuable for `gw-product-insights` and docs gaps, but PostHog is dashboard-authed-only
  today (`dashboard/layout.tsx:48-50`), questions may contain PII, and it needs a privacy-policy line.
  A real follow-up with its own privacy fork, not MVP.
- _Rationale:_ A answers "is it working?" with zero privacy surface; B is a deliberate,
  separately-consented analytics decision.

### Fork F7 — Synthesis home: port RAG into the site route, or add a streaming endpoint to services/docs?

- **A (Recommended — medium-high confidence).** **Port grounding to the site `/api/ask`.** Keeps
  `services/docs` a pure retrieval, non-browser, server-to-server contract (its explicit charter,
  `app.ts:1-5`); the browser session, CSP, Plausible, and better-auth all already live in the site.
  The reusable asset is the _prompt + guards_, which port cleanly to TS.
- **B.** **Add a browser-facing streaming `/answer` to `services/docs`** so retrieval + synthesis stay
  co-located in one service and one language. But that gives the docs service a CORS/browser surface
  and an LLM-generation responsibility it deliberately doesn't have, and duplicates the site's auth/CSP
  story — a charter change for that service.
- _Rationale:_ A is the smaller, lower-blast-radius change and respects each service's existing charter;
  B centralizes RAG at the cost of expanding the docs service's trust surface.

**Confidence legend:** high = strong evidence + low regret; medium-high = clear lean, one real
tradeoff. All seven wait for an operator lock (→ ADR-0229) before any code lands.

## Effort / value

**Effort:** M — one route + one ported grounding module + one widget + rate limiter + a small eval;
~all in `apps/site`, no new package, no new dependency, no corpus change. **Value:** HIGH — closes the
last structural BUY-funnel gap using assets that are already built and deployed; the marginal build is
the browser front, not the AI.
