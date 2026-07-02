# Deferred-respec SPEC drafts (2026-07-02)

Every deferred-by-decision item from the post-#51 full triage, researched and drafted into a
buildable SPEC — **except** the three.js studio-signature spike and Terraform remote state
(operator-excluded). Produced by a research → spec → adversarial critique → revision workflow
(43 agents; every cited path/ADR/upstream-API claim independently verified by the critic pass).

**Every spec is `DRAFT — operator lock required`. Nothing here authorizes building.** Per the
one-operator rule, each spec tables its forks with labeled recommendations and waits; where a
build would contradict an existing lock, the spec names the ADR it would need to supersede
(e.g. ADR-0210 §3 token-hashing defer, ADR-0141 read-only admin posture, the ADR-0180 rlink
won't-fix). Locks land as new ADRs in `knowledge/decisions/`, never here.

| Spec                                                                                                                                                                                                                  | Tags                                            | Revised                                                                     | Residual critiques |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- | ------------------ |
| [SPEC-auth-session-token-hashing](SPEC-auth-session-token-hashing.md) — session token hash-at-rest (future-trigger: build only when better-auth ships the seam or a compliance finding fires; supersedes ADR-0210 §3) | auth security secrets data-migration            | yes                                                                         | 3                  |
| [SPEC-wave6-harvest-disposition](SPEC-wave6-harvest-disposition.md) — enumerate + rank the parked sub-top-15 lift-sweep residual (document-only)                                                                      | harvest (multi)                                 | yes                                                                         | 5                  |
| [SPEC-members-fold-republish](SPEC-members-fold-republish.md) — realize the agent-runner fold into the Agentic-Dev registry snapshot                                                                                  | infra external-system billing                   | **NO — unrevised, 7 open critiques; read the critique list before locking** | 7                  |
| [SPEC-paddle-partial-refund](SPEC-paddle-partial-refund.md) — per-line entitlement revoke + credit clawback for a multi-item cart                                                                                     | security external-system billing data-migration | yes                                                                         | 3                  |
| [SPEC-admin-mutation-surface](SPEC-admin-mutation-surface.md) — apps/admin mutations + audit trail (supersedes ADR-0141 read-only posture)                                                                            | security auth (multi)                           | yes                                                                         | 3                  |
| [SPEC-seo-section-union-renderer](SPEC-seo-section-union-renderer.md) — PageSections union renderer, new programmatic pages only                                                                                      | ui frontend                                     | yes                                                                         | 3                  |
| [SPEC-cloudflare-front-rate-limit](SPEC-cloudflare-front-rate-limit.md) — CF front rate-limit + WAF for the Railway fleet                                                                                             | infra security external-system billing secrets  | yes                                                                         | 5                  |
| [SPEC-live-seam-kms-envelope](SPEC-live-seam-kms-envelope.md) — field-crypto cloud KMS envelope live-test seam                                                                                                        | security external-system infra                  | yes                                                                         | 3                  |
| [SPEC-local-ai-onnx-live-seam](SPEC-local-ai-onnx-live-seam.md) — ONNX on-device inference live seam (availability-gated per ADR-0201)                                                                                | ai security external-system                     | yes                                                                         | 4                  |
| [SPEC-agent-dev-inspector](SPEC-agent-dev-inspector.md) — Agentic-Dev local inspector (read-only, localhost)                                                                                                          | security observability                          | yes                                                                         | 6                  |
| [SPEC-oscal-rlink-hosting](SPEC-oscal-rlink-hosting.md) — signed evidence bundle, relative rlinks (would supersede the ADR-0180 rlink won't-fix)                                                                      | compliance security external-system             | yes                                                                         | 4                  |

"Residual critiques" = critic findings noted in each spec's provenance; the revision round
addressed the blocking ones except where marked NO. The critic's full finding lists live in the
workflow journal (session artifacts), and the load-bearing ones are already folded into each
spec's Risks/Open-forks sections.
