# SWEEP — AI SDK v7 lockstep migration

## Downstream consumers

| Consumer                        | Impact                                                 | Classification | Status                                                       |
| ------------------------------- | ------------------------------------------------------ | -------------- | ------------------------------------------------------------ |
| `apps/ai-kit`                   | Provider/model test double advances to the v4 contract | in-phase       | Updated; build and 7 tests pass                              |
| `packages/ai-config`            | Lane schema and provider names feed the registry       | in-phase       | No source change required; build passes                      |
| `packages/local-ai`             | Adjacent inference package, no direct SDK dependency   | in-phase       | Verified unchanged; build passes                             |
| `services/intel`                | Adjacent AI service, no direct SDK dependency          | in-phase       | Verified unchanged; build and eval pass                      |
| `apps/site/lib/bundle-pages.ts` | Live buyer copy named AI SDK v5                        | in-phase       | Updated to v7; site build/lint/tests pass in `bun run check` |
| SDK import boundary             | New provider majors must remain gateway-confined       | in-phase       | Existing allowlist is complete; both boundary tests pass     |

No exported Caisson function signature, HTTP route, webhook envelope, database schema, environment
variable, port, or daemon changed, so there is no additional runtime consumer migration.

## Stale documentation and metadata

| File                                                                          | Stale reference                                                         | Classification | Status                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| `packages/ai-kit/manifest.ts`                                                 | Published description said AI SDK v5                                    | in-phase       | Fixed to v7                                                                       |
| `docs/state/decisions-and-forks.md`                                           | Live locked-summary row said v5                                         | in-phase       | Fixed to v7 without changing the ADR lock                                         |
| `docs/build-state.md`                                                         | AI-kit source/test/LOC cell predated the review remediation             | in-phase       | Fixed to `8 / 8 / 1800`; SOT package-count parity passes                          |
| `apps/site/lib/bundle-pages.ts`                                               | Three live product-copy strings said v5                                 | in-phase       | Fixed to v7                                                                       |
| `packages/ai-kit/AGENTS.md`                                                   | Described superseded instructions projection and language-only fallback | in-phase       | Fixed to ordered-message compatibility plus distinct language/embedding fallbacks |
| `knowledge/decisions/ADR-0059`, `ADR-0160`, `ADR-0162`, `ADR-0201`            | Historical decision text records the then-current SDK contract          | deferred       | Intentionally unchanged: ADRs are append-only historical authorities              |
| `registry/ledger.jsonl`, package changelogs, archived browser/review evidence | Historical published or captured v5 text                                | deferred       | Intentionally unchanged: append-only/history surfaces                             |

The package README, AGENTS contract, changelog, package description, source comments, and reference
app README now use v7/V4 terminology. Renovate has no v5/v6-specific rule to update; this lockstep
major remains deliberate rather than bot-automergeable. No tracked generated library declaration
exists; TypeScript and Next builds regenerate/check their outputs successfully.

## Adjacent tests rerun

- Complete AI-kit suite: 131 pass, 0 fail, 413 assertions.
- AI-kit reference app: 7 pass plus production build.
- Site bundle-page tests and production build: pass through `bun run check`.
- `ai-config`, `local-ai`, and `service-intel` builds: pass.
- Two credential-gated OpenRouter language/stream transport tests: pass with reported-usage refunds.
- Full workspace build/lint/test, eval, standards gate, and SOT: pass.

## TODOs introduced

None. The added diff contains no `TODO`, `FIXME`, `HACK`, or `XXX` marker.

## Inventory updates required

| Registry                 | Impact                                                         | Status                                |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------- |
| App/route inventory      | No route or HTTP contract changed                              | No update required                    |
| Daemon/security surfaces | No port, bind, daemon, or external sink added                  | No update required                    |
| MCP/agent roster         | No MCP or agent added                                          | No update required                    |
| Provider SDK boundary    | Existing seven-provider allowlist still matches direct imports | Verified by standards gate            |
| Changesets               | One changed publishable package                                | `@caisson/ai-kit` patch entry present |

## Governed sweep receipt

The first `gw dispatch phase_sweep` attempt exposed global configuration links pointing at a deleted
temporary audit worktree. `gw sync-config` republished and verified the canonical gridwork-core
Claude/Codex surface. The repaired isolated sweep started as thread
`019f5ca2-c89a-7ca3-8af3-fe5cb2e5488f`, read the SPEC and migration history, then the child process
ended before returning a final report. It touched only its disposable worktree, which was removed.
The criterion-driven inline sweep above is therefore the authoritative Act 5 report.

## Follow-up phases

None. All in-phase findings are fixed, and no product, pricing, eval, or infrastructure fork was
opened by the migration.
