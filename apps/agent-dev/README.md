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

## Local inspector (shipped, local-dev only)

`apps/agent-dev/src/inspector.ts` is a **read-only, localhost-only** `Bun.serve` view over the
three durable seams this edition already produces: agent-runner run transcripts, the
governed-lifecycle audit chain, and hybrid memory. Launch it against a run-registry root and a
memory root:

```sh
bun run apps/agent-dev/src/inspector.ts <runsRoot> <memoryRoot>
```

It prints the bound URL (`http://127.0.0.1:<port>`) and serves three routes: `GET /` (a runs
table — tool calls show **count + name only**, never argv or an exit code), `GET /audit` (the
lifecycle chain + a tamper-evidence verify badge), and `GET /memory` (paged memory docs; a
`tenant` query param resolves only through the ADR-0073 fail-closed `tenantDbPath()` boundary).
The bind is `127.0.0.1` **only** — never `0.0.0.0`, never configurable — there is no auth layer
because localhost itself is the trust boundary, and the inspector never writes: it only reads
what the edition already recorded. See `outputs/specs/deferred-respec/SPEC-agent-dev-inspector.md`
for the full design + scope.

## ADR-0044 CLI exception

ADR-0044 standardizes edition **reference apps + web surfaces** on Next.js. This app is the
documented **exception**: the agent-dev edition's reference surface is a _kernel demo_, not a web
page — a governed tamper-evident lifecycle, offline retrieval, and a multi-harness emit are an
inherently **headless/CLI** flow with no UI to render. The local inspector above is a **second,
narrower** ADR-0044 deviation: **ADR-0243** authorizes a non-Next `Bun.serve` web surface for this
one localhost-only, read-only, non-sellable dev tool (Fork A = A1) — zero new dependency, matching
the plain Bun/tsc shape this app already is. Both exceptions are narrow: the edition's eventual
_hosted/sellable_ web surface would still scaffold on Next.js, and moving that off would still
require its own superseding ADR.
