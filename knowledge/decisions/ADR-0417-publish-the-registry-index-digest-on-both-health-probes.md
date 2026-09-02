# ADR-0417 — Publish the registry-index digest on both health probes: an origin gate proves provenance, not authentication

- **Date:** 2026-09-01
- **Status:** Accepted (operator picker in the caisson session pane, 2026-09-01 — ask `CAI-ASK-2a`, label verbatim below)
- **Scope:** `services/license` `/health` and `apps/admin` `/healthz` — the two strong legs of `registry/scripts/index-parity-probe.ts`
- **Parent:** ADR-0416 ruling 1 (the health-path carve, whose status-only half this supersedes) · ADR-0415 (admin Access re-coupling)
- **Evidence:** live measurement 2026-09-01, recorded below
- **Tracks:** CAISSON-206 (unrelated client-IP keying, measured the same sitting) · the F-1 index-parity probe

## Context

ADR-0416 ruling 1 carved `/health` and `/healthz` out of the fail-closed origin gate so Railway's
internal probe — which carries no Worker-injected `x-gridwork-origin-secret` — could reach them.
Because that carve also admits an unauthenticated caller on the raw `*.up.railway.app` origin, the
same change reduced both probes to **status-only** for callers that did not prove the secret, and
released the registry-index digest only to callers that did.

A peer session re-raised that shape as a leak. Measured here 2026-09-01, both halves of its premise
hold, and together they refute the protection rather than the field:

| Surface                                                                 | Response                                                     |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| `https://license.caisson.sh/health` (through Cloudflare)                | `{"ok":true,"indexDigest":"8835d704a8c7","indexEntries":52}` |
| `https://admin.caisson.sh/healthz` (through Cloudflare)                 | `{"ok":true,"indexDigest":"8835d704a8c7","indexEntries":52}` |
| `https://caisson-license-production.up.railway.app/health` (raw origin) | `{"ok":true}`                                                |

The Worker **injects** the secret into every request it forwards. So the digest is already served to
the entire internet through the front door, and the gate's only effect is to withhold it from a
caller who deliberately bypassed that front door — a caller who can obtain the identical value by
using it. The denied class is a strict subset in capability terms of the admitted one. That is what
makes the gate vacuous: it reads on the page as an authorization check, and there is no request it
can actually refuse the value to.

The general fact underneath, worth stating once because it will recur across this estate: **an
origin gate proves PROVENANCE — that a request arrived through our edge — not AUTHENTICATION of who
sent it.** Any control built on it inherits that limit.

What the field genuinely discloses was measured rather than assumed, because the convenient claim
(the digest is over a file the registry already publishes) is **false**: `registry/index.json` in
the repo carries **52** entries, while an anonymous `GET https://registry.caisson.sh/index.json`
returns the entitlement-filtered **16**-module open-Base view (digest `d325f425f2c9` over the served
bytes, against `8835d704a8c7` over the committed file). The published field is therefore a
**change-fingerprint plus a catalog count**: it tells an observer that the index changed and how
many entries it holds, never what is in them. That is the disclosure this ADR accepts.

## Decision

### Ruling 2a — "Delete the vacuous gate, keep fields public"

Both probes return `indexDigest` and `indexEntries` unconditionally whenever the index is readable.
The `originAuthorized` condition is deleted from `services/license/src/app.ts` and the `authorized`
conditional from `apps/admin/src/app/healthz/route.ts`, along with the now-unused origin-gate import
in the admin route.

**ADR-0416 ruling 1's carve itself stays.** Only its status-only reduction of the digest is
superseded; the exact-path exemption that lets Railway's probe answer without a secret is untouched,
and so is the near-miss test that keeps the carve from widening to `/health/...`.

Two options were declined:

- **Bearer-gate the fields.** Rejected: it mints a second credential to rotate, and to keep working
  the F-1 parity probe would have to carry it — buying real confidentiality for a fingerprint, at
  the cost of a new secret on a health path whose whole purpose is to answer cheaply.
- **Drop the fields entirely.** Rejected: they are the probe's two strong legs. Removing them
  blinds the only automated check that the license service, the admin app and the repo are serving
  the same registry index, to remove a fingerprint the edge already publishes.

## Consequences

- The parity probe no longer depends on Worker secret injection to read its two strong legs, so it
  keeps working from anywhere — including a direct-to-origin run during an edge incident, which is
  exactly when index parity is worth checking.
- The digest and count are public facts from now on. A future field on these probes is **not**
  covered by this ruling: anything richer than a fingerprint (module ids, versions, entitlement
  shape) needs its own decision, because the carve means there is no gate left to lean on.
- The tests flip with the code: the admin route test's raw-origin case now asserts the digest is
  present for every caller class, and its unreadable-index sibling stays as the assertion that still
  distinguishes "omitted because the file is absent" from "omitted because it was withheld".
- License is a dispatch-only deploy leg, so this reaches production on the operator's dispatch of
  `deploy-railway.yml`, not on the merge.

## Superseded advice

ADR-0416 ruling 1 records "with `/healthz` reduced to **status-only** on both `apps/admin` and
`apps/site`". For `apps/admin` and for the license service's `/health`, that clause is superseded
here. `apps/site`'s `/healthz` carries no digest and is unaffected.
