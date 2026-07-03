# @caisson/audit-harness

## 0.0.2

### Patch Changes

- 904b15b: Post-merge consolidation sweep: repo links repointed to caisson-sh/caisson (site footer, JSON-LD, docs edit-links, llms.txt blob URLs), the audit-harness design-ui domain re-globbed from the removed apps/studio to the apps/admin design gallery, and stale SigNoz naming updated to the Grafana Cloud fleet sink (ADR-0177/0207). Docs/comments only apart from the design-ui glob fix; no behavior change to any runtime path.

## 0.0.1

### Patch Changes

- c192c80: Extend AUDIT_DOMAINS with the round-2 surfaces the first-run globs never reached (python-services, iac-authz, ci-supply-chain, telemetry-egress, financial-integrity, registry-edge) and the round-3 surfaces the completeness critic named (generator-templates, auth-boundary, email-egress, ai-evals-integrity, mcp-transport, agent-governance, guardrails-prompts). Declaration-only data change.
- c1ed657: ADR-0188 pipeline completion for the internal (private, unsold) `@caisson/audit-harness`:
  the scoped `reconcile(previous, current, scope)` correctness fix (out-of-scope domains pass through —
  no silent cross-domain false-close), the `--domains` fail-loud CLI, and the pure enablers
  (`enumerateSurface` / `selectValidateCandidates` / `summarize`) + `check-scope`/`report` subcommands.
  Private package — versioned locally, never published.
- 22077d1: Whole-repo audit round-3 remediation (ledger 2026-07-01): emitted buyer CI templates get
  least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
  messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
  verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
  strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
  free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
  is wired into the Agentic-Dev edition (ADR-0199, honoring ADR-0178); guardrails cheapDeny is
  stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
  values and total rendered content. Plus the round-4/5 audit domains (admin-plane,
  metering-byok, destructive-jobs, composition-roots, worm-integrity) added to AUDIT_DOMAINS.
- a07feb0: Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
  `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
  get them at the edition price (matches the ADR-0137 below-module-sum reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.
