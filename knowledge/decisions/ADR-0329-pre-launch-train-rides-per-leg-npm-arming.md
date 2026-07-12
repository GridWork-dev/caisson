# ADR-0329 — Pre-launch train rides skip the npm-mirror leg via its own arming variable

- **Status:** locked (operator picker, 2026-07-12, wave-1 reconcile session)
- **Amends:** ADR-0325 (commit-addressable release train), ADR-0318 (OSS launch program)

## Context

ADR-0328 D2 queues the FIRST release-train ride pre-launch (fixes CAISSON-85/86: advertised
versions get real R2 tarballs, manifests re-pin) with hard boundaries: no caisson-oss public
flip, no npm-mirror publish, no site-posture change. ADR-0325's train assumed the mirror legs
were inert-until-armed via their credentials ("arming the train without arming those legs
still no-ops them green") — but `MIRROR_PUSH_TOKEN` stopped being an inert-guard when
mirror-sync armed it on 2026-07-10, and `NPM_TOKEN` is live on caisson-oss. Leg 3 dispatches
`caisson-sh/caisson-oss publish.yml -f confirm=publish`, so a full ride tonight WOULD have
published `@caisson-sh/*` to public npm. Caught at the reconcile session's pre-ride review.

## Decision

Leg 3 (mirror npm publish) gains its own job-step guard in `release-train.yml`:
`if: vars.RELEASE_NPM_MIRROR_ARMED == 'true'`. The variable stays unset until the ADR-0318 W3
public flip; setting it is an operator act recorded alongside the flip. `RELEASE_TRAIN_ARMED`
keeps gating the whole propagate job as before — the two variables compose: train armed +
npm-mirror unarmed = the pre-launch ride shape (leg 1 registry R2 publish live, leg 2 private
mirror sync live, leg 3 skipped, leg 4 inert via missing `RAILWAY_TOKEN`).

## Consequences

- Pre-launch rides are safe by construction, not by credential accident; the launch flip arms
  npm publishing with one variable, no workflow edit.
- The ADR-0325 comment's inert-guard claim is superseded for leg 3 by this explicit variable.
- Rollback: delete the `if:` line (returns to ADR-0325 semantics) — only sane post-launch.
