# SWEEP — downstream walk (Act 5)

Walked the dependency graph from the `apps/site` diff for stale docs, closed deferrals, and
follow-ups.

## Reconciled this session

- **`CLAUDE.md` "Still open"** — removed the stale "per-edition app framework (decided per edition)"
  (closed by ADR-0044) and the "Hosting/site … deferred" framing (now built + locked by ADR-0045).
  "Pricing numbers" remains the only open GTM fork. Done.
- **`CLAUDE.md` commit scopes** — `site` scope added (shipped with the scaffold commit).
- **`infra/terraform` README + `main.tf`** — the two stale `@cloudflare/next-on-pages` / OpenNext
  comments reconciled to the accurate static-export direct-upload statement. Done.
- **`docs/state/decisions-and-forks.md`** — 4 locked rows + ADR-numbering map extended to 0048.
  "Pricing numbers" left open. Done.
- **`.prettierignore`** — `out/` + `.source/` added (apps/site is the first static-export app, so
  the build/codegen dirs were being format-checked). Done.

## Noted, not changed (correct as-is)

- **`specs/03-design-framework.md` §3** named the docs framework as an "ADR placeholder" (Mintlify /
  Starlight). ADR-0045 fills that placeholder with Fumadocs (same intent: AI-native, `llms.txt`,
  agent-readable). `specs/` are locked concept docs; the live board (source-of-truth #1) + ADR-0045
  carry the resolution, so the spec is left intact (ADRs supersede specs on conflict).
- **`packages/ui`** was not touched → no `tokens.css` regeneration needed; the drift guard stays valid.
- **turbo "no output files for @caisson/site#build"** warning is benign — `turbo.json` caches
  `dist/**`; the site emits `out/`/`.next/`. Not worth a turbo-config change for one app.

## Follow-ups queued (later passes — not blockers)

- Full long-form marketing copy pass + media/video (operator-flagged: this pass is the scaffold).
- Harden CSP `script-src` from `'unsafe-inline'` to per-script hashes (static export inlines the
  no-flash + hydration scripts).
- First-party Plausible proxy (collapses CSP to `'self'`, dodges ad-blockers) — currently direct.
- Wire a live Resend account + `RESEND_API_KEY`/`RESEND_SEGMENT_ID` at DEPLOY (the function is inert
  until then, by design).
- `apps/studio` could later move to Next 16 to match `apps/site` (currently 15.1.6 — intentional,
  no drift risk; per-package versions are fine).
