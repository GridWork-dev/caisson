# SPEC — Edge/origin gate topology for the Railway-behind-Cloudflare estate

- **Date:** 2026-08-26
- **Status:** DECISION PENDING — operator fork. Nothing in this document may be executed before the operator picks. Drafted under the 2026-08-26 ruling "design pass first: no carve, no `deploy-railway` ride, no ORIGIN_SECRET seeding until the topology decision doc exists."
- **Tags:** `security` `infra` `external-system`
- **Scope:** the whole Railway-behind-Cloudflare estate — `caisson` (6 services) and `gridwork-studio` (2 services), fronted by the shared `gridwork-origin-router` Worker owned by `gridwork-infra`.
- **Decision:** none yet. The operator pick becomes an ADR in `knowledge/decisions/`; a Linear issue may reference it but never replaces it.

## Goal

Choose how the estate's origin-authentication gate is sequenced relative to the Railway→Cloud Run
migration, so that production deploys are possible again without either (a) shipping an
unreachable admin surface or (b) weakening a control that is already correct.

Success means: a named option is locked as an ADR; `caisson`'s `deploy-railway` path is either
unfrozen or deliberately kept frozen with a recorded expiry; `gridwork-studio`'s equivalent hold is
resolved the same way; and the demos gate question has an answer.

This is a sequencing decision, not a security decision. **No option here proposes weakening the
gate.** The fail-closed arming is correct and stays.

## The state, measured

Three sessions measured their own surface on 2026-08-25/26. Nothing below is relayed second-hand;
each fact carries its observer.

### What is already true (gridwork-infra, measured 2026-08-26)

- **All nine production hostnames serve through the Worker.** `caisson.sh`, `www.caisson.sh`,
  `admin.caisson.sh`, `license.caisson.sh`, `docs-api.caisson.sh`, `gridworkdigital.com`,
  `portal.gridworkdigital.com`, `gridwork.sh`, `gridwork.dev`. The Worker custom domain replaced
  each hostname's DNS record, so nothing reaches Railway through the orange cloud any more.
- **The nine Worker Secrets are seeded.** Proven by construction: the router returns 503 on a
  missing or empty binding, and every hostname answers non-503. Naming is `ORIGIN_SECRET_` +
  the hostname uppercased with **every** non-alphanumeric character replaced by an underscore — so
  `docs-api.caisson.sh` → `ORIGIN_SECRET_DOCS_API_CAISSON_SH`, hyphen included. Bindings are
  **per-hostname, not per-service**, so apex and `www` are two separate bindings both fronting
  `caisson-site` and both must carry that service's one value.
- **The Worker injects but never enforces.** Enforcement is app-side only. The router also strips
  client-supplied `x-gridwork-origin-secret`, so the header cannot be replayed in through the edge.
- **Exactly one production Access application exists, and it fronts `caisson.sh`** (`/dashboard`
  302s to `gridworkdev.cloudflareaccess.com`). `admin.caisson.sh` has **no** Access anywhere. The
  Access applications for `admin.caisson.sh` and `portal.gridworkdigital.com` are deliberately
  deferred to each hostname's own cutover gate (T35–T40), and they are _creates_, not imports.
- **Wave-5 does not assume Cloud Run has happened.** The Worker becomes the serving path _before_
  any origin flips; origins stay Railway until each hostname's own cutover. "Unfreeze Railway" is
  on the intended path — the freeze is an unplanned collision, not a decommission in progress.

### What broke (caisson, measured 2026-08-25/26)

PR #448 made the origin gate the first check in `apps/admin/src/proxy.ts` and the new
`apps/site/proxy.ts`, both matching `/:path*`. `packages/kernel/src/origin-gate.ts` fails closed by
construction: an absent `ORIGIN_SECRET_MODE` stays armed and no production value can disable it.

**Railway's platform healthcheck reaches the container internally, not through the public
hostname**, so it never carries the Worker-injected header. It gets the 403 the tests specify.
Deployment `15308a5d` ended FAILED; because `apps/admin` is the fail-fast verifier step, site,
demos, docs and support-bot were never attempted.

Prod is unaffected and healthy — Railway keeps the prior revision serving. All six services run
`9cb7681c`; `main` is 4 commits / 151 files ahead.

**The pairing is the unverified half, and it cannot be passively verified.** The Worker holds a
value per hostname and the Railway services hold `ORIGIN_SECRET`; nothing has proven the two sides
carry the _same_ value. Split the claim, because the halves have very different costs
(gridwork-infra, 2026-08-26):

- **Names** are verifiable in minutes — `wrangler secret list` returns binding names, and Railway
  var presence is readable.
- **Value-equality is not verifiable by any read.** Cloudflare exposes no API that returns a Worker
  Secret's value. Only two proofs exist: **constructive** — re-seed both sides with one fresh pair as
  a single act, which _is_ the held secrets authorization; or **behavioural** — an armed canary
  observing accept/reject, which is circular while deploys are frozen and the serving revisions
  predate the gate.

**Consequence for every option below: there is no passive pre-verification to wait on.** Whoever
authorizes seeding gets pairing by construction in the same minutes. "Prove the pairing first" is
not a separable step — it collapses into the seeding act itself.

### The same class at gridwork-studio (measured 2026-08-26 by that session)

- `GW_EDGE_SECRET` is **not set** on the Railway `site` service (var count as of 2026-08-20; the
  unarmed state unchanged since — a service var is set out of band).
- Their `railway.toml` and `railway.portal.toml` carry explicit do-not-deploy comments on `main`.
  The applied site deployment `ffcc2abe` still reads the pre-#85 manifest (`healthcheckPath: "/"`),
  confirming the hold is real and honored. `main` is 3 commits ahead of what the site serves.
- Studio ships **no disable/mode variable at all** for its edge gate — deliberately stricter than
  the fleet standard. Recorded as intentional; this doc must not normalize it away.
- Asymmetry worth carrying into the decision: with the secret absent, studio's **site** intake form
  rate-limits nobody (fail-open, deliberately, because a shared bucket on the only conversion path
  would be a site-wide kill switch), while the **portal** falls back to a shared bucket. Two
  branches of the same absent-secret condition, chosen per surface.
- The wire header is `x-gridwork-origin-secret` for everyone; `GW_EDGE_SECRET` is app-side naming of
  the same pair.
- Studio's services answer only under the custom-domain Host — the raw `*.up.railway.app` names 404
  — so their raw-origin bypass surface is genuinely narrower than caisson's.

## The options

Each option is stated with what it costs, not just what it buys. All three keep the gate armed.

### Option A — Health-path carve, Access env-gated until T35–T40

Carve the platform healthcheck out of the origin gate in both `apps/admin/src/proxy.ts` and
`apps/site/proxy.ts`, and make the admin Access requirement conditional on a variable that is off
until `admin.caisson.sh` gets its Access application at its own cutover gate.

- **Unfreezes:** caisson immediately; studio by the same patch shape.
- **Cost:** re-introduces a configuration-shaped opt-out on the Access side — the exact thing
  ADR-0415 ratified away. It would need its own ADR and a hard constraint that the variable cannot
  disable the _origin_ gate, only the Access assertion, and only while no Access app exists.
- **Requires alongside, not before:** the seeding act. A carve that lets a deploy succeed while the
  Worker and the service disagree on the secret would ship a fleet that 403s all public traffic — a
  strictly worse failure than today's, which at least fails loudly at deploy time. Since
  value-equality is only provable by re-seeding, the carve and the seeding land together or the
  carve is a gamble.
- **Sharp edge — and no edge change can file it down.** The forgery path is the raw
  `*.up.railway.app` origin, which the Worker never sees, so this cannot be fixed at the edge:
  `router.js` has no path logic at all (hostname key-select, method allowlist, 1MiB body cap) and
  none could help. Only app-side or Railway-side changes reach it. Sizing the exposure honestly
  (gridwork-infra, 2026-08-26):
  - Through the Worker, `/healthz` arrives **with** a valid injected secret once pairing holds. So
    the class the carve admits is exactly _requests without a valid header_ = the internal probe
    (intended) **plus** raw-origin public clients (the entire exposure).
  - Blast radius is therefore bounded by **what `/healthz` reveals**. Specifying it status-only —
    no build sha, no config, no dependency detail — converts the exposure from an information leak
    into an unauthenticated liveness ping. Note today's admin `/healthz` returns
    `{"ok":true,"indexDigest":"…","indexEntries":52}`, which is already more than status-only.
  - The discriminator search is **bleak, and this is the ceiling rather than a fallback from
    something better**: Railway's probe sets no signed or inimitable header, `healthcheckPath`
    configures a path and nothing else, and keying on a non-public `Host` is forgeable via the raw
    name. Path-plus-inert-response is realistically the strongest carve available.

### Option B — Bring Wave-5 steps 2 and 4 forward for the blocked hostnames

Verify/seed the Railway-side pairing now, and create the `admin.caisson.sh` Access application
ahead of its cutover gate.

- **Unfreezes:** caisson without any code change — the gate stays exactly as ADR-0415 ratified it.
- **Cost:** creating the Access app **enforces immediately** on an already-proxied hostname. That
  drags forward the OTP/MFA/IdP posture acceptance (doc 04 §6) and requires service-token/smoke
  provisioning before it can be created, or admin locks out. For `portal.gridworkdigital.com` the
  same move locks out every studio client until its allowlist carries real identities — so this
  option is _not_ symmetric across the estate and should not be applied to portal by default.
- **Buys less than it looks:** while the origin stays Railway, edge Access is defense-in-depth only
  — the raw `*.up.railway.app` origin bypasses it. For caisson that bypass is real; for studio it is
  narrower (custom-domain Host only).
- **Still does not fix the healthcheck, and the reason is mechanical rather than configurational.**
  Railway's healthcheck validates the **new** deployment _pre-promotion_, while the public hostname
  still routes to the **old** one during that window. A probe arriving through the public hostname
  could not reach the instance being validated even in principle — so there is no Railway setting
  that routes the gate-relevant probe through the edge. **Option B alone does not unfreeze the
  deploy.** It must be paired with A's carve or with C.

### Option C — Hold the freeze to T35–T40 and deploy nothing to Railway

Accept that `main` is not deployable to Railway, leave the serving revisions authoritative, and
carry the divergence until each hostname cuts over to Cloud Run.

- **Costs nothing to implement** and preserves every control exactly as locked.
- **Cost in risk:** the do-not-deploy comments become load-bearing in a way they were not designed
  to be. Nothing mechanical prevents a `deploy-railway` dispatch; the freeze is prose. Every
  subsequent merge widens the undeployed delta, and the first genuinely urgent production fix — a
  CVE, a checkout bug — arrives with no path to production on either platform, because Cloud Run
  services exist but still serve the bootstrap placeholder image.
- **Needs, at minimum:** a recorded expiry, and a mechanical block so the freeze cannot be
  dispatched away by accident.

### Recommendation

**Option B's step 2 plus Option A's carve, as one authorized act, scoped to caisson — and C's
mechanical block adopted regardless of the pick.** Concretely:

1. **Seed both sides of caisson's hostnames with one fresh pair per service** (apex and `www` share
   `caisson-site`'s value). This _is_ the pairing proof; there is nothing to verify beforehand.
2. **Land the carve in the same change**, keyed on path, with `/healthz` reduced to status-only on
   both `apps/admin` and `apps/site` so the admitted raw-origin class learns nothing. Accept that
   this is the ceiling, not a compromise — no better discriminator exists.
3. **Leave admin's Access application at its own cutover gate.** Skip Option B's step 4: it does not
   help the healthcheck, and it drags the OTP/MFA/IdP acceptance forward for defence-in-depth that
   the raw origin bypasses anyway.
4. **Do not apply any of this to `portal.gridworkdigital.com`** — its Access app locks out every
   studio client the instant it exists.

An earlier draft of this document recommended proving the pairing as a separate first step. That was
wrong: value-equality has no passive proof, so the "prerequisite" and the seeding are the same act.

This is a recommendation, not a lock. The operator decides.

## The demos question

`caisson-demos` is IAM-only by construction: no hostname ever, absent from `origin_map`, no Worker
binding, never fronted by the edge. It has no proxy and no gate. `apps/site/lib/demos-proxy.ts`
injects `x-gridwork-origin-secret` outbound to it, and nothing verifies it.

So the question is narrow and no edge fact constrains it: **is mesh-internal the whole boundary, or
should demos verify the header it is already being sent?** Verifying costs demos its own secret and
a proxy it does not currently have. Not verifying leaves an injected header that means nothing —
harmless today, misleading to the next reader. Recommend deciding explicitly rather than leaving the
injection unexplained.

## The sequencing finding

Two independent instances of the same failure, two months apart, both surfaced during this sweep:

1. `gridwork-studio`'s Wave-3 brief states as a **hard rule** that PR #85 stays a draft until each
   Railway service env carries its origin secret, and calls the freeze "mechanical." #85 merged
   2026-08-25; `GW_EDGE_SECRET` is still unarmed.
2. `gridwork-studio`'s ROADMAP §3.9 records the portal (PR #24) merging without its owed security
   audit — "The hold recorded here was not lifted; it was skipped."

Caisson's own #448 is arguably a third: merged under an operator ruling _in full knowledge_ that it
would fail the Railway deploy — which is the honest version of the same shape, because the cost was
accepted rather than overlooked.

**Candidate durable rule, for the operator to accept or reject as part of this fork:** a merge
precondition that names an out-of-band credential state needs a mechanical check, because a comment
in an untracked brief cannot block `gh pr merge`. Whether that check is a required CI job, a
`[merge_hold]` posture entry, or a pre-merge probe is itself part of the decision.

## Open questions for the operator

1. **Which option** — A, B, C, or the composition recommended above (B-step-2 + A's carve as one
   act). Note that A and B-step-2 are not independently orderable: the pairing proof is the seeding.
2. **Is the studio brief's freeze (a) stale or (b) released with its precondition unmet?** Neither
   caisson nor studio can discriminate this from inside their own repos.
3. **Demos:** verify the injected header, or drop the injection and record mesh-internal as the
   whole boundary.
4. **The durable rule above:** adopt, and in what mechanical form.
5. **Does `portal.gridworkdigital.com` follow caisson's answer or get its own?** The lockout
   asymmetry argues for its own.

## Failure modes this doc is guarding against

- Carving the healthcheck and calling the problem solved, when the pairing was never proven and
  admin has no Access app in front of it. That converts a loud deploy-time failure into a silent
  production one.
- Treating the Worker's injection as proof that public traffic will pass. Injection is not pairing.
- Applying one answer estate-wide when the portal's lockout blast radius is different in kind.
- Leaving the freeze as prose. It has already been overridden once by a merge.

## Provenance

- Edge facts: `gridwork-infra` session (files at `gridwork-infra @ e700224`; live probes 2026-08-26).
- Studio facts: `gridwork-studio` session (measured 2026-08-26; Cloud Run side explicitly unprobed —
  no credentialed gcloud account).
- Caisson facts: this session — deployment ledger, applied service manifests, live probes, and the
  #448 diff, 2026-08-25/26.
- Prior art in-repo: `docs/deploy/STATE.md` (2026-08-25 entry) reached the same root cause
  independently; ADR-0415 ratifies the admin Access re-coupling; CAISSON-208 tracks the unfreeze.
- Reviewed for factual accuracy against the edge by the `gridwork-infra` session, 2026-08-26. That
  pass confirmed all three claims it was asked to check, strengthened two of them, and corrected the
  pairing framing this document originally carried (see the Recommendation's closing note).
- `gridwork-infra#48` (open at time of writing) fixes a stale `terraform.tfvars` comment that still
  named `admin.caisson.sh` as the Access **import**. The corrected fact — one live production Access
  app, on `caisson.sh` — is what this document uses; the tfvars file stops contradicting it once #48
  merges.
