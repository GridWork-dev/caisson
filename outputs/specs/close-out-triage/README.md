# Close-out triage specs — 2026-07-10 (I/J/K three-stream close-out)

**Status: LOCKED set (ADR-0315, 2026-07-10) — the picker armed all four; fork outcomes recorded per spec.** Written at the 2026-07-10
three-stream close-out (Kickoff-I perf/mobile · Kickoff-J pricing-gtm verification · Kickoff-K
security round-2 / PR #200). Every deferred item, non-essential-CI finding, and interrupted
follow-up from the three streams is triaged into exactly one spec below (or dispositioned in the
close-out report — trigger-parked rows stay in `docs/state/outstanding-work.md` §3 and are NOT
re-specced here).

| Spec                                    | Covers                                                                                                                                                     | Source stream |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `SPEC-security-scan-findings-triage.md` | The `deterministic` CI scan's first hardening output: 8 semgrep JSON-LD findings, trivy/osv dep CVEs, the SARIF artifact-upload defect, Docker digest pins | K             |
| `SPEC-affiliate-production-flip.md`     | `parsePaddleEvent` `discount_id` capture, per-affiliate code minting, commission/clawback report                                                           | J             |
| `SPEC-retrieval-quality-battery-v2.md`  | Battery-v2 re-run on the fixed retrieval stack, k=5 live probes, live-hybrid golden variant, refund-policy corpus page                                     | J             |
| `SPEC-perf-followups.md`                | CAISSON-81 server-minted session-hint cookie (the reverted owned-fetch skip), CAISSON-82 NFT trace residual                                                | I             |
| `SPEC-admin-dashboard-buildout.md`      | Admin cockpit views + telemetry federation (logs/commerce/product/fleet/support/intel-triage waves) — LOCKED (ADR-0316) — full six-wave buildout           | follow-up     |

Dispositioned WITHOUT a spec (recorded in the close-out report):

- `strix-findings-*.md` rename — **dropped**: the tooling playbook + pentest runbook deliberately
  keep them as findings history ("Pentest findings history (kept)").
- Homepage chrome slices c/d + the 94KB CSS audit — **stay trigger-parked** (§3 tracker rows with
  named triggers; re-speccing them would un-park them).
- Operator-owed env/account items (SEMGREP_APP_TOKEN, MIRROR_PUSH_TOKEN workflow scope,
  `tools/security/install.sh` sudo run, free-tier signups, paid pentest buys) — tracker §1 rows,
  not build specs.
