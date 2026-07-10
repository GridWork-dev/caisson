# @caisson/mcp-server

Auth-gated buyer-facing MCP server (entitlement-scoped).

- **Layer:** base

Real src + tests: timing-safe Bearer-token auth on every tool call, entitlement-scoped reads (a
caller only sees the modules its purchase actually grants, resolved through
`@caisson/registry-schema`'s allowlist), and a credit-gated `generate` tool that debits before
writing (the same debit-before-spend seam as the CLI). Ships the setup-coach tools that walk a
buyer from "no AI config" to a validated `forge.config` without ever handling a secret value —
see `AGENTS.md` for the tool contract.

Licensed Apache-2.0 (open Base substrate).
