# W3 flip-gate verification — go/no-go distance report (2026-07-17)

Read-only recon, verified against main `d0c2c20a`; operator-locked outcome at the same-day
triage picker: **all technical gates GREEN · flip HELD on business optics** (the operator waits
for Mercury/Paddle to be materially further along before any public GTM motion). Every
secret/variable check below was by NAME only (`gh secret list` / `gh variable list`) — no values
read.

## W3's own precondition set (SPEC-oss-launch-program.md §W3, ADR-0318)

1. **W1 sandbox gate** — GREEN (2026-07-10 audit: OSS-mirror-track zero open P0/P1; the same
   audit's commercial-track registry findings were closed by the 2026-07-17 publish rides and
   were never a mirror-content blocker). Owner: code (closed).
2. **W2 history cut-over** — GREEN, landed 2026-07-10.
3. **W4 release train** — GREEN. First ride green 2026-07-12; `RELEASE_TRAIN_ARMED=true`
   confirmed by name (set 2026-07-12); CI green on main today.
4. **P0 credential rotations** (ADR-0226 F1+F4) — GREEN, all four legs done (issuer keypair
   07-05 · OPENROUTER_API_KEY 07-08 · DISCORD_TOKEN 07-10 · MIRROR_PUSH_TOKEN 07-10, re-verified
   by name).
5. **Fresh-export entitlement-token scan-gate** — the one condition never previously recorded as
   run. **RAN LIVE THIS SESSION, GREEN**: `bun scripts/export-public-mirror.ts` → 20 packages
   exported clean (self-containment pass) → `checkEntitlementTokenScan()` (the exact
   standards-gate function) against the fresh tree → **0 findings, exit 0**. Closed, verified
   fresh — not from stale docs.
6. **Directory-listing batch** — staged (`docs/gtm/directory-listings.md`); the submission act
   rides the pre-launch window per F5, not a gate.

## Live-state ground truth (by name only)

- `RELEASE_NPM_MIRROR_ARMED` — confirmed ABSENT (correct per ADR-0329; leg 3 no-ops until the
  flip).
- `NPM_TOKEN` — confirmed present on caisson-oss (set 2026-07-02); gated only by the variable
  above.
- caisson-oss — confirmed still PRIVATE (`gh repo view`); last push 2026-07-12 (last mirror-sync
  ride). Branch-protection API answers 403 "make this repository public" — native protection
  arrives free at the flip, no action needed.

## The 18 §13 business gates: they gate the SALE, not the flip

`docs/business/caisson-internal-master-map.md` §13's rows are all literally labeled
REQUIRED-BEFORE-FIRST-SALE; none references the OSS flip, and ADR-0318's W3 precondition list is
self-contained. The flip publishes only Apache-2.0 packages for free — no checkout, money, or
buyer contract is touched. The one adjacent row (open-source boundary correctness) is already
continuously CI-enforced (`checkOpenCoreLicensing`/`checkOpenCommercialBoundary` inside the
required standards-gate, green on main today) independent of the register's legal sign-off.
Mercury and Paddle remain APPLICATION PENDING — that is the first-sale bar, deliberately not
closed by this recon.

## Verdict + the 7-step operator checklist (when the hold lifts)

Zero engineering or verification work remains; the flip is executable pending only the timing
call. In order:

1. Operator locks go/when (ADR-0318 binding: a named, deliberate, irreversible act — never
   autonomous).
2. `gh repo edit caisson-sh/caisson-oss --visibility public` — the literal flip.
3. Set `RELEASE_NPM_MIRROR_ARMED=true` on caisson-sh/caisson (arms leg 3).
4. Fire the next release-train ride (or mirror-sync + the mirror's publish with
   `confirm=publish`) → `@caisson-sh/*` live on public npm.
5. Land the first-screen README sentence naming the generated-mirror model (ADR-0318 F2 rider) at
   or before the flip.
6. Fire the staged directory batch + Awesome-list PRs + newsletter submissions.
7. Hold the 2–4 week pre-launch window (F5), then Show HN.
