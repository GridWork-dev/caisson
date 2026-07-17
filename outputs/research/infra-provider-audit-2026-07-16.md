# Infra / traffic / provider audit — 2026-07-16 (read-only, report-only)

- **Provenance:** ultracode fan-out (workflow `wf_0fbba1c1-384`): 5 read-only sonnet lanes
  (Cloudflare+traffic · Railway · analytics/observability · providers/credentials ·
  GitHub/CI) + a completeness critic. **Nothing was mutated** — per the operator directive,
  every action below is a recommendation; execution waits for a SPEC/picker if warranted.
- **Posture:** the estate is CLEAN overall. No unexpected services, no live security gaps,
  no runaway spend. Findings are hygiene-class drift + a handful of follow-ups.

## Traffic snapshot (7d, 2026-07-10 → 07-17)

- Zone `caisson.sh`: **~74.3k requests, ~1.74 GB**, 255 threats (concentrated in the
  07-10/11 spike day), top countries US/NL/DE/SG/AU.
- Registry Worker `caisson-registry`: **11,667 req/7d, 0 errors**. The
  `caisson-betterstack-adapter` Worker: 16 req/7d (event-driven, not dead).
- CF Access: `site_gate` exactly `/dashboard*`+`/cart*` (apex+www) + the e2e-prober service
  token (expires 2027-07-08). Bot management fully off (crawler_protection pinned disabled).
  WAF/rate-limits match spec (150/10s on /query, /api/auth/_, /@caisson_, /-/*). RUM beacon
  registered but `ruleset.enabled=false` — the deliberate CAISSON-50 root-kill, intact.
- Railway: **$1.65 spent this cycle, projecting ~$14.39/mo** — under the ledger's $20-40
  estimate. All 5 services + Postgres online, nothing unexpected.
- Analytics: Plausible = dashboard-only (Starter, no API key — by design). PostHog
  caisson-prod: **16 events/30d, 7 persons** (11 purchase, 4 web-vitals, 1 parity-probe;
  0 pageviews — pageviews are Plausible's job by doctrine; **0 LLM-obs events — that
  instrumentation is simply not wired yet**, a candidate follow-up not a defect). Grafana
  Cloud live: 5 alert rules / 3 caisson-ops contact points / 14 dashboards / 9 datasources.
  Better Stack: 4 monitors all up + status page 255425 operational.

## Findings — recommended actions (NOT executed)

### Hygiene batch (low risk, all diagnosed, one pass closes them)

| #   | Finding                                                                                                                                 | Evidence                                                         | Recommended action                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| H1  | Railway orphaned volume `postgres-volume-j_tL` (1,135 MB, attached-to N/A) billing under a "deleted service" line                       | `railway volume list` + usage line item                          | Delete after confirming no service needs it (stops a small recurring charge)                                        |
| H2  | Stale `SIGNOZ_QUERY_URL` in TWO places: `caisson-admin` Railway env AND `~/.gridwork/caisson.env` (SigNoz removed 2026-07-01, ADR-0177) | env name inventories (same fact, two homes — clean BOTH)         | Unset on caisson-admin (verify no admin route reads it) + delete from caisson.env                                   |
| H3  | email.tf's 11 DNS records live-in-CF but not in tfstate (known import gap) + 6 CAA records live but declared in NO .tf at all           | `terraform state list` vs live DNS (29 records, 18 not in state) | Run the email.tf import runbook (operator); decide CAA = import-and-declare or documented console-managed exception |
| H4  | Better Stack paused `wardfile pg-boss` heartbeat 465962 still present (fork PF2-3)                                                      | Better Stack heartbeat list                                      | Delete if wardfile stays retired; otherwise leave paused                                                            |
| H5  | `registry.caisson.sh` AAAA is CF's own custom-domain-managed record (correctly absent from terraform)                                   | Workers custom-domains API                                       | Document the exception near main.tf so future audits stop reflagging it                                             |
| H6  | providers.md Greptile follow-up half-stale: `GREPTILE_API_KEY` is ALREADY GONE from both env files                                      | zero grep hits both files                                        | Update the ledger row (local-cred half done; only org app-uninstall confirmation may remain)                        |

### Medium findings

| #   | Finding                                                                                                                                                                      | Evidence                               | Recommended action                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **caisson-support-bot deploy is 3 merged commits behind** (2026-07-11 build; misses PR 218 eval hardening + PR 225/231 dep bumps) — the only stale running code in the fleet | active deployment createdAt vs git log | Redeploy at the next operator-gated DEPLOY act                                                                                               |
| M2  | **OPENROUTER_MANAGEMENT_KEY is dead** (401 Invalid management key) — per-key usage/attribution for the six per-service keys is unreadable                                    | GET /api/v1/keys 401                   | Regenerate in the OpenRouter dashboard, update ~/.gridwork/env, re-run the per-key usage check                                               |
| M3  | **Paddle `GET /notification-settings` returns the webhook `endpoint_secret_key` inline** — it surfaced once in this session's tool output                                    | documented Paddle response field       | Optional: rotate the (sandbox) webhook secret if this transcript ever leaves operator control; future pulls filter that field before display |
| M4  | PostHog LLM-obs: zero `$ai_*` events — site Ask-AI / support-bot never wired capture                                                                                         | PostHog 30d event breakdown            | Candidate follow-up (fits the agent-runtime program's trajectory/telemetry work rather than a standalone fix)                                |

### Resolved tensions (no action)

- **`RELEASE_TRAIN_ARMED=true` is safe while the oss flip is blocked:** leg 3 (public npm
  via caisson-oss) carries its own `if: vars.RELEASE_NPM_MIRROR_ARMED == 'true'` gate
  (release-train.yml:118, ADR-0329) and that variable is UNSET — verified in the workflow
  source this session. The armed train publishes only to the private registry.
- **caisson-oss CI red (17/18 runs)** is the known pre-flip state: the G3
  `registry/index.json` byte-parity test cannot pass until mirror-sync ships the file at
  the W3 flip. Option: skip-in-mirror-context or accept the red badge; do nothing until
  the flip proceeds.
- **PostHog 0 pageviews** is by design (Plausible owns pageviews, cookieless).

### Blocked checks (rerun when unblocked)

1Password vault parity (op signin is operator-interactive) · OpenRouter per-key usage (M2)
· Plausible stats API (Starter has none) · Grafana exact quota GB (needs the org-admin
portal, not GRAFANA_TOKEN) · Blacksmith authoritative minutes (external SaaS — dashboard
only; rough proxy: ~490 2vCPU-min in one busy day-window, fork PF2-1 still worth a look)
· intel-daemon findings freshness (needs its real DATABASE_URL; container itself healthy).

### Critic: surfaces this audit did NOT cover (candidates for a follow-up lane)

Tailscale ACL/node/key posture · Discord bot liveness + alert-delivery proof · R2
lifecycle/retention on `caisson-registry-revocations` (WORM-relevant) · real npmjs.org
publish state for caisson-oss · mirror-sync workflow health/staleness · mac-mini runner
depth (disk/queue/single-point-of-failure) · other local daemons (tg-bridge, cockpit, exec)
· what Renovate/Socket/Arnica/Semgrep are actually reporting · backup recency re-proof ·
email deliverability (bounce/DMARC aggregate).

## Disposition

Per the operator directive this audit executes nothing. If the operator wants the hygiene
batch (H1-H6) + M1/M2 done, that is a single small SPEC/picker away — every item is
diagnosed with evidence above. The critic's uncovered-surfaces list is the seed for a
follow-up audit lane if wanted.
