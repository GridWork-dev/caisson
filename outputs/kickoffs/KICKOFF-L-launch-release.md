# Kickoff L — Launch-prep + release cut

**Status: READY (operator-selected 2026-07-10).** Cross-cutting release act. Owns `.changeset/`,
`apps/site/app/docs/`, and `docs/gtm/directory-listings.md`. The version cut is repo-wide, so it
runs as the **final gated step of this sitting — after siblings J/K/I have landed** — to avoid
changeset churn racing other waves onto main.

**Provenance:** the release/launch-prep residue in `docs/state/outstanding-work.md` §1 — the 92
pending changesets, the AEO docs-metadata carry-forward, and the prepped directory batch.

## Scope (ordered — version cut LAST)

1. **AEO docs-metadata fix** — `apps/site/app/docs/[[...slug]]/page.tsx` `generateMetadata` skips
   `buildMetadata()`, so docs pages ship no canonical/OG/Twitter tags. The 6-line fix is written
   out in `outputs/research/aeo-audit-2026-07-09.md`; apply it, verify the rendered `<head>` on a
   docs route. (The rest of the AEO code surface — llms.txt/JSON-LD/sitemap/robots — is already
   excellent per that audit; the scoped CF-Access gate now lets bots read it, ADR-0303.)
2. **Directory-listing batch staging** — the 30–50-directory batch's fire trigger is "CF gate
   drops + checkout live", still unmet, so it stays PREPPED not fired. Stage/refresh
   `docs/gtm/directory-listings.md` so the batch is one operator action away the week checkout
   goes live; do not submit.
3. **Changeset version cut (92 pending) — FINAL ACT** — the deliberate release: `changeset
version` consume + republish per the ADR-0208 mechanics across @caisson/site (25), admin (18),
   service-license (8) + 29 packages. Run this only once J/K/I have merged, so the version bumps
   fold in their changesets too. Republish the registry index if any published-package version
   moved; live redeploy stays a separate operator-gated DEPLOY act.

## Binding rules

- No ADR citations in changeset **bodies** (the changeset-prose standards-gate rule — bodies ship
  to CHANGELOG; this rule lives only in the tooling/standards-gate CLI, not `bun run check`).
- `fetchWithTimeout` / Zod `.strict()` / no-`any` discipline on any code touched.
- The version cut touches every package — it is the merge-conflict maximizer, hence last.
- Every dispatch sets `model` explicitly (docs/version work = sonnet/haiku, never opus).

## Exit criteria

- Docs pages emit canonical/OG/Twitter (verified in rendered `<head>`); AEO carry-forward closed.
- Directory batch staged + trigger documented (not submitted).
- Version cut consumed, CHANGELOGs written, `.changeset/` drained to zero, standards-gate green,
  registry index republished if a published version moved — landed on main as the sitting's last
  commit. Live redeploy handed to the operator DEPLOY gate.
