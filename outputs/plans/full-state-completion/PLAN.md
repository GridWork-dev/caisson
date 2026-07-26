# PLAN — Full-state reconciliation and completion

- **SPEC:** `outputs/specs/full-state-completion/SPEC.md`
- **Decision:** ADR-0379
- **Execution mode:** dependency-ordered waves; parallel writers use isolated worktrees; one
  reconcile lane owns shared files.
- **Review:** code review always; security, UI, external-system, infra, and migration gates fire
  from the SPEC tags.

## Tasks and semantic routes

| Task | Outcome                                                    | Route                                                                                                                                                                                                            | Evidence                                                       |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| T0A  | Canonical repository/work/operator truth                   | `capability=docs_write`; `role=gw-technical-writer`; `lane=sonnet`; `concurrency=parallel-read`; `isolation=active-branch`; `permission_profile=repo-write`                                                      | `bun run sot`; state-diff review                               |
| T0B  | Linear issue dispositions linked back to git truth         | `capability=work_tracking`; `role=main-orchestrator`; `lane=main`; `concurrency=sequential`; `isolation=external-system`; `permission_profile=in-scope-issue-write`                                              | issue status/description receipts; no ADR content in Linear    |
| T1   | TypeScript-aware dependency graph with a false-green guard | `capability=code_write`; `role=gw-typescript-pro`; `lane=sonnet`; `concurrency=sequential`; `isolation=active-branch`; `permission_profile=repo-write`; TDD                                                      | red/green guard test; real depcruise JSON                      |
| T2   | Price authority and catalog/fulfillment truth              | `capability=code_write`; `role=gw-typescript-pro`; `lane=opus-money`; `concurrency=sequential`; `isolation=active-branch`; `permission_profile=repo-write`; TDD                                                  | standards/catalog tests; price parity                          |
| T3   | Route-specific limiter failure policy                      | `capability=code_write`; `role=gw-security-engineer`; `lane=opus`; `concurrency=sequential`; `isolation=active-branch`; `permission_profile=repo-write`; TDD                                                     | route red/green tests; security review                         |
| T4   | One-SHA fleet reconciliation and migration 0030            | `capability=deploy`; `role=main-orchestrator`; `lane=main`; `concurrency=sequential`; `isolation=external-system`; `permission_profile=operator-gated`; main thread only                                         | immutable-SHA deploy receipts; migration receipt; parity probe |
| T5A  | Three module-depth records                                 | `capability=code_write`; `role=gw-frontend-designer`; `lane=opus-ui`; `concurrency=bounded`; `isolation=dedicated-worktree`; `permission_profile=repo-write`; **held on module copy/marks fork**                 | route/static-param tests, a11y, screenshots                    |
| T5B  | Admin proof viewer and export                              | `capability=code_write`; `role=gw-frontend-designer`; `lane=opus-ui`; `concurrency=bounded`; `isolation=dedicated-worktree`; `permission_profile=repo-write`; **held on export/count/lazy-state fork**           | component/route/signing tests, UI + security review            |
| T5C  | Tenant proof route/dashboard                               | `capability=code_write`; `role=gw-security-engineer`; `lane=opus`; `concurrency=bounded`; `isolation=dedicated-worktree`; `permission_profile=repo-write`; **held on tenant-proof topology fork**                | auth/RLS/cross-tenant/redaction tests                          |
| T5D  | Generated 39-component design manifest                     | `capability=code_write`; `role=gw-frontend-designer`; `lane=opus-ui`; `concurrency=bounded`; `isolation=active-branch`; `permission_profile=repo-write`; TDD; unblocked                                          | generation/drift/contrast tests                                |
| T5E  | Buyer-dashboard crosswalk                                  | `capability=code_write`; `role=gw-frontend-designer`; `lane=opus-ui`; `concurrency=bounded`; `isolation=dedicated-worktree`; `permission_profile=repo-write`; **held on latest-pack source/row-model fork**      | real-pack mapper, claim-posture, a11y tests                    |
| T6A  | Inngest v4 jobs adapter                                    | `capability=code_write`; `role=gw-typescript-pro`; `lane=sonnet`; `concurrency=parallel`; `isolation=dedicated-worktree`; `permission_profile=repo-write`; TDD                                                   | jobs conformance + targeted adapter tests                      |
| T6B  | Azure Key Vault KMS adapter                                | `capability=code_write`; `role=gw-security-engineer`; `lane=opus`; `concurrency=parallel`; `isolation=dedicated-worktree`; `permission_profile=repo-write`; TDD; **held on deletion-receipt contract**           | KMS conformance + crypto-shred failure tests                   |
| T6C  | Azure Blob WORM adapter                                    | `capability=code_write`; `role=gw-security-engineer`; `lane=opus`; `concurrency=parallel`; `isolation=dedicated-worktree`; `permission_profile=repo-write`; TDD; **held on immutable-version identity contract** | artifact-store conformance + immutability tests                |
| T7   | Reconcile, verify, audit, and prepare release              | `capability=code_review`; `role=gw-code-reviewer` plus conditional auditors; `lane=opus`; `concurrency=parallel-read`; `isolation=read-only`; `permission_profile=repo-read`; release actions operator-gated     | full gates, review reports, release dry-run                    |

## Dependency order

```text
{T0A || T1 -> T2 -> T3} -> T0B
T3 -> external gate T4
T3 -> {T5A || T5B || T5C || T5D || T5E}
{T5A + T5B + T5C + T5D + T5E} -> {T6A || T6B || T6C}
T4 -> T7
{T6A + T6B + T6C} -> T7
```

Unblocked T5 work may continue locally while T4 is held, but no production-parity or
release-complete claim may be made. T5A/B/C/E and T6B/C stop at their named fork-board rows; T5D is
the only wholly unblocked product slice. The adapter wave starts only after all T5 slices are
complete; each held port contract must be locked before its writer starts. Shared dependency,
changeset, ADR-index, security-ledger, and registry-index edits are reconciled by T7, not
concurrently by adapter writers.

## TDD and review checkpoints

1. Add the smallest failing regression/conformance test.
2. Run it and retain the expected failure evidence.
3. Implement the minimum compatible behavior.
4. Re-run targeted tests, then package build/lint.
5. Review the diff before unblocking the next dependent task.
6. Run `bun run check`, `bun run format:check`, and `bun run sot` after reconciliation.

## Hold points

- T4 pauses before any production deployment, migration execution, restart, or secret-dependent
  command until exact targets and rollback evidence are resolved and the risk gate is acknowledged.
- T7 may prepare but not publish a version, tag, npm artifact, GitHub Release, public mirror, or
  public-commerce change without its external-system gate.
- `substrate.field-crypto-policy` is added to the fork board as open and remains unimplemented.
