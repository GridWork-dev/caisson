# ADR-0326 — CI runners: Blacksmith VM-per-job for the caisson hot path

- **Status:** locked (operator picker round 2, 2026-07-11)
- **Responds to:** the Codex host/CI audit critical (dind=true host-Docker-socket mount on the
  shared caisson-amd64 scale set) via the researched decision memo
  `outputs/research/ci-runner-research-2026-07-11.md` (workflow `wf_d37f7fe0-aaa`).

## Context

The audit confirmed `dind = true` in the shared runscaler config bind-mounts the host Docker
socket into every job container — effectively host-root for workflow code — on the same box that
runs gridwork-core and Wardfile CI. Research established: **no caisson workflow uses Docker at
all** (the flag is pure inherited liability); caisson's self-hosted share is ~15,124 runner-min/mo
(~252 hrs) across `quality`/`ci`/`security-scan` hot paths; credential-bearing jobs
(publish, deploy-railway, mirror-sync) already run GitHub-hosted. The operator requirements were
caisson-CI separation from other projects, documented setup, and optimized cost/speed — with a
stated willingness to pay for the right setup.

## Decision

Option B with **Blacksmith** (Firecracker microVM per job; ~$25–50/mo at current volume after the
3,000 free min/mo; expected lower with their speed-up):

1. The caisson amd64 hot path migrates off the shared box: `runs-on: caisson-amd64` →
   Blacksmith labels on the self-hosted workflow legs. Required-check names must not change.
2. The Mac-mini ARM matrix leg stays on the Mac mini ($0, unaffected).
3. Credential-bearing jobs (publish, deploy-railway, mirror-sync) STAY GitHub-hosted — prod
   tokens never ride third-party or persistent-shared runners.
4. After cutover is verified green, the `caisson-amd64` scale set is retired from <host>;
   `dind` on the shared box becomes a gridwork-core-only question (their hardening session owns
   it for their own jobs).
5. Blacksmith GitHub-App install on the `caisson-sh` org + billing = operator acts; the label
   swap + docs truth pass (CLAUDE.md CI binding, ci docs) ride the build item.

Rejected at this picker: harden-in-place on the owned box (A — $0 but keeps shared-kernel
co-tenancy), dind-off-only (D — no project separation), full GitHub-hosted (C — $110–250/mo,
1.5–3× wall-clock inflation). Ubicloud (~$12/mo) lost the vendor sub-fork to Blacksmith on
product maturity; revisit only if Blacksmith's bill or reliability disappoints.

## Consequences

Caisson CI gains VM-per-job isolation (the dind class becomes architecturally impossible) and
leaves the shared machine entirely; the box keeps serving gridwork-core/Wardfile only. Monthly
cost ~$25–50 accepted. Build item: CAISSON-97. The CLAUDE.md "CI → runs-on: caisson-amd64"
binding and `system/ci` docs are updated at cutover, not before.
