# SWEEP — Codex production browser audit lane

## Downstream impact checked

- `apps/site/lib/routes.ts` and buyer/admin page trees are read-only manifest sources. Route changes will fail or alter manifest coverage instead of silently living in a copied list.
- Existing `apps/site/scripts/visual-harness.ts`, live tests, Playwright configuration, and CI workflows are unchanged.
- `tooling/design-critic` remains independent. The new browser-audit reconciler uses its own stable advisory ledger shape and does not gate merges.
- `bun.lock` includes the new private tooling workspace. No publishable package or changeset is introduced.
- `.gitignore` excludes production evidence bundles because screenshots and journals may contain production state.
- No new port, daemon, external sink, credential source, network runner, or deployment surface was added.

## Follow-ups

- First real use: invoke `$caisson-production-browser-audit` in a fresh Codex app project session, verify skill discovery, then run Ring 1 and one allowlisted Ring-2 reversible mutation.
- A finding may become deterministic coverage only through a new operator-approved task that authors and reviews the Playwright test separately.
- Ring-3 mutation remains read-only by default until an explicit synthetic fixture allowlist is supplied for that run.

No product-code or Playwright follow-up is silently implied by this phase.
