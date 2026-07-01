---
"@caisson/cli": patch
"@caisson/auth": patch
"@caisson/ai-evals": patch
"@caisson/mcp-server": patch
"@caisson/agent-dev": patch
"@caisson/guardrails": patch
"@caisson/prompt-registry": patch
"@caisson/audit-harness": patch
---

Whole-repo audit round-3 remediation (ledger 2026-07-01): emitted buyer CI templates get
least-privilege `permissions:` + `persist-credentials: false`; verifyAccountJwt failure
messages collapse to one generic reason (oracle closed); judgeGrader validates live judge
verdicts fail-closed and judge output is bounded; MCP `generate` modules array + id/version
strings are bounded with an O(1) pre-parse guard; the agent-dev emitter YAML-escapes all
free-text frontmatter so the `tools:` allowlist is un-suppressible, and `@caisson/tool-exec`
is wired into the Agentic-Dev edition (ADR-0199, honoring ADR-0178); guardrails cheapDeny is
stateless across calls (global-regex lastIndex bypass closed); prompt-registry bounds rawVars
values and total rendered content. Plus the round-4/5 audit domains (admin-plane,
metering-byok, destructive-jobs, composition-roots, worm-integrity) added to AUDIT_DOMAINS.
