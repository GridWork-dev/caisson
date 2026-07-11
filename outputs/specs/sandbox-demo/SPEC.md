---
status: draft-for-lock
owner: operator
---

# SPEC — Pre-purchase interactive sandbox/demo

**Status: draft-for-lock.** No build until the operator locks a fork on the options table below
(per ADR-0323 Decision 4c — spec-first, this doc tables forks, decides nothing). Tags:
`external-system`, `security`, `billing`, `frontend`.

**Grounds:** Cookiy 12-real-interview round, 2026-07-10 (study `019f4a11-8029-7726-ab71-
aef06ac4dcae`) — buyers volunteer distrust of polished demo videos ("might as well flip on a
YouTube commercial") and ask, unprompted, to poke at real code or a testable environment before
buying from a vendor with no case studies yet. ADR-0323 Decision 4c locks this residual as a
spec-first item, distinct from the trust/copy wave and the architecture-fit diagram (both
building now under the same ADR).

## Goal

Convert evaluation-stage distrust into verified confidence, without leaking commercial source or
opening an exfiltration/abuse surface. The buyer's stated need is narrow: _prove the stack
actually works, hands-on, before paying_ — not a marketing surface, not a video, not another
claim on a pricing page. Success is a prospect who can touch something real (running code, a
live component, an actual generated app) inside minutes of landing on the site, with zero
commercial source or license-signing material exposed to an unverified visitor.

## Current state — what already exists (read this before proposing anything net-new)

Caisson already ships four pieces that a sandbox could assemble rather than duplicate. Any
option below states, explicitly, which of these it reuses and what (if anything) is genuinely
net-new.

1. **Open-core Base is publicly readable today** (ADR-0094, extended by ADR-0136 to include
   `cli`/`migrate`/`license-verify`, i.e. the generator's dependency chain). `kernel`, `auth`,
   `tenancy-rls`, `ui`, `billing`, `credits`, `jobs`, `email`, `ai-config`, `mcp-server` are
   Apache-2.0 and — once the OSS mirror program (ADR-0318) flips public — sit in a real, clonable
   GitHub repo. A prospect can already read and run this code with zero gating. This is the
   cheapest form of "real code, not a video" and it is already true; the spec's job is to make it
   _discoverable and framed as proof_, not to build a new surface for it.
2. **Marketplace live-component rendering** (ADR-0290): the marketplace already renders live
   `@caisson/ui` components (server-safe, presentational) inline in the marketing surface. This
   proves visual/component fidelity but not integration or backend behavior — it is not a
   sandbox, it is a picture with real DOM under it.
3. **Evaluation access: demo mode + verified eval licenses** (ADR-0274, refined by ADR-0280,
   full build order fixed by ADR-0289 — **not yet built**, per `outputs/specs/eval-delivery/`
   not existing in-repo and PR #156's issuance route still 409-dark per ADR-0289's own context).
   Two tiers once built:
   - `create-caisson --demo`: generates against the **full six-bundle catalog** with demo
     stubs/watermarks for commercial modules — runnable scaffolding, never licensed source, no
     license-service change, no verification gate. This is the closest existing concept to "a
     sandbox" and is unbuilt.
   - Time-boxed eval license: a real `tier:pro` grant, ~14 days, watermarked source, gated behind
     work-email + $0 card-auth + an operator review queue (the ADR-0274 anti-exfiltration rider).
     This is licensed delivery of the actual commercial source, not a sandbox — it is the
     verified-buyer path, heavier than what a pre-purchase, no-signup demo needs.
4. **EULA continuity clause** (ADR-0276/0281/0282) governs licensed use after purchase; it has no
   bearing on a pre-purchase demo surface — noted here only to confirm this spec does not touch it.
5. **`create-caisson` generator** itself (open, per ADR-0136) already runs end-to-end for any
   visitor with the CLI installed, against the open Base plus whatever commercial modules a real
   license unlocks. It is the literal "testable environment" Cookiy's buyers asked for — today it
   just requires a terminal and (for the interesting compliance/AI modules) a license they don't
   have yet.

**What is genuinely net-new in every option below:** a _zero-signup, time-limited, backend-
verified_ execution surface that lets an unverified visitor run generated code (not just view a
component) without installing anything locally and without touching the real license-issuance
path. Nothing existing today does that; existing pieces are the parts each option assembles.

## Options

Each option states: what it reuses, what's net-new, security seam, cost, effort, trade-off.

### (a) Hosted throwaway sandbox environment

Spin up an ephemeral container/VM per visitor (e.g. a scoped Firecracker/gVisor pod or a managed
sandbox-as-a-service vendor), pre-seed it with a `create-caisson --demo` output, expose a
terminal + preview URL in the browser, auto-destroy on a TTL (e.g. 20 min) or idle timeout.

- **Reuses:** `create-caisson --demo` (once built per ADR-0274) as the seed payload; open Base
  fully; commercial modules as demo-stub/watermarked per the same ADR.
- **Net-new:** the hosting/orchestration layer (spin-up, TTL destroy, resource caps, terminal/
  preview proxy), abuse rate-limiting, and a bespoke cost-metering path (this is real compute
  spend per visitor, unlike every other Caisson demo surface).
- **Security seam:** no license-signing keys or production credentials anywhere near the sandbox
  image (fail-closed: the image ships with demo-mode env only, never a real `LICENSE_SIGNING_KEY`
  or Paddle/registry service tokens). Egress from the sandbox pod must be blocked or allowlisted
  (no outbound calls to internal Caisson infra beyond a public demo API, if any) — this is the
  same trust-boundary discipline as the exec endpoint's arg-array/Bearer gate, applied to a
  visitor-controlled container instead of an agent. Abuse surface: cryptomining, spam relay,
  scraping — needs per-IP/per-session rate limits and a kill switch.
- **Cost:** ongoing hosting spend scales with traffic (compute-seconds × visitors); a viral
  moment or an abuse campaign is a real bill, not just an engineering cost. Vendor sandbox
  services (a managed option) trade build effort for a recurring per-session fee.
- **Effort:** highest of the four — new infra surface, new abuse/cost controls, new operational
  runbook (who gets paged when sandbox spend spikes).

### (b) In-browser embed (WebContainer/StackBlitz-style) of open Base + one eval-licensed module

Run a Node-in-WASM environment client-side (e.g. WebContainers) seeded with the open Base plus
exactly one commercial module delivered under a scoped, watermarked eval-license grant — no
server-side compute per visitor, everything executes in the buyer's own browser tab.

- **Reuses:** open Base source directly (already public); the eval-license grant mechanics
  (ADR-0274/0280/0289) for the one commercial module shown, once that leg is built; ADR-0290's
  live-component rendering pattern for anything that doesn't need full runtime.
- **Net-new:** the WebContainer integration itself (boot a Node runtime in-browser, mount the
  repo, run install/build), and a **scoped-down eval-grant variant** — the existing eval license
  is designed for a real 14-day `tier:pro` window with card-auth + review queue; a sandbox embed
  wants something lighter (no card-auth friction) but still watermarked and non-exfiltrable
  (client-side code is inherently visible in devtools, so "one module, heavily rate-limited,
  short-lived signed grant" is the realistic ceiling, not full commercial parity).
- **Security seam:** because execution is client-side, the delivered module's source is fully
  visible to the browser regardless of watermarking — this option can only ever show ONE
  low-differentiation module (or a synthetic/redacted one) without accepting real source exposure.
  No production credentials ever reach the browser; the grant issuance must stay server-side and
  short-TTL.
- **Cost:** near-zero marginal hosting cost (client CPU, not server); the cost is the one-time
  integration build and increased bundle size on the demo page.
- **Effort:** medium-high — WebContainer integration is a known pattern (StackBlitz/CodeSandbox
  do this) but non-trivial to wire against a Bun-based monorepo (WebContainers are Node-target;
  Bun-specific behavior in Caisson's own tooling may not run identically inside the container —
  needs a spike before committing).

### (c) Demo-mode `create-caisson` run gated by a lightweight verified session (extends ADR-0274/0280)

Server-side: visitor requests a demo run (email only, no card, no review queue — deliberately
lighter than the eval license), backend runs `create-caisson --demo` in a locked-down job,
streams build output + a preview link back to the browser, artifact auto-expires.

- **Reuses:** `create-caisson --demo` directly (once built); the ADR-0274 anti-abuse posture
  (rate-limit, verified-domain-ish email check) scaled down from the real eval-license flow
  rather than reusing it wholesale — this is explicitly NOT the eval-license grant, it never
  issues `tier:pro`, never touches watermarked commercial source, and never reaches the license
  service at all.
- **Net-new:** the demo-run job orchestrator (queue, sandboxed execution, output streaming,
  artifact TTL/cleanup) and the lightweight identity check (something between "nothing" and the
  eval license's full work-email + $0-card-auth + review-queue stack).
- **Security seam:** demo mode by construction never touches commercial source (it's stubs/
  watermarks per ADR-0274 point 1), so the exfiltration surface this option carries is narrower
  than (a)/(b) — the risk shifts to compute abuse (someone hammering the demo-run queue) and
  needs the same rate-limit discipline as (a) but without the container-escape/egress concern
  since the artifact is generated code, not a live interactive shell.
- **Cost:** lower than (a) — jobs are bounded (`create-caisson` runs to completion and stops,
  no idle container burning time), but still real compute per run; scales with demo-request
  volume, needs a rate limit and a queue depth cap.
- **Effort:** medium — the demo-mode generator work is already scoped in ADR-0274 point 1
  (unbuilt); this option's net-new is "wrap it in a web-triggered job + streaming UI," which is
  smaller than either (a)'s infra or (b)'s WebContainer integration.

### (d) Read-only code browser over curated commercial excerpts

No execution at all: a curated, hand-picked set of real commercial-module source files (e.g. the
`audit-worm` hash-chain implementation, a `field-crypto` HKDF derivation) rendered read-only in a
code viewer on the marketing site, alongside the already-shipped code-artifact marketplace slides
(ADR-0290) but deeper — full files, not snippets.

- **Reuses:** ADR-0290's `code-artifact` slide kind and `CodeBlock` component directly; no new
  runtime, no new infra.
- **Net-new:** an operator-curated excerpt set (which files are safe to show in full — a manual,
  ongoing editorial decision, not automatable) and a slightly richer viewer (syntax-highlighted,
  scrollable, maybe multi-file) than the existing slide format.
- **Security seam:** narrowest of the four — nothing executes, nothing issues a grant, the only
  exposure is exactly the files the operator chose to publish, which is a documentation decision
  more than a security one. Zero abuse surface (no compute, no session, no rate-limit need).
- **Cost:** effectively zero ongoing cost.
- **Effort:** lowest of the four — mostly content curation + a moderate UI extension of an
  existing component.
- **Trade-off:** does NOT answer the buyer's actual ask. Cookiy's finding was "let me run it /
  poke at a testable environment," not "let me read more code" — the marketplace already
  half-answers that with live components and code-artifact slides (ADR-0290) and buyers still
  asked for more. This option is a cheap increment on what's already shipped, not a new
  distrust-remedy.

## Recommendation

**(c), with (d) shipped alongside it as the zero-risk immediate increment — not instead of it.**
Confidence: medium-high.

Rationale: (c) is the only option that gives an unverified, zero-signup visitor something that
actually _runs_ (the buyer's literal ask) while staying inside Caisson's existing anti-
exfiltration posture — demo mode never carries commercial source, so the security seam is
materially smaller than (a) or (b). It reuses the already-designed ADR-0274 demo-mode generator
(still unbuilt, but scoped) instead of inventing a new execution model. (a) solves a _different_
problem (interactive terminal access) at real recurring cost and a genuinely new abuse surface
this repo doesn't carry anywhere else today; (b) is technically elegant but caps at showing one
module and needs a WebContainer/Bun compatibility spike before its effort is even known. (d) is
correctly identified as insufficient on its own (Cookiy buyers want to run something, not read
more), but it is cheap, ships now, reuses ADR-0290 machinery outright, and directly extends work
already locked — do it regardless of which of (a)/(b)/(c) eventually gets picked.

Do NOT read this recommendation as a lock. Per ADR-0323 Decision 4c and the repo's one operator
rule, the fork stays open until the operator picks from the table below.

## Fork board (nothing pre-decided)

| #   | Fork                                                                          | Options                                                                                                                                                                                                  | Recommendation                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Which sandbox mechanism ships                                                 | (a) hosted container · (b) in-browser WebContainer · (c) server-side demo-run job · (d) read-only excerpts only, no execution                                                                            | **(c)**, medium-high confidence                         | Matches the literal Cookiy ask ("testable environment") at the narrowest incremental security seam; reuses the already-scoped ADR-0274 demo-mode generator                                                                                                                                                                                                                                 |
| F2  | Ship (d) now regardless of F1's outcome?                                      | yes, ship independently · no, bundle with whichever of (a)/(b)/(c) lands                                                                                                                                 | **yes, ship independently**, high confidence            | Zero marginal risk, reuses ADR-0290 machinery, closes a real gap (full-file excerpts vs current snippets) with no dependency on the harder fork                                                                                                                                                                                                                                            |
| F3  | Identity/rate-limit floor for the demo-run path (if (c) or (a) selected)      | none (fully anonymous, IP-rate-limited only) · lightweight email capture (no verification) · same work-email check as the eval-license flow, scaled down                                                 | **lightweight email capture**, medium confidence        | Zero-friction anonymous access is what makes (a)/(c) an abuse magnet on day one; the full eval-license verification stack (card-auth + review queue) is designed for a 14-day `tier:pro` grant and is overkill friction for a demo that carries no commercial source — an email address is enough friction to blunt casual abuse without reintroducing the eval-license's approval latency |
| F4  | Trial/pricing-page framing once a sandbox ships                               | separate "Try it" CTA distinct from "Request an eval license" · fold sandbox access into the existing trial-path framing (ADR-0272 §3) as the first rung of a ladder (sandbox → eval license → purchase) | **fold as a ladder**, medium confidence                 | ADR-0272 already frames a trial path; a sandbox that's zero-signup and an eval license that's a 14-day verified grant are naturally sequential, not competing CTAs — avoids buyer confusion about which "try" surface does what                                                                                                                                                            |
| F5  | Cost ceiling / kill-switch owner for compute-backed options ((a) or (c))      | a hard daily compute budget cap with auto-disable · unbounded, monitored only, operator pages on spend alert                                                                                             | **hard daily cap with auto-disable**, medium confidence | This repo has no precedent for uncapped per-visitor compute spend anywhere else (every other public surface is static or database-read-only); a hard cap fails closed to "sandbox temporarily unavailable" rather than an open-ended bill                                                                                                                                                  |
| F6  | Build sequencing relative to the unbuilt eval-license delivery leg (ADR-0289) | build the demo-run sandbox first, independent of the eval-license leg · sequence AFTER the eval-license leg lands (share infra/verification code)                                                        | **build first, independent**, medium confidence         | Demo mode (ADR-0274 point 1) was explicitly designed to ship before the eval-license leg ("demo mode ships first ... the eval grant kind is a license-seam change and takes the full SHIP-audit lane"); blocking the sandbox on the heavier eval leg delays the cheaper, lower-risk win for no coupling benefit — the two share no code today                                              |

## Cost + effort summary

| Option                       | One-time build effort                                                             | Ongoing cost driver                                                             | Ongoing cost shape                                      |
| ---------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| (a) hosted sandbox           | Highest — new infra, orchestration, abuse controls, runbook                       | Compute-seconds × visitor count, uncapped without F5                            | Recurring, spend-sensitive to traffic/abuse             |
| (b) WebContainer embed       | Medium-high — WASM Node integration + Bun-compat spike                            | Client CPU only; server cost is issuance-grant checks                           | Near-zero marginal, one-time integration cost dominates |
| (c) server-side demo-run job | Medium — reuses scoped demo-mode generator, adds job orchestration + streaming UI | Compute-seconds × demo-run count, bounded per-run (job completes, doesn't idle) | Recurring but naturally bounded vs (a)                  |
| (d) read-only excerpts       | Lowest — content curation + UI extension                                          | None (static content, reuses ADR-0290 rendering)                                | Effectively zero                                        |

## Exit criteria for the eventual build

The build phase (its own SPEC + PLAN, once F1–F6 lock) is done when:

1. A first-time, unverified visitor can go from the marketing site to a running/visible artifact
   in under 2 minutes, with zero local install required (for (a)/(b)/(c)) or zero click-through
   required beyond the page itself (for (d)).
2. No commercial source, license-signing key, Paddle/registry credential, or production database
   credential is reachable from the sandbox surface — verified by the same security-audit lane
   (`gw-security-auditor`, fable on the seam) this repo already runs at SHIP for every money/
   license-adjacent change.
3. An abuse/cost stress test (rate-limit + concurrent-session cap + the F5 kill-switch, if F1
   picks a compute-backed option) is run and passes before the surface goes live to real traffic,
   not just in a review — pattern per this repo's `lifecycle-audit`/`lifecycle` conventions for
   proving a flow live, not just unit-tested.
4. The chosen option's ladder position (F4) is reflected in the pricing/marketing copy so the
   sandbox, the eval license, and the purchase CTA read as one coherent funnel, not three
   competing asks.
5. A goal-backward VERIFY re-reads this SPEC's Goal section against the shipped surface: does an
   evaluation-stage buyer with no case-study trust actually get a hands-on artifact, or did the
   build degrade into "another marketing page"?

## Non-goals

- This spec does not reopen the eval-license delivery leg's own design (ADR-0274/0280/0289 stand
  as locked; F6 only asks about build _sequencing_ relative to it, not its mechanics).
- This spec does not touch pricing, EULA continuity (ADR-0276/0281/0282), or the OSS-mirror
  public-flip program (ADR-0318) — it assumes the open Base's current/eventual public visibility
  as a given input, not something this spec changes.
- No product code ships from this spec. The build is a separate SPEC + PLAN cycle, gated on the
  operator locking F1–F6 as an ADR.
