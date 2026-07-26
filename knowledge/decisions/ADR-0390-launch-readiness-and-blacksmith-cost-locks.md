# ADR-0390 — Launch-readiness gaps and Blacksmith cost lock

- **Date:** 2026-07-26
- **Status:** Accepted (operator-locked)
- **Companion:** ADR-0391 (the six board re-walk locks taken the same day)
- **Parent:** ADR-0234 (Ask-AI widget) · ADR-0258 (Paddle catalog recreation) · ADR-0326 /
  ADR-0365 (Blacksmith runner posture) · ADR-0387 (the full pre-deploy arming pass)

## Context

A read-only production/provider survey exposed two launch gaps that every existing deploy check had
missed, one sandbox catalog whose history could not be inferred safely, and a CI-cost assumption
that live usage had disproved. The same operator sitting also selected the time-sensitive Article 50
content path.

These are four separate locks. They share one property: each replaces an unverified launch
assumption with a named check, a bounded next act, or an honest cost baseline.

## Decisions

### 1. Verify Article 50 content now and publish by 2026-08-01

The article is drafted from the European Commission's final Article 50 transparency guidelines,
published 2026-07-20, then receives a factual/legal verification pass before publication.
Verification is a precondition, not an optional polish step.

The article publishes by **2026-08-01**. **2026-08-02 is the AI Act's legal applicability date
under Article 113, not a publication deadline imposed on Caisson.** The earlier Caisson date is a
chosen editorial deadline for the live timing window.

This was chosen over publishing an evergreen explainer after 2026-08-02 and over skipping the
article. Later the same day, the operator also locked the publication surface: a new `/writing`
collection inside `apps/site`, recorded in full by companion ADR-0391. That surface was chosen over
one MDX page in the existing compliance-docs collection and over off-site-only publication. It is a
separate implementation lane; this ADR does not build it.

### 2. Close the Ask-AI arming gap with a runbook row and a configured probe

`DOCS_SERVICE_TOKEN` and `DOCS_QUERY_URL` become explicit `caisson-site` launch-arming rows, and the
existing Railway-side operator preflight gains a named configured-probe mode. The probe reports
presence only. It never reads, prints, logs, measures, or compares either value, and a missing name
exits non-zero.

This was chosen over a runbook row alone, which leaves the same silent omission class automated
checks cannot see, and over failing the entire site's boot when either name is absent. Boot failure
was rejected because it would couple marketing, docs, and the buyer dashboard's availability to one
RAG feature. The public `/healthz` response does not expose configuration state.

### 3. Audit Paddle sandbox drift before any cleanup

`tools/paddle-catalog-recreate.ts` gains a GET-only `--audit` mode that exhausts Paddle pagination
for both products and prices, classifies every live object as expected, unknown-marker, unmarked, or
duplicate-marker, and reports expected plan markers that are missing. Any non-expected bucket exits
non-zero.

This was chosen over archive-everything-and-recreate, which would destroy the sandbox objects used
by earlier proof transactions before establishing which generation is canonical, and over
deferring the question to the production arming pass. No object is archived, deleted, repriced, or
otherwise mutated by this lock.

### 4. Accept the measured Blacksmith run rate and move the alert to $120

The accepted Blacksmith baseline is now approximately **$79/month**, with the spend alert
re-baselined to **$120** and the posture revisited after launch. The measured basis is **9,805
4-vCPU runner-minutes from 2026-07-01 through 2026-07-26**, approximately **$0.008/minute**,
**$66.35 due**, and **$79.11 projected at month-end**.

This **supersedes** the earlier PF2-1 acceptance of roughly $4-8/month. Live spend exceeded that
assumption by an order of magnitude. CI stays heavy and full; the new alert distinguishes a known
run rate from new drift instead of paging continuously on an obsolete baseline.

Moving jobs to GitHub-hosted runners is not cheaper for this repository: the private Free-plan
repository includes 2,000 minutes, then charges a comparable per-minute rate on runners with half
the vCPUs. Returning work there is therefore rejected as a cost fix.

## Consequences

- Ask AI has a launch-visible presence gate without turning secret configuration into public health
  metadata or coupling the whole site to RAG availability.
- The Paddle cleanup decision waits for an itemized live audit. The audit can prove whether the
  unmarked/manual-generation hypothesis is true; this ADR does not assume it.
- The Blacksmith check pages on projected spend beyond $120, not on the already accepted ~$79
  baseline. The next cost decision is deliberately post-launch.
- Article drafting, factual/legal verification, and the `/writing` surface now share a six-day
  delivery window. ADR-0391 records the surface choice and what that coupling forecloses.

## Not decided here

- The article's final factual/legal conclusions or copy. Verification remains mandatory before
  publication.
- The design, navigation, schema.org implementation, or content cadence for `/writing`; a separate
  lane owns that surface.
- Which Paddle objects, if any, are archived after the operator reads the audit.
- Any Railway variable write or deployment. The operator owns the arming act.
