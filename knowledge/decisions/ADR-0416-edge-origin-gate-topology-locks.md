# ADR-0416 — Edge/origin gate topology: seed-and-carve as one act, demos is mesh-internal, merge preconditions get a mechanical check

- **Date:** 2026-08-26
- **Status:** Accepted (operator picker in the caisson session pane, 2026-08-26 — four rulings, labels verbatim below)
- **Scope:** the whole Railway-behind-Cloudflare estate — `caisson` (6 services) and `gridwork-studio` (2 services), fronted by the shared `gridwork-origin-router` Worker owned by `gridwork-infra`.
- **Parent:** ADR-0415 (admin Cloudflare Access re-coupling) · the T20/T21/T22/T27 Cloud Run prerequisites in PR #448 · gridwork-core `outputs/specs/merge-hold-posture/`
- **Evidence:** `outputs/specs/edge-origin-topology/SPEC.md` (PR #461), reviewed for factual accuracy by the `gridwork-infra` session 2026-08-26
- **Tracks:** CAISSON-208 (unfreeze), CAISSON-206 (client-IP keying, unrelated to #448)

## Context

PR #448 armed the fail-closed origin gate as the first check in `apps/admin/src/proxy.ts` and the
new `apps/site/proxy.ts`, both matching `/:path*`. Railway's platform healthcheck reaches the
container **internally**, never through the public hostname, so it cannot carry the Worker-injected
`x-gridwork-origin-secret`. Deployment `15308a5d` ended FAILED; `apps/admin` is the fail-fast
verifier step, so site, demos, docs and support-bot were never attempted. `main` has been
undeployable to Railway since, 4 commits / 151 files ahead of the serving `9cb7681c`.
`gridwork-studio` is held the same way by its own T27 do-not-deploy comments.

Three facts, each measured by the session that owns the surface, decided this:

1. **The edge is already the serving path.** All nine production hostnames route through the Worker,
   and its nine secrets are seeded — proven by construction, since the router 503s on a missing
   binding and every hostname answers non-503. The Worker **injects but never enforces**.
2. **Value-equality of the secret pair has no passive proof.** Cloudflare exposes no API returning a
   Worker Secret's value. Binding _names_ are readable in minutes; equality is provable only
   constructively (re-seed both sides as one act) or behaviourally (an armed canary — circular while
   deploys are frozen and the serving revisions predate the gate).
3. **Exactly one production Access application exists, and it fronts `caisson.sh`.**
   `admin.caisson.sh` has none.

Fact 2 is the one that decided the shape. An earlier draft of the SPEC recommended "prove the
pairing, then carve." There is no such prerequisite — the proof and the seeding are the same act.

## Decision

### Ruling 1 — "Recommended composition"

**Option B's step 2 plus Option A's carve, as one authorized act, plus Option C's mechanical block
regardless.** Concretely:

1. **Seed both sides of caisson's hostnames**, one fresh pair per service. Apex and `www` are two
   separate bindings sharing `caisson-site`'s one value. This _is_ the pairing proof.
2. **Land the carve in the same change**, keyed on path, with `/healthz` reduced to **status-only**
   on both `apps/admin` and `apps/site`. Admin's `/healthz` currently returns `indexDigest` and
   `indexEntries`; that is more than status-only and must shrink.
3. **Leave admin's Access application at its own cutover gate (T35–T40).** It does not help the
   healthcheck and buys defence-in-depth that the raw `*.up.railway.app` origin bypasses.
4. **Adopt a mechanical block on the freeze** regardless of the above, so it cannot be dispatched
   away by accident.

**Accepted cost, stated plainly.** The carve's forgery path is the raw `*.up.railway.app` origin,
which the Worker never sees — `router.js` has no path logic at all, so **no edge change can close
it**. Through the Worker, `/healthz` arrives _with_ a valid secret, so the class the carve admits is
exactly the internal probe (intended) plus raw-origin clients (the whole exposure). Reducing
`/healthz` to status-only converts that from an information leak into an unauthenticated liveness
ping. Path-plus-inert-response is the **ceiling**, not a fallback from something better: Railway's
probe sets no signed or inimitable header, `healthcheckPath` configures a path and nothing else, and
keying on a non-public `Host` is forgeable via the raw name.

### Ruling 2 (earlier, 2026-08-26) — portal follows caisson

`portal.gridworkdigital.com` takes the same answer as caisson rather than its own.

**This is safe only because of ruling 1's step 3.** Creating an Access application on portal locks
out **every studio client** until its allowlist carries real identities; the equivalent act on
`admin.caisson.sh` locks out one operator. Step 3 creates no Access application at all, so portal
inherits the skip and receives only seeding plus the carve. Under Option B taken whole this same
ruling would have locked out every studio client. **Rulings 1 and 2 are not independent and must be
read together.**

### Ruling 3 — "Record mesh-internal as the boundary"

`caisson-demos` is IAM-only by construction: no hostname ever, absent from `origin_map`, no Worker
binding, never fronted by the edge. **Mesh-internal isolation is the whole boundary.** The
`x-gridwork-origin-secret` that `apps/site/lib/demos-proxy.ts` injects outbound is vestigial —
document it as such or drop it. Demos gets no secret and no proxy.

Rejected: making demos verify the header. It would add a secret to rotate, a proxy to maintain, and
a second service that can fail its healthcheck exactly the way admin just did — to defend a surface
with no public route.

### Ruling 4 — "Adopt as a `[merge_hold]` posture entry"

**A merge precondition that names an out-of-band credential state needs a mechanical check**,
enforced as a `[merge_hold]` posture entry rather than a new per-repo CI job or prose.

Drawn from three instances across two repos and two months: gridwork-studio's Wave-3 brief declaring
PR #85's freeze "mechanical" while #85 merged with `GW_EDGE_SECRET` unarmed; gridwork-studio
ROADMAP §3.9 recording the portal's owed security audit as "not lifted; it was skipped"; and
caisson's own #448, merged in full knowledge it would fail the Railway deploy — the honest version of
the same shape, where the cost was accepted rather than overlooked.

Prose was rejected explicitly: prose is what failed in all three instances. A required CI job was
rejected as one new job per repo, each able to drift from what it was written to assert. The posture
entry rides machinery that already holds merges.

### Ruling 5 — the gridwork-studio freeze reads as (a), stale

The operator ruled that the #85 brief line is **stale** — the freeze was lifted between 2026-08-21
and 2026-08-25 and the untracked brief was simply not updated. Not a precondition released unmet.

Consequence: ruling 4 stands on its own merits as a durable improvement, not as remediation of a
live inversion on studio's `main`.

## Consequences

- Execution of ruling 1 is **still gated on the secrets authorization** — seeding is an always-page
  class, so this ADR authorizes the _shape_, not the act. Nothing here permits a session to seed.
- `/healthz` shrinking to status-only is real work in `apps/admin` and `apps/site`, not a checkbox.
- Studio inherits the same patch shape; the estate's answer is one answer.
- `gridwork-infra#48` fixes the stale `terraform.tfvars` comment naming `admin.caisson.sh` as the
  Access import. Once merged, the tfvars file stops contradicting fact 3.
- Ruling 4 lands in caisson's own `[merge_hold]` table — which this repo does not yet have, and
  whose absence currently holds every merge here for the operator.

## Superseded advice

The SPEC's first draft recommended proving the pairing as a separate prerequisite step, and
recommended excluding `portal.gridworkdigital.com` entirely. Both are superseded above; they are
named rather than deleted so a reader who saw the earlier draft knows which way it moved and why.
