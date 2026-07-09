# Kickoff A — Security & billing correctness

**Worktree:** `~/lab/caisson-wt/security-billing` · **Branch:** `fix/security-billing-hardening` (off `main` @ go-live)
**Theme:** fix what just shipped. Verify + remediate the Strix pentest findings on the live commerce +
editions surface. **Session model routing:** crypto/money/license/security seams → **fable**; verification
scans → **sonnet**; recon → **haiku** (per the binding table in `CLAUDE.md`).

## Goal

Every Strix finding ends in one of two states with evidence: **confirmed-fixed** (root-cause fix + a
regression test) or **confirmed-not-a-bug** (a written rationale, e.g. accepted posture). Strix findings
are **pentest candidates, not confirmed bugs** — reproduce/verify each against the code before touching it.

## Scope (all 6 findings — source: `docs/security/strix-findings-2026-07-01.md`)

| #         | Sev    | Finding                                                                         | Where                                      | First move                                                                                                                         |
| --------- | ------ | ------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| vuln-0004 | **P0** | DNS-rebinding bypasses SSRF guards (CWE-918, CVSS 9.1)                          | `packages/alerting` webhook transport      | verify the guard resolves+pins the host; fix = resolve-then-pin or block private ranges post-resolution                            |
| vuln-0006 | **P1** | Seat members can modify org-level BYOK keys + compliance attestations (CWE-863) | `account_member` role checks               | verify the role gate on BYOK write + attestation mutation                                                                          |
| vuln-0002 | P2     | Paddle subscription-update webhooks grant a full credit cycle (CWE-840)         | `services/license` webhook event→grant map | verify `subscription_update` vs `subscription_cycle` mapping — is a full grant correct?                                            |
| vuln-0005 | P2     | Multi-item Paddle checkout grants only the first item (CWE-840)                 | `services/license` checkout→grant          | verify the grant loops all line items                                                                                              |
| vuln-0001 | P2     | Rate-limit bypass via spoofable forwarding header (CWE-770)                     | `services/docs` limiter                    | verify vs the ADR-0112 limiter key derivation                                                                                      |
| vuln-0003 | verify | Admin dashboard has no in-app auth (CWE-306)                                    | `apps/admin`                               | **almost certainly the accepted ADR-0140 CF-Access-alone posture** (already the 1 open PR#40 audit finding) — confirm, don't "fix" |

## Flow (do NOT skip)

1. **Research/verify first.** Reproduce each finding against the code; classify real vs false-positive vs accepted-posture.
2. **Ask the specific forks** via `AskUserQuestion` once verified — e.g.: the SSRF fix strategy (DNS-pin vs private-range block vs allowlist); whether 0002's full-cycle grant is a real bug or expected Paddle semantics; 0003 disposition (accept the CF-Access posture vs add app-layer auth). Do not auto-decide (the one operator rule).
3. **Then build** the confirmed fixes, one atomic commit each, with a regression test per non-trivial fix.

## Verify / exit

Goal-backward: each finding resolved with evidence; the commerce credit/entitlement path and the alerting
egress path have tests proving the fix. Tags: `security` `auth` `billing`. SHIP fires the security audit.

## Pointers

`docs/security/strix-findings-2026-07-01.md` · `outputs/triage/2026-07-01-post-golive-triage.md` (P0/P1 rows) ·
`identity/security.md` (the floor) · ADR-0112 (rate-limit) · ADR-0140 (admin CF-Access) · ADR-0197/0198 (BYOK/CMK) ·
the go-live memory `golive-merges-and-doc-hygiene`.
