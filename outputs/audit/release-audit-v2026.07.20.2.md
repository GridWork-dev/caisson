# Release audit — v2026.07.20.2 (consume 1 of the two-consume SKU arming)

- **Scope:** the human-authored source of this cut — PR #314 (publish arming: the four
  packages flip publishable with `sellable: false` kept, kinds corrected to primitive,
  the reserved-slug window opens, the agent-trajectory member repin 0.3.0 → 0.3.4) plus
  the release-branch commits (the everything-completeness guard allowlist expansion and
  the reserved-set graduation with its re-recorded registry-schema 0.5.7 tarball row).
  The rest of the release diff is machine output (version bumps, CHANGELOGs,
  ledger/index/tarball rows) verified by the version gate and the local byte-gate proof.
- **Tree:** main `4789bf7e` (PR #315 squash). Main CI 19/19 green including the five
  required checks. Local publish-mode byte-gate proof at this tree: exit 0, every
  recorded row re-packs to its advertised bytes.

## Security audit (entitlement/licensing seam) — PASS, zero blockers

Fable-lane audit, live-traced against the committed `registry/index.json`:

- **Over-grant: none.** All six bundle expansions exclude the quartet; the free Apache
  floor excludes them (license-keyed predicate); `members: {}` on each new entry and
  absence from every bundle members map means no bundle path grants them. Only a signed
  token carrying the exact purchased id reaches them — a purchase, not an over-grant.
  Worker enforcement re-verified: base-union-expansion with fail-safe to a fresh
  base-only set on any throw; unentitled modules 404 indistinguishably; the npm surface
  reuses the same gate. 83/83 worker tests pass at this tree.
- **Under-grant/regression: none.** The cut's members-map edits are version-pin moves
  only; member id sets are unchanged, and expansion grants member keys, so no sold
  entitlement changes behavior. The one behavioral delta — the four slugs moving from
  reserved-fail-soft to index-resolved — is strictly access-increasing and only for
  holders of those exact ids: the documented graduation path.
- **Fail-closed default intact.** Branch precedence untouched; an unknown bare slug
  still throws; NON_MODULE ids keep precedence. Pinned by the updated expansion tests.
- **publishConfig flip: no leak path.** The four packages' pack roots carry only
  src/tests/dist/manifest/README/CHANGELOG — no env files, keys, or internal docs; the
  config shape is byte-identical to the commercial fleet convention. The
  artifact-render publish is required correctness: published consumers declare runtime
  deps on it, and a private dependency of a published package is an unresolvable
  install range.
- **Re-recorded registry-schema 0.5.7 row: process fail-closed.** Pure addition, one
  lockHash across the cut's rows, and the publish-mode byte gate at the tag re-packs
  every tarball and hard-stops on mismatch before any external write.
- **Advisories (non-blocking):** (1) the deprecated `fullCatalogMembers` fallback in
  entitlements.ts would widen a hypothetical no-bundle-entry derivation — dead code
  while the everything index entry holds, loudly caught by the exact-equality worker
  test if it ever activated; queued for removal. (2) the completeness-guard allowlist
  names auto-expire when a module joins everything's members; prune the three
  graduating names in the follow-on catalog cut for hygiene.

## Code review — PASS (no P0/P1; three P2 notes)

Opus-lane review of the same diff scope: no correctness blockers. The
completeness-guard allowlist expansion keeps the guard sound — the exception is
two-sided (named AND absent from everything's real index members), so a genuinely
missing module not named in the allowlist still fails the guard, and named modules
auto-expire from the exception the moment the index grants them. Manifest pins verified
against published versions (agent-trajectory 0.3.4 with all bundle self-pins published);
the graduated slugs confirmed indexed at 0.2.0 with no purchase-book row, so no buyer
can hold the grant. The shipped registry-schema 0.5.7 is a clean no-op against the
last-published 0.5.6 (the armed four-slug state never shipped).

- **WR-01 (P2):** the three SKU manifests still carry the placeholder 4900 price under
  sellable:false — the established substrate convention. Already resolved as
  prescribed: the sellable-flip PR (#316, held for post-tag merge) sets the locked
  priceCents AND the PRICE_AUTHORITY rows in the same change.
- **WR-02 (P2):** the reviewer asks for the completeness-guard allowlist names to be
  pruned in lockstep with the members-map addition. Sequencing note: pruning in the
  flip PR itself would red the guard between that merge and the membership consume
  (the index gains the members only at the consume), which is exactly what the
  auto-expiring filter exists to bridge — the prune therefore rides the follow-on
  catalog cut after the consume, alongside the site rows.
- **IN-01 (P2, context, not release-introduced):** compliance-core's served latest
  moves 0.5.1 → 0.6.0 adding two sellable:false runtime deps; the transitive
  commercial-dependency install pattern is pre-existing and this cut makes it strictly
  better (the deps now resolve on every delivery surface instead of being an
  unresolvable private range).

## Verdict

**PASS.** No blocker against tagging `v2026.07.20.2` at the attestation commit on
`4789bf7e`. Follow-ups queued: the refresh-lane historical-check resolution bug (it
validates historical rows under main's lockfile instead of the candidate's), the
dead-path fallback removal, and the allowlist hygiene prune — none release-gating.
