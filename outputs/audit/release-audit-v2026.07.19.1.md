# R4 release audit — v2026.07.19.1

Window: `v2026.07.19..7b3a8a1d` — the wave ride: PR #287 (toolchain), #288 (multi-year
renewal lever), #289 (OSCAL live push), #290 (lock-hash annotate refinement), ADR-0366
docs, repack changesets, consume #291 (5 packages).

Lanes: PRs #288/#289 were audited pre-merge this session (fable money-seam PASS with the
NaN-guard fix applied; reviewer round on the transport incl. the resolved-SSRF guard,
fixes applied and re-verified). The fresh spot-audit (fable) covered the one unreviewed
piece (#290) plus the consume output.

## Verdict: PASS — no findings.

- **#290 guard refinement:** no skip path remains — every live-version row re-packs and
  byte-compares; the lock-hash annotation is message-only and cannot mask a mismatch;
  both the false-positive class and the cited-drift error are test-pinned (38/38).
- **Consume #291:** ledger pure-append (5 rows), sidecar pure-append with one 64-hex
  lockHash equal to the committed lockfile's sha256, index latest advances consistent,
  private packages correctly unledgered.
- **ADR-0366 + docs:** decision-lock only, ceiling consistent in all four places, no
  shipped-code overclaim.

## Watch item (not a finding)

platform-reads: fourth resolution-drift repack — if it recurs next ride, the terminal
cure is a scoped isolatedDeclarations change for that one package.
