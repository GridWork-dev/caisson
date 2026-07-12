---
updated: 2026-07-12
status: session-Q deliverable (ADR-0328)
grounds:
  - docs/state/providers.md
  - workflow wf_fdbf28a9-fb3 (10 sonnet pricing agents, vendor pages, 2026-07-12)
  - live API/CLI probes this session (R2, Better Stack, Discord, Grafana, PostHog, Resend, GitHub)
---

# Provider status + cost rollup — 2026-07-12 (session Q)

The kickoff-Q account/surface sweep: every prod provider probed live where a credential
exists, pricing re-verified against vendor pages (10-agent workflow), optimization picks
listed as FORKS (recommendations only — locks stay operator/ADR acts; boards frozen during
the wave, so the fork rows live here + the session report until reconcile).

## Status + cost table

| Provider            | Role                                                                                                                   | Tier / price (verified 07-12)                                                                 | Live status (probed 07-12)                                                                   | Free-tier headroom                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Railway**         | Fleet: 5 services + managed PG                                                                                         | Pro $20/mo seat + usage (RAM $10/GB-mo · CPU $20/vCPU-mo · egress $0.05/GB · vol $0.15/GB-mo) | 6 service instances RUNNING; **Postgres-ASm4 scratch deleted this session** (was 7)          | ~$20–40/mo all-in (exact usage = dashboard read, no CLI billing API)       |
| **Cloudflare**      | DNS, WAF, rate-limit, registry Worker                                                                                  | Free zone + Workers Free (100k req/day)                                                       | Rate-limit 150/10s live (applied this session); **all 4 bot-management fields now disabled** | Fine pre-launch                                                            |
| **Cloudflare R2**   | Registry tarballs + revocations                                                                                        | Free ≤10GB, 1M Class-A, 10M Class-B ops/mo                                                    | `caisson-registry-tarballs` 64 objects · `caisson-registry-revocations` 1 object             | ~0% used — $0                                                              |
| **AWS S3**          | **`caisson-worm`** WORM anchor sink (Object Lock) — _the kickoff said "R2/WORM"; the WORM bucket is on AWS S3, not R2_ | S3 + Object Lock, anchor-sized objects                                                        | Not probed this session (AWS creds are app-side)                                             | ~$0–1/mo at anchor volume                                                  |
| **Resend**          | Transactional + lifecycle email                                                                                        | Free: 3k/mo, **100/day cap**; Pro $20/mo = 50k/mo                                             | Domain `caisson.sh` verified (us-east-1)                                                     | Fine pre-launch; **100/day is the launch-week risk** (fork 2)              |
| **Discord**         | Community, support bot, buyer OAuth                                                                                    | Free                                                                                          | Bot "Caisson Support Bot" live, flags 11042816 (both limited intents ON)                     | n/a                                                                        |
| **Better Stack**    | External uptime + logs leg                                                                                             | Free: 10 monitors, ≤30s checks; first paid $25/mo                                             | 3 monitors: caisson.sh **up**, license **up**, `wardfile` **paused** (gridwork-era leftover) | 7 monitor slots free — $0                                                  |
| **Grafana Cloud**   | Sole OTLP sink (metrics/logs/traces)                                                                                   | Free: 10k series, 50GB logs, 50GB traces, 14-day retention; Pro $19/mo+usage                  | Stack healthy (13.2); Loki carrying per-service streams since 07-10                          | 5 low-traffic services — comfortably $0                                    |
| **PostHog**         | Product analytics (caisson-prod)                                                                                       | Free ≤1M events/mo, 5k replays                                                                | **12 events / 3 persons in 30d** (site is CF-Access-gated; volume arrives at go-live)        | ~0% used — $0                                                              |
| **Plausible**       | Cookieless marketing analytics                                                                                         | Starter **$9/mo** (no free hosted tier; Growth $14 next)                                      | Active + collecting; **dashboard goals = this session's operator act**                       | n/a                                                                        |
| **Linear**          | Issue tracking (Business)                                                                                              | **$16/user/mo billed yearly** × 1 = $16/mo                                                    | Connected; triage + automations live (07-11)                                                 | n/a                                                                        |
| **Blacksmith**      | CI runners (ADR-0326)                                                                                                  | Free 3,000 2vCPU-min/mo → **~1,500 effective 4vCPU-min**; $0.008/min beyond                   | Last 7d: ci 30 runs ×1.1m + quality 30×1.1m + security-scan 30×2.7m + misc (×multi-job)      | **Estimated ~2,000+ 4vCPU-job-min/mo — likely AT/OVER free tier** (fork 1) |
| **Cookiy**          | Research studies                                                                                                       | PAYG: qual $9.99, quant $0.50, synthetic $0.20                                                | Positioning study `019f57b1` launched this session (~$122 of the $130 ADR-0328 D4 budget)    | n/a                                                                        |
| **OpenRouter**      | LLM inference (6 per-service keys)                                                                                     | Usage; pre-launch ~$0                                                                         | Six keys live since 07-08                                                                    | **Per-key credit caps still unset** (waived 07-08; fork 5)                 |
| **Paddle / Stripe** | MoR / dormant billing driver                                                                                           | % of revenue                                                                                  | Sandbox live; **production submission = this session's operator act**                        | n/a                                                                        |

**Fixed run-rate:** Railway ~$20–40 + Plausible $9 + Linear $16 ≈ **$45–65/mo** (+ Blacksmith
$0–10 pending fork 1). providers.md's "$30–50 floor" predates the Linear Business line — this
table supersedes it as of 2026-07-12.

## Optimization picks (FORKS — not locked)

1. **Blacksmith free-tier burn (the real one).** Run-math says the repo likely exceeds ~~1,500
   effective 4vCPU-min/mo. Operator: read the usage page at app.blacksmith.sh. Picks:
   (a) accept overage (~~$4–8/mo at current cadence) · (b) thin PR-lane jobs (path filters
   already exist; drop `security-scan` from PRs, keep on main) · (c) move cheap jobs back to
   GitHub-hosted (private-repo free tier is 2,000 min/mo, sitting unused since ADR-0326).
2. **Resend 100/day cap at launch.** Lifecycle + abandoned-cart + verification emails share
   the cap. Picks: pre-arm Pro ($20/mo) at the go-live flip · or accept throttling week one.
   Trigger-parked to the launch runbook either way.
3. **Better Stack `wardfile` monitor.** Paused gridwork-era monitor inside the caisson
   account — delete for hygiene (Wardfile itself was paused 2026-07-11 in gridwork-core).
4. **GitHub org hygiene trio ($0):** require org 2FA (`two_factor_requirement_enabled` is
   false) · flip `members_can_create_public_repositories` off (accidental-public risk while
   caisson-oss stays private) · enable `delete_branch_on_merge` on both repos.
5. **OpenRouter per-key caps.** Explicitly waived 07-08 (attribution was the goal) — reconfirm
   the waiver or set caps in the OpenRouter UI; a leaked key today has unbounded spend.

## GitHub apps + repo config audit (same sweep)

- **Org apps (org API, 07-12):** renovate (selected) · socket-security (selected) ·
  linear-code (all) · blacksmith-sh (all). **No Arnica** — install pending the operator's
  finish-install pick this session. No stragglers (Greptile app confirmed gone).
- **caisson secrets (12):** CLOUDFLARE_ACCOUNT_ID/API_TOKEN, DATAFORSEO_LOGIN/PASSWORD,
  MIRROR_PUSH_TOKEN, OPENROUTER_API_KEY, POSTHOG_CAPTURE_HOST/KEY, R2_ACCESS_KEY_ID/
  ACCOUNT_ID/SECRET_ACCESS_KEY, SEMGREP_APP_TOKEN — all rostered, nothing stray.
- **caisson variables: none** — `RELEASE_TRAIN_ARMED` correctly absent (train stays dormant).
- **caisson-oss:** private ✓ (W3 flip pending), secrets = `NPM_TOKEN` only.
- **Org members:** GridWork-dev only. Settings hygiene → fork 4 above.
