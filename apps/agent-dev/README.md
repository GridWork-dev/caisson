# apps/agent-dev — Agentic-Dev edition CLI reference app

A runnable **CLI reference app** for the `agent-dev` edition. It drives one governed lifecycle
end-to-end against the composed edition surface (`@caisson/agent-dev`), down-only (ADR-0003/0022),
proving four capabilities in a single offline pass:

1. **Governed, tamper-evident lifecycle** — the canonical act FSM is advanced act-by-act through a
   policy guard; with the audited mode ON, every admitted transition is recorded into the kernel
   audit-chain + append-only versioning. The run's record verifies against a WORM anchor, and any
   tampered or truncated step fails `verifyChain` (ADR-0065/0066).
2. **Offline hybrid memory** — each governed artifact is indexed into `@caisson/local-store`
   (vec0 + FTS5 + RRF, RRF_K=60). With no embedder wired the app runs fully offline on the FTS5
   floor; with an embedder seam it fuses by RRF. No live cloud/model call (ADR-0067).
3. **Multi-harness emit** — one typed schema renders to `.claude/` + Codex `AGENTS.md` + Cursor
   under a fail-closed path-safe, no-secret guard. Claude Code is one emit target, never the
   substrate (ADR-0066).
4. **Governed agent-runner reference run** — a sandboxed, governed agent run: a headless agent CLI
   spawns in an isolated worktree with a from-scratch scrubbed env, and the demo returns the
   structured run report parsed from the durable transcript (ADR-0186).

```sh
bun run apps/agent-dev/src/index.ts [targetDir]   # targetDir defaults to a temp dir
```

## ADR-0044 CLI exception

ADR-0044 standardizes edition **reference apps + web surfaces** on Next.js. This app is the
documented **exception**: the agent-dev edition's reference surface is a _kernel demo_, not a web
page — a governed tamper-evident lifecycle, offline retrieval, and a multi-harness emit are an
inherently **headless/CLI** flow with no UI to render. An optional Next.js **inspector** over the
audited lifecycle record is **deferred** (SPEC out-of-scope). The exception is narrow: only this
single CLI demo; the edition's eventual _web_ surface would still scaffold on Next.js, and moving it
off would still require a superseding ADR.
