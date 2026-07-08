# Marketplace media gap — closing plan (track 6)

**Date:** 2026-07-07 · **Status:** plan only (separate kickoff) · **Scope:** `apps/site` media system (ADR-0285 §3, ADR-0264 Remotion)

## The gap

The marketplace MEDIA facet counts **8 of 28** catalog items with real media (a diagram, demo, or video). The other **20 items render only the brand-mark placeholder** slide. Source of truth: `apps/site/lib/media-manifest.ts` (`entryHasMedia` / `mediaSlides`).

**Have media today (8):** bundles `compliance`, `provenance`; modules `compliance-core`, `field-crypto`, `audit-worm` (diagram + Remotion video), `signing-primitive`, `retention-runner`, `ui-pro` (live demo).

**Missing media (20):**

- **Bundles (4):** `ai-production`, `local-first`, `agentic-dev`, `everything`.
- **Modules (16):** `alerting`, `ai-meter`, `ai-evals`, `guardrails`, `prompt-registry`, `local-store`, `agent-kernel`, `agent-runner`, `frameworks-pack`, `credits`, `local-sync`, `local-inference`, `local-privacy`, `tool-exec`, `org-controls`, `billing-orchestration`.

## Constraints (binding)

- **Self-contained only.** The site CSP blocks external hosts (no CDN, no remote images). Every asset is inline SVG / token-CSS / a same-origin Remotion `mp4` under `/public`. Matches the existing `SlideKind` set (`diagram | image | interactive | video`).
- **Honest-artifact floor (ADR-0082).** Diagrams depict _shipped_ behaviour only; code slides are the _real_ source; no fabricated screenshots. This is why the placeholder is a brand mark, never a fake UI.

## The lever: a new `code-artifact` slide kind

8 of the 16 media-less modules **already have a real code artifact** on their depth page (`lib/module-pages.ts` `artifact.file`/`artifact.code`, single-sourced): `alerting`, `ai-meter`, `ai-evals`, `guardrails`, `prompt-registry`, `local-store`, `agent-kernel`, `agent-runner`.

Adding a `code-artifact` `SlideKind` that renders that existing snippet (the same `<CodeBlock frame>` the homepage `repo-artifact` uses) gives all 8 **real, honest media at near-zero per-module cost** — the highest-leverage move. It also becomes the honest default for the remaining modules once their depth artifact exists.

## Per-item assignment

| Item                                                                                                                           | Kind                    | Approach                                                                                                                                 | Effort                               |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `alerting`, `ai-meter`, `ai-evals`, `guardrails`, `prompt-registry`, `local-store`, `agent-kernel`, `agent-runner` (8 modules) | **code-artifact**       | Render existing `module-pages` artifact via a new `code-artifact` slide kind                                                             | XS each (one-time infra)             |
| `ai-production`, `local-first`, `agentic-dev`, `everything` (4 bundles)                                                        | **composition diagram** | One parametrized "modules → bundle → base" diagram (reuse the new `marketplace-hero-artifact` pattern), fed each bundle's member modules | S (one component covers all 4)       |
| `local-privacy`                                                                                                                | **diagram**             | New authored diagram: outbound request hits the privacy egress gate → blocked/allowed                                                    | S                                    |
| `local-sync`                                                                                                                   | **diagram**             | New authored diagram: device ↔ device offline-first sync/merge                                                                           | S                                    |
| `local-inference`                                                                                                              | **diagram**             | New authored diagram: prompt runs on-device, zero egress                                                                                 | S                                    |
| `credits`                                                                                                                      | **diagram**             | New authored diagram: grant → spend → FIFO expiry (402 at zero)                                                                          | S                                    |
| `tool-exec`, `org-controls`, `billing-orchestration`, `frameworks-pack`                                                        | **code-artifact**       | Author a depth-page `artifact` from real source first, then the same `code-artifact` slide                                               | S each (needs the artifact authored) |
| `ai-meter`, `agent-runner` (optional upgrade)                                                                                  | **video**               | Remotion demo (spend-cap trip; sandboxed agent loop) — reserve for flagship polish                                                       | M–L each                             |

## Phasing (recommended order)

1. **Phase 1 — `code-artifact` slide kind (XS/S, biggest win).** Add the kind to `media-manifest.ts` + `MediaCarousel`; wire the 8 modules that already carry an artifact. Closes 8/20 immediately.
2. **Phase 2 — bundle composition diagram (S).** One parametrized component → all 4 bundles. Closes 4/20.
3. **Phase 3 — 4 new mechanism diagrams (S each).** `local-privacy`, `local-sync`, `local-inference`, `credits`. Closes 4/20.
4. **Phase 4 — author 4 depth artifacts + slides (S each).** `tool-exec`, `org-controls`, `billing-orchestration`, `frameworks-pack`. Closes the last 4/20 → **28/28**.
5. **Phase 5 (optional) — 1–2 Remotion videos** for flagship modules.

**Rough effort:** Phases 1–4 close the full gap in roughly 4–6 focused days; Phase 1 alone (≈1 day) moves the facet from 8 → 16. Every deliverable is self-contained and honest-artifact-compliant by construction.

## Open decisions for the kickoff

- Does `code-artifact` count toward the MEDIA facet (`entryHasMedia`)? Recommend **yes** — a real code snippet is real media.
- Video budget: hold at the single `audit-worm` render for launch, or fund 1–2 more? (Operator call; Remotion is the cost driver.)
