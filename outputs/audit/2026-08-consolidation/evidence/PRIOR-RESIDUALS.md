# Checked-in prior residuals and explicit keeps

The external workflow projection `wf_67a45080-ead` and PR #412 body are unavailable. This matrix is
limited to checked-in ADR, state, deploy, kickoff, and git evidence. Unknown PR/workflow-only rows
are **not swept** and cannot seed this picker.

| Prior item                                         | Current standing                            | Evidence / picker effect                                                                                                                          |
| -------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Five reference apps and `local-ai` source deletion | EXECUTED                                    | `knowledge/decisions/ADR-0397-reference-app-retirement-and-dissolved-meta-deletion.md:31-44`; never re-proposed                                   |
| `packages/ai-kit`                                  | EXPLICIT KEEP / OUT OF SCOPE                | Live site imports at `knowledge/decisions/ADR-0397-reference-app-retirement-and-dissolved-meta-deletion.md:24-25`; adapter audit is evidence-only |
| `agent-usage` -> trajectory `/usage`               | EXECUTED                                    | `knowledge/decisions/ADR-0402-agent-usage-delist-executes-with-provenance.md:23-40`; never re-proposed                                            |
| `agent-dev` raw source deletion                    | EXPLICIT KEEP pending architecture decision | `docs/state/package-catalog.md:117`; no picker row                                                                                                |
| verify-pack first publish                          | QUEUED RELEASE ACT                          | `knowledge/decisions/ADR-0398-verify-pack-publishes-with-the-next-train.md:28-38`; not a consolidation cut                                        |
| agent-trajectory `/usage` publish                  | QUEUED RELEASE ACT                          | `knowledge/decisions/ADR-0402-agent-usage-delist-executes-with-provenance.md:42-46`; not a consolidation cut                                      |
| Worker 53-module redeploy                          | CLOSED at audit base                        | Base commit `45707a1a`; live index receipt `docs/deploy/STATE.md:39-43`                                                                           |
| demos split/transition mechanics                   | FRESHLY EXECUTED / OUT OF SCOPE             | `knowledge/decisions/ADR-0400-site-demo-surface-split-multi-zone.md:19-40`; transition-gate cleanup removed from this picker                      |
| platform-reads -> license-service fold             | EXPLICITLY REJECTED                         | `knowledge/decisions/ADR-0401-remediation-wave-sweep-locks.md:25-30,57-60`; no reverse-fold candidate                                             |
| move `brand` to tooling                            | EXPLICITLY REJECTED                         | `knowledge/decisions/ADR-0401-remediation-wave-sweep-locks.md:31-33,60`; no candidate                                                             |
| ADR-0401 mechanical cuts/renames/dedups            | EXECUTED                                    | `knowledge/decisions/ADR-0401-remediation-wave-sweep-locks.md:34-47`; no repeated rows                                                            |
| declaration-drift fail-closed gate                 | IN FLIGHT on separate branch                | Reverted residual at `docs/state/outstanding-work.md:263`; implemented in `6a0b7720` on `fix/queued-eng-close`; not copied here                   |
| Python docs-RAG/support-bot plane                  | EXPLICIT KEEP-frozen / OUT OF SCOPE         | `outputs/kickoffs/KICKOFF-caisson-consolidation-audit.md:53-55`; not swept                                                                        |

## Declared gap

The inaccessible PR/workflow-only residual list may contain additional rows. This report does not
claim those rows were evaluated and does not infer them from commit subjects. Admission is
fail-closed: without a checked-in source and current caller/registry/refute evidence, no such row can
appear in `PICKER-TABLE.md`.
