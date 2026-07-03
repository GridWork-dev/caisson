# @caisson/agent-dev

## 0.2.1

### Patch Changes

- ea52d1f: Add `@caisson/agent-runner` (new, ADR-0186): the sandboxed governed agent runner completing
  the Agentic-Dev "run agents safely" story. Spawns a headless agent CLI as a detached subprocess
  in an isolated worktree with a from-scratch scrubbed env — never spreads `process.env`; fixed
  non-secret passthrough allowlist + only the target provider's key + isolated HOME/config dir
  (ship-blocking leak-guard test, unit + end-to-end through a real spawn). Provider-agnostic
  config `{ binary, baseUrlEnv, authEnv, model, args }` with a worked Claude-CLI profile
  (`--strict-mcp-config`, no credentialed MCP); durable `.jsonl` transcript surviving launcher
  exit; run registry `spawn`/`tail`/`status`/`kill`/`list`/`finalReport` with `.strict()`-validated
  meta reads and a structured report (tool calls, files touched, final result) parsed from the
  transcript. Registered in the `apps/agent-dev` demo composition (`runAgentRunnerDemo`), and
  folded into the Agentic-Dev edition's `members` pin map + dependencies (ADR-0186 F5 edition-only
  SKU, the ADR-0178 tool-exec form).
- Updated dependencies [ea52d1f]
- Updated dependencies [9558a46]
- Updated dependencies [e62c88d]
- Updated dependencies [ccf8b10]
- Updated dependencies [623d07c]
- Updated dependencies [549dd4e]
  - @caisson/agent-runner@0.1.1
  - @caisson/ai-config@0.2.1
  - @caisson/kernel@0.3.0
  - @caisson/local-store@0.2.1
  - @caisson/agent-kernel@0.2.1
  - @caisson/tool-exec@0.1.2

## 0.2.0

### Minor Changes

- a07feb0: Fold the Stage-2 harvest primitives into the edition member pin maps (ADR-0178): Compliance now bundles
  `@caisson/alerting` + `@caisson/retention-runner`, and Agentic-Dev bundles `@caisson/tool-exec`, so buyers
  get them at the edition price (matches the ADR-0137 below-module-sum reprice).

  Also resolves standards-gate debt with no API change: `@caisson/auth`'s manifest now declares its real
  `@caisson/tenancy-rls` dependency (it imports it in `schema.ts`/`membership.ts`), and `@caisson/field-crypto`
  extracts the `KmsClient` port to a leaf `kms-port.ts` to break the `kms.ts` ↔ `kms-aws.ts` type cycle
  (dependency-cruiser `no-circular`). `KmsClient` is still re-exported from `kms.ts` for back-compat.

- 9483a36: Initial public release (0.1.0) — publish-readiness flip (ADR-0111). The open Base substrate (Apache-2.0, tier `oss`) publishes to public npm; the commercial editions/primitives/generator (tier `paid`) publish to GitHub Packages restricted. Versions were aligned to 0.1.0 in lockstep with the registry ledger; this changeset records the 0.1.0 release and seeds the changeset-presence gate (ADR-0021).

### Patch Changes

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
- Updated dependencies [69817a1]
- Updated dependencies [9483a36]
  - @caisson/kernel@0.2.0
  - @caisson/agent-kernel@0.2.0
  - @caisson/ai-config@0.2.0
  - @caisson/local-store@0.2.0
  - @caisson/tool-exec@0.1.1
