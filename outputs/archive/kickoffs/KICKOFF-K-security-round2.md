# Kickoff K — Security round-2 + hardening

**Status: EXECUTED 2026-07-10 — the four-layer stack built + merged as PR #200 (ADR-0314, renumbered from 0310 at merge per ADR-0088). The operator cred acts moved to `docs/state/outstanding-work.md` §1 (security-stack operator setup row); findings triage specced at `outputs/specs/close-out-triage/SPEC-security-scan-findings-triage.md`.**
Security-tagged. Owns the security surfaces: `.github/`, `infra/`, `apps/admin`,
`registry/worker/`, `services/*`, and any confirmed-finding fixes in the packages they touch.

**Provenance:** the Strix round-1 coverage-gap list (`docs/security/strix-findings-2026-07-01.md`
§Coverage gaps) + the H fork-round-2 record (round-2 waived as a merge blocker but still owed) +
the registry-live-429 verification declined at close-out (the raw 800-req burst tripped the
auto-mode load-testing classifier).

## Operator preconditions (do first — the scan is invalid without them)

The round-2 scope was chosen so the scan hits the surfaces round-1 could not. Provision before
dispatching the scan:

1. **CF-Access service-token creds** for the e2e-prober path so the harness can reach the gated
   commerce surface (`CAISSON_E2E_CF_CLIENT_ID`/`_SECRET`, already in `~/.gridwork/caisson.env`).
2. **Admin OAuth allowlist** — a scan identity in the admin numeric-id allowlist (auth mechanism
   was fully replaced by in-app GitHub OAuth since round-1, ADR-0283 — untested black-box).
3. **`codex login --device-auth`** for the Strix runner session.

## Scope

1. **Strix pentest round-2** — scope = round-1's own coverage gaps: admin black-box (new OAuth),
   authed buyer/owner/seat sessions, support-bot command surface, the registry Worker,
   DoS/body-size, supply-chain. Findings adversarially verified (fable on the money/license
   seams), fixed in-branch through the in-session SHIP-audit lane.
2. **Registry Worker rate-limit live-429 proof** — the close-out's open verification item: the
   CF native simple ratelimiter is per-server approximate, so a 320-req burst produced zero 429s.
   Prove the limit fires with a **sanctioned** approach (authorized k6/vegeta run at a documented
   rate against the prod Worker, or a Cloudflare-side synthetic) — NOT an ad-hoc raw burst that
   reads as prod load-testing to the auto-mode classifier.

## Binding rules

- Security floor = `identity/security.md` (timing-safe compares, fail-closed, Zod `.strict()`).
- Money/license/crypto seams → fable implementer + fable adversarial verdict; everything else
  opus review. Never fable for fan-out.
- Shell exec of `gh`/`systemctl`/`gw` routes through the exec endpoint, not a subagent shell.
- Every dispatch sets `model` explicitly; parallel writers isolate in worktrees.

## Exit criteria

- Round-2 findings triaged into fixed-in-branch vs. tracker-parked-with-trigger — nothing
  silently dropped; `docs/security/strix-findings-*` updated with the round-2 pass.
- The 429 limit proven firing on the prod Worker (or the limit re-tuned if it can't) — the
  close-out open item closed with evidence.
