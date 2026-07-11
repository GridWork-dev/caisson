# CI runner research — 2026-07-11

Workflow `wf_d37f7fe0-aaa` (4 research legs + opus synthesis, 620k tokens). Trigger: the
Codex host/CI audit confirmed `dind=true` on the caisson-amd64 scale set; operator sent the
runner question to research before forking (board Open row). Decision memo below, raw
usage profile appended.

---

# Caisson CI Runner — Decision Memo

## 1. Workload summary

Caisson CI runs ~**169 runs/day** steady-state (bursty **49–359/day**, PR-wave-driven) for **~20,315 runner-min/mo (~339 runner-hrs/mo)** across all runner types. Of that, **~15,124 min/mo (~252 runner-hrs/mo)** is the `caisson-amd64` self-hosted share on gw-ms-a2; the rest is already on GitHub-hosted `ubuntu-latest` (publish 463, mirror-sync 93, lighthouse 34, deploy-railway 25 min/mo — the credential-bearing jobs hold the prod Railway + npm tokens) plus one tiny Mac-mini ARM matrix leg of `quality`. The hot path is `quality` (~11k min/mo), `ci` (~7.2k), and `security-scan` (~1.3k). **Decisive fact: a grep of all 10 workflow files found zero actual Docker usage — no `docker build/run`, no `services:`, no `container:`, no testcontainers.** The `dind=true` host-Docker-socket mount the Codex audit flagged is an inherited runscaler global default that **no caisson job uses** — it is pure host-root liability with zero offsetting benefit. Volume sits far below the ~$3–5K/mo crossover where managed-CI compute starts paying for itself, so this is a **security/separation** decision, not a cost decision.

---

## 2. Fork options

### Option A — Harden-in-place on owned hardware (dind off + per-project isolation)

- **What changes:** Set `dind=false` on the `caisson-amd64` scale set (job containers lose the socket mount → host-root-via-workflow-code path deleted, since nothing needs it). Split runscaler into a **dedicated caisson systemd daemon under its own Unix user** (`gha-caisson`, its own `_work` root, own PAT — PATs are already distinct) so a daemon or job compromise can't cross into gridwork-core/wardfile. Add a **`caisson` runner group** at the `caisson-sh` org (scale-set-name targeting already scopes dispatch). Add cgroup CPU/mem ceilings so 18-container contention on the 32-core box can't let one project starve another. Ephemeral/JIT (one job per `--rm` container) is already correct — keep it. Drop the caisson runner user from the `docker` group entirely once dind is off.
- **Cost:** **$0/mo** marginal.
- **Setup:** **~6–12 hrs** (dind off + verify: 30 min; per-project daemon/user split: 4–8 hrs; runner group + cgroup limits: ~2 hrs; optional turbo remote cache to cut wall-clock: ~2 hrs).
- **Isolation:** Kills the flagged host-root risk outright. Credential + process + filesystem separation per project; **shared kernel remains** (container, not VM). For a private repo with zero external contributors and no public fork path, the research puts residual at the dependency-compromise / persistent-backdoor class — real but reduced, and unaddressed by any option short of VM-per-job.
- **Separation from other projects:** Own daemon + own Unix user + own runner group + cgroup ceiling. Meets requirement (1).
- **Docs:** High burden but already owned (`system/ci/README.md` exists) — bespoke, operator-maintained.

### Option B — Blacksmith (or Ubicloud) for the caisson hot path only

- **What changes:** One-line label swap on the ~8 self-hosted workflow legs (`runs-on: blacksmith-2vcpu-ubuntu-2404`), install the vendor GitHub App. Caisson's amd64 CI **leaves the shared box entirely**; gridwork-core + wardfile stay on gw-ms-a2 untouched. Keep the Mac-mini ARM leg on the Mac mini ($0). Keep publish/deploy/mirror on GitHub-hosted.
- **Cost:** **~$25–50/mo** (Blacksmith 2vCPU: 15,124 − 3,000 free = 12,124 min × $0.004 x64 ≈ $48, or $0.0025 ARM ≈ $30; their claimed ~2× speed likely lands real cost ~$15–30). **Ubicloud is the value pick at ~$12/mo** ($0.001/min, open-source KVM) — its Linux-only limitation is a non-issue because the Mac leg stays on the Mac mini regardless.
- **Setup:** **~2–3 hrs** (App install + label swaps + verify).
- **Isolation:** **Best of any option** — Firecracker microVM (Blacksmith) / KVM VM (Ubicloud) per job. Docker-if-ever-needed runs safely inside the throwaway kernel; the dind host-socket pattern is architecturally impossible. Caisson is physically off the shared box → perfect separation from the other two projects.
- **Docs:** Minimal — vendor-documented, drop-in.
- **Kill within this category:** **Depot** (~$212/mo effective — dominated on cost), **Namespace** (opaque "unit-minute" multiplier, not comparable), **Actuated** ($150–275/mo flat to run Firecracker on _your own_ box — you'd pay more than hosted to operate microVM infra yourself), **RunsOn** (needs a dedicated AWS account — adds an ops surface a solo operator doesn't have), **BuildJet** (shut down 2026-03-31). Blacksmith/Ubicloud win on drop-in + free tier + per-min price.

### Option C — Full GitHub-hosted for caisson

- **What changes:** Swap every self-hosted `runs-on` to hosted labels; add a GitHub **Team** plan (~$4/mo, required for the 4-core+ larger runners a 54-pkg monorepo wants for fast feedback); retire the caisson scale set from the box; lean on turbo remote cache to hold minutes down.
- **Cost:** **~$110–250/mo.** Naive floor: (20,315 − 3,000 free 2-core) × $0.006 ≈ $104. Realistic band is higher — 2 hosted cores vs a shared 32-core turbo box **inflates wall-clock minutes 1.5–3×**, and larger-runner minutes get **zero free-quota offset** (billed from second one). Plus per-job minute-rounding overhead on the many short check jobs.
- **Setup:** **~3–5 hrs** (label swaps, Team plan, runner-size tuning, turbo remote cache to survive the 10GB cache ceiling).
- **Isolation:** Maximum (clean ephemeral VM per job, GitHub-operated). Zero ops.
- **Separation:** Total — off the box entirely.
- **Weakness:** Pays $110–250/mo to *not* use hardware the operator owns and explicitly wants to use, for work an order of magnitude below the managed-CI crossover. Also loses the fast local box and re-exposes CI to GitHub's postponed-not-cancelled $0.002/min self-hosted-tax signaling as a moot point (this would be hosted, always billed).

### Option D — Status quo minus the risk (dind off, secrets-jobs stay hosted)

- **What changes:** `dind=false` on caisson's scale set; formalize that publish/deploy-railway/mirror-sync (token-bearing) stay on ephemeral GitHub-hosted so prod credentials never touch the persistent shared box; optionally move security-scan to hosted for the same reason. **No per-project daemon/user split** — caisson keeps sharing the one runscaler daemon + kernel with gridwork-core/wardfile.
- **Cost:** **~$0–5/mo.**
- **Setup:** **~1–2 hrs.**
- **Isolation:** Removes the host-root risk; credential-bearing jobs isolated on hosted VMs. But caisson still shares the runscaler daemon, kernel, and box with the other two projects.
- **Weakness:** **Under-delivers on requirement (1)** — it fixes the dind finding but does not cleanly separate caisson from the other projects on the machine. It's Option A with the separation step omitted.

---

## 3. Recommendation

**Take Option A (harden-in-place), pulling in D's "keep credential-bearing jobs on GitHub-hosted" rule as a component.** Load-bearing reasons:

1. **The flagged risk costs $0 and ~1 hour to delete, because no caisson job uses Docker.** Paying a vendor (B) or GitHub (C) to buy VM-per-job isolation is buying a fix for a problem that `dind=false` eliminates for free — you'd be renting a solution to a risk you can simply remove. Rung one of the ladder: the capability nobody uses gets deleted, not migrated.
2. **The operator owns the machines, prefers using them, and volume is ~252 runner-hrs/mo — roughly 20× below the $3–5K/mo point where managed-CI compute earns its keep.** On stated preferences, spending $12–250/mo to offload work a capable owned box already does well is negative value.
3. **Requirement (1) — clean separation — is achievable on-box and proportionate for a solo private repo:** dedicated runscaler daemon + Unix user + runner group + cgroup ceiling gives credential, process, and filesystem separation. Shared-kernel is the only residual, and for a repo with zero external contributors the research is consistent that the kernel-boundary threat (dependency compromise, persistent backdoor) is real but _reduced_ and _not_ something the other options meaningfully close beyond what VM-per-job would — which is a want, not a need, here.

**What flips this to Option B (Blacksmith/Ubicloud):**

- **A caisson job genuinely needs Docker-in-Docker** — the `ci.yml:135` testcontainers-compliance-matrix hint becomes real. Then either add Sysbox/rootless on-box (~8 hrs, bespoke) or flip to B, where Firecracker/KVM gives safe per-job Docker for ~$12–50/mo with zero isolation engineering. At that point B is clearly cheaper than building it.
- **The 32-core box becomes a contention bottleneck** (18 max concurrent containers already contend across three projects; merge-day bursts hit 359 runs/day). B moves caisson's hot path off the box for ~$12–50/mo and is a 2–3 hr label swap.
- **The operator decides zero-ops + hard VM isolation is worth ~$12–50/mo** over maintaining bespoke on-box separation docs. That's a legitimate buy-vs-build call, and B is the honest close second — Ubicloud at ~$12/mo is the value floor, Blacksmith at ~$25–50/mo the most-proven (Firecracker, SOC 2, GV-backed).

**Kill C** for caisson under current preferences (pays most to use owned hardware least). **Kill D as a standalone** (doesn't meet the separation requirement) — its credential-isolation rule folds into A. **Kill Actuated / ARC-on-k8s / Depot / Namespace / RunsOn** per the Option B discussion (dominated on cost, ops burden, or drop-in-ness for a solo operator).

---

# Appendix: raw usage profile

## CI Profile — Caisson (`caisson-sh/caisson`) on gw-ms-a2

### 1. runscaler identity + isolation model

- **Upstream:** `ysya/runscaler` (Go, MIT, github.com/ysya/runscaler) — "auto-scale GitHub Actions self-hosted runners as ephemeral Docker containers or macOS VMs, no Kubernetes." Installed binary reports `runner version 0.2.27`.
- **Mechanism:** one `runscaler` systemd daemon (`/etc/systemd/system/runscaler.service`, user `gha-runner`, in the `docker` group) long-polls the GitHub Actions scale-set API for each `[[scaleset]]` block and spins a `docker run --rm` container per queued job (JIT runner config minted host-side, PAT never passed into the job container). Each container handles exactly **one job**, then is destroyed — no persistent state between jobs.
- **Config file:** `/etc/gridwork/runscaler.toml` — one daemon, **three scale sets sharing the same host, same Docker image, same PAT**:

| scaleset              | repo                       | max-runners |
| --------------------- | -------------------------- | ----------- |
| `gridwork-core-amd64` | GridWork-dev/gridwork-core | 8           |
| `caisson-amd64`       | caisson-sh/caisson         | 6           |
| `wardfile-amd64`      | GridWork-dev/wardfile      | 4           |

All three pull `127.0.0.1:5000/gw-gha-runner:amd64` from the same local registry and run under the same `docker.service`/`docker.sock` on gw-ms-a2 — 18 max concurrent ephemeral containers total contending for one 32-core/31GB box. There is no per-project network namespace, cgroup ceiling, or credential boundary between the three scale sets beyond "different GitHub tokens, same daemon, same Docker socket."

- **`[docker] dind=true`:** global default (inherited by all three scale sets — this is runscaler's own `config.example.toml` default value, not something caisson opted into). Per upstream docs this is the "optional DinD support for workflows that build containers" flag; it is what gives ephemeral job containers Docker-in-Docker capability against the host — the mechanism Codex flagged as host-root-adjacent risk.

### 2. Monthly runner-minute estimate

7-day authoritative per-workflow run counts (GitHub API `total_count`, `created:>=7 days ago`):

| workflow         | runs/7d | runs/day | runs-on                                                                                                    |
| ---------------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `ci`             | 390     | 55.7     | caisson-amd64 ×3 jobs + ubuntu-latest ×1                                                                   |
| `quality`        | 390     | 55.7     | caisson-amd64 ×6 jobs, ubuntu-latest ×1 (oscal), `[self-hosted, gw-macos-arm64]` ×1 (matrix leg, Mac mini) |
| `publish`        | 183     | 26.1     | ubuntu-latest (hosted)                                                                                     |
| `deploy-railway` | 89      | 12.7     | ubuntu-latest (hosted — holds prod Railway token)                                                          |
| `mirror-sync`    | 52      | 7.4      | ubuntu-latest (hosted)                                                                                     |
| `security-scan`  | 50      | 7.1      | caisson-amd64 ×2 jobs (both self-hosted)                                                                   |
| `support-bot`    | 29      | 4.1      | caisson-amd64 (self-hosted)                                                                                |
| `lighthouse-ci`  | 3       | 0.4      | ubuntu-latest (hosted)                                                                                     |
| `aeo-probe`      | 0       | —        | caisson-amd64 (self-hosted, dormant this window)                                                           |
| `release-train`  | 0       | —        | ubuntu-latest (hosted, dormant this window)                                                                |

Total: **1186 runs/7d ≈ 169 runs/day** steady-state. Daily volume is bursty, not flat — observed range over the trailing 10 calendar days: **49 to 359 runs/day** (driven by PR/merge-wave cadence, e.g. 2026-07-08 and 2026-07-10 were multi-PR merge days; 2026-07-09 was quiet).

Job-duration sample (jobs API, `started_at`→`completed_at`, ~15 completed runs per workflow):

| workflow         | jobs sampled | min | avg  | p90  | max  |
| ---------------- | ------------ | --- | ---- | ---- | ---- |
| `security-scan`  | 30           | 11s | 182s | 488s | 650s |
| `ci`             | 60           | 3s  | 65s  | 159s | 267s |
| `quality`        | 109          | ~0s | 55s  | 65s  | 360s |
| `lighthouse-ci`  | 3            | 95s | 156s | 262s | 262s |
| `publish`        | 15           | 28s | 36s  | 45s  | 51s  |
| `support-bot`    | 10           | 11s | 50s  | 52s  | 103s |
| `mirror-sync`    | 14           | 21s | 27s  | 38s  | 40s  |
| `deploy-railway` | 15           | 2s  | 4s   | 6s   | 6s   |

Avg total job-seconds per run (all jobs in that run summed): ci 259.5s, quality 397.5s, security-scan 364s, support-bot 50.2s, publish 35.5s, mirror-sync 25.2s, deploy-railway 3.9s, lighthouse-ci 156s/run.

**Combined runner-minutes/month (avg-job-seconds/run × runs/day × 30, all runner types):**

| workflow       | min/mo                                    |
| -------------- | ----------------------------------------- |
| quality        | 11,076                                    |
| ci             | 7,229                                     |
| security-scan  | 1,292                                     |
| publish        | 463                                       |
| support-bot    | 103                                       |
| mirror-sync    | 93                                        |
| lighthouse-ci  | 34                                        |
| deploy-railway | 25                                        |
| **total**      | **≈ 20,315 min/mo ≈ 339 runner-hours/mo** |

**gw-ms-a2 (`caisson-amd64` scale set) share specifically** — excluding hosted (`ubuntu-latest`) and the Mac-mini matrix leg, using per-job-count share for the mixed workflows (ci: 3 of 4 job legs self-hosted; quality: 6 of 8 job legs self-hosted): ci ≈ 5,422 min/mo, quality ≈ 8,307 min/mo, security-scan 1,292 min/mo (100% self-hosted), support-bot 103 min/mo (100% self-hosted) → **≈ 15,124 min/mo ≈ 252 runner-hours/mo on the shared `caisson-amd64` scale set** (approximate — job-count share, not exact per-job runner attribution).

### 3. Docker-needing jobs

Grepped all 10 workflow files (`ci.yml`, `quality.yml`, `security-scan.yml`, `deploy-railway.yml`, `lighthouse.yml`, `mirror-sync.yml`, `publish.yml`, `support-bot.yml`, `aeo-probe.yml`, `release-train.yml`) for `docker build|run|push|compose`, `services:`, `container:`, `docker/build-push-action`, `docker/setup-*`, `buildx`, `testcontainers`, `/var/run/docker.sock`.

**Zero matches of actual Docker usage inside any job step.** The only hits are comments/references, not invocations:

- `ci.yml:8` — explicit comment: the `test` job runs on a "stock runner (no Docker, no external service)" — PGlite (in-process Postgres) replaces a Docker Postgres service.
- `ci.yml:135` — comment noting "testcontainers matrices land here once the compliance [...]" — speculative/future, not present.
- `deploy-railway.yml:3` — `RAILWAY_DOCKERFILE_PATH` triggers a Docker build **on Railway's infrastructure**, not inside the GHA job (the hosted job just calls Railway's API/CLI).
- `security-scan.yml:28` — trivy/osv-scanner/trufflehog do a static "Dockerfile digest gate (advisory)" — inspect a Dockerfile, don't build/run one.

No caisson workflow currently requires the runscaler daemon's `dind=true` capability — it's a shared-config default inherited from the same `/etc/gridwork/runscaler.toml` that also serves gridwork-core and wardfile, not something any caisson job opts into or uses.

---

Files read: `/etc/gridwork/runscaler.toml`, `/etc/systemd/system/runscaler.service` (via `systemctl cat runscaler`), `~/lab/gridwork-core/system/ci/README.md`, `~/lab/caisson/.github/workflows/*.yml` (all 10). Raw run/job data pulled via `gh api repos/caisson-sh/caisson/actions/{runs,workflows}` and cached at `/tmp/claude-1000/-home-gw-lab-caisson/9b6b9cfb-9653-4aca-9158-ea5a37cbd62f/scratchpad/{runs_ids.json,job_durations.jsonl,durs.tsv}`.
