# Codex read-only host + CI audit — 2026-07-11

Operator-run Codex (GPT-5.6) read-only audit spanning the caisson repo, the gridwork-core
governance surface, and the gw-ms-a2 host. Nothing was changed by the audit. Pasted verbatim
below the verification section.

## In-session verification (2026-07-11, this repo/host)

Checked before filing — every claim below was CONFIRMED unless noted:

- **dind=true** at `/etc/gridwork/runscaler.toml:6`; runscaler also listens on `*:8080`
  (undocumented vs `daemons.md` "no listening port"). CONFIRMED.
- **publish.yml provenance ordering** — `changeset version` at ~line 95, R2 upload stamped
  `--sha ${{ github.sha }}` (pre-version SHA) at ~106-125, `git commit/push` last at ~158-160.
  CONFIRMED → locked as **ADR-0325**, build item **CAISSON-94**.
- **security-scan.yml** non-blocking by design (header comment) with unpinned installers
  (`curl | sh` uv/trivy/trufflehog, unversioned `uv tool install`, OSV `releases/latest`).
  CONFIRMED → **CAISSON-95** (pinning); the required-check flip is an OPEN fork on the board.
- **Bare `pull_request:`** (no types, drafts run CI) on ci/quality/security-scan/support-bot.
  CONFIRMED → **CAISSON-96**.
- **build-state.md stale** (claimed ceiling 0297 / PRs #186; truth 0325 / #209). CONFIRMED,
  fixed in the same commit as this file.
- **Swap**: 12Gi used at re-check (audit snapshot saw ~23Gi) — real but not acute; trend item.
- **1Password contradiction**: real, and the STALE side is the gridwork-core global "no
  1Password" wording — caisson's ADR-0317 locked the vault as primary secret SoT. gridwork-core
  side rides the operator's hardening session.

## Routing (operator picker, 2026-07-11)

- **Release provenance** → LOCKED recommended: version PR → green CI → tag → publish exactly the
  tagged bytes (**ADR-0325**, CAISSON-94).
- **CI runner boundary (dind)** → NOT locked; operator sent it to research (hosted vs the two
  owned machines vs runner services; caisson CI must be separated from other projects, documented,
  optimized). Research workflow `wf_d37f7fe0-aaa`; second fork round follows the memo.
- **Host service isolation / env-mirror breadth / gridwork-core doc drift** → routed to a
  dedicated gridwork-core session the operator runs (prompt handed off in-session); only
  caisson-specific separation/hardening stays in this repo.
- **Not yet decided (board Open rows):** security-scan required-check flip · GitHub Environments
  for publish/release jobs · inventory drift-control mechanism (audit fork 4) · runscaler
  health-port exposure.

---

## Verbatim audit

## Read-only audit verdict

The overall architecture is unusually disciplined, but two pre-launch issues should be treated as blockers:

1. **Critical CI isolation break:** the Linux self-hosted runner containers receive the host Docker socket because `[docker] dind = true` in `/etc/gridwork/runscaler.toml:5`. Any workflow code can ask Docker to mount `/home/gw` or `/etc/gridwork`, bypassing the documented "operator secrets are never mounted" boundary. Upstream confirms `dind=true` bind-mounts `/var/run/docker.sock` read-write. GitHub warns (docs.github.com/en/actions/reference/security/secure-use) that even ephemeral self-hosted runners remain dangerous for untrusted workflow code; the socket makes this effectively host-root access.

2. **Release provenance mismatch:** `release-train.yml:18` starts from a published GitHub Release, but `publish.yml:90` subsequently runs `changeset version`, packs/uploads the mutated packages, records the earlier `${{ github.sha }}`, and only then commits the version changes. The release tag, `gateAttestation`, CI evidence, shipped tarball, and final source commit can therefore represent different source states. Upload also precedes the commit, leaving a partial-release window if rebase/push fails.

The release train is still dormant and Caisson is pre-launch, so this is excellent timing to correct both without migration fallout.

## What is working well

- Caisson's ten current workflows have good fundamentals: SHA-pinned actions, minimal default permissions, concurrency guards, hosted runners for production credentials, deterministic registry reconstruction, OSCAL conformance, cross-platform native-extension tests, evidence packs, security scans, and release readiness.
- The stack is coherent: Bun/Turbo/TypeScript/Zod across a 54-package productized monorepo, Next/React for web, Drizzle/Postgres for state, and a bounded Python/uv lane for support automation. The catalog-managed dependency spine is a strong choice.
- The GridWork harness has a meaningful capability model rather than a pile of agents: Claude Code and Codex are interactive governed orchestrators; PAL→OpenRouter is a model-call lane; GLM is an external agent-engine lane; the exec bridge owns audited operational shell classes; Graphify/LSP/`rg` separate structural, symbolic, and textual retrieval; Exa/crawl4ai separate discovery from scraping. This aligns well with the official governance primitives exposed by Codex hooks, Codex permissions, Claude Code hooks, and MCP authorization guidance.
- Host networking is mostly sound: UFW is active, incoming and routed traffic default-denied, and only `tailscale0` plus Tailscale UDP traversal are allowed. Most operational services bind loopback or the tailnet address.
- Caisson has already split OpenRouter into six per-service keys, which is better failure attribution and rotation posture than GridWork Core's older "one credential" wording. See `docs/state/providers.md:33`.

## Findings by priority

### Critical

- **Docker socket invalidates CI isolation.** The security ledger says ephemeral containers cannot reach host secrets (`gridwork-core identity/security-surfaces.md:518`), but `dind=true` gives jobs control of the host daemon. Container deletion after the job does not repair this boundary.
- **Release artifacts are not commit-addressable.** The version bump must happen before the immutable tag/release, not after it.
- **R2 publication is not atomic with source truth.** `aws s3 sync` occurs before the registry/version commit. A failed push can leave externally stored tarballs without the corresponding committed ledger, and reruns can overwrite version-keyed objects.

### High

- **Security scanning is explicitly non-blocking.** `security-scan.yml:2` says findings never block merges. For a compliance-infrastructure product, the deterministic Semgrep/Trivy/OSV/TruffleHog floor should become required; Semgrep Pro can remain advisory.
- **The scanner installation layer is not deterministic.** It uses unversioned `uv tool install`, remote `curl | sh`, and OSV's `releases/latest` (`security-scan.yml:40`). The comment calls these "pinned binaries," but several are not pinned.
- **System services lack OS-level blast-radius controls.** `systemd-analyze security` rated the exec bridge, Telegram bridge, events shipper, and cockpit `9.2 UNSAFE`; runscaler scored `7.7 EXPOSED`. Nearly every GridWork service runs as the same `gw` identity with no `ProtectSystem`, `ProtectHome`, `NoNewPrivileges`, syscall filtering, or address-family restriction.
- **The sanitized environment mirror is over-broad.** Events shipper, MCP probe, Exa monitors, and dream jobs receive a full operator-secret mirror. That makes each process a broad credential compromise domain despite application-level egress guards.
- **Governance sources contradict one another.** Global rules say `~/.gridwork/env` is canonical and "no 1Password," while Caisson declares 1Password the primary secret source (`docs/state/providers.md:102`). Agents can follow different secret procedures depending on which surface they read.

### Medium

- **Runscaler has an undocumented listener.** The daemon registry says "no listening port" (`gridwork-core identity/daemons.md:68`), but the live process listens on `*:8080`. UFW prevents public access, but upstream defaults the unauthenticated health endpoint to port 8080. Set `health-port=0` if unused.
- **Generated inventories are stale:** dev-profile says Caisson has eight workflows (now ten); `gridwork-core providers/INDEX.md:5` still declares 69 providers from July 2 and omits newer MCP surfaces; GridWork has 17 MCP manifests while `daemons.md:106` says the probe handles 13; the same document says dream-LLM and memory-GC timers are not installed, but both are enabled under `gridwork.target`; `docs/build-state.md:8` says ADR ceiling 0297 while the current repository is at ADR-0323; Caisson's "single provider roster" omits or underrepresents PostHog, Better Stack, Linear, Cookiy, Semgrep, Renovate, and 1Password.
- **PR events omit the repository's canonical workflow controls.** `pull_request:` uses GitHub defaults, so `ready_for_review` is absent and draft PRs run CI. GridWork's own `identity/ci-patterns.md:46` requires explicit event types and draft suppression.
- **Production jobs have no GitHub Environment.** Publishing a release and setting `RELEASE_TRAIN_ARMED` are already operator gates, but environments would scope secrets and provide an auditable approval boundary. GitHub environments withhold environment secrets until protection rules pass.
- **Host capacity is healthy, but swap deserves telemetry review:** 32 CPUs, approximately 31 GB RAM, 937 GB disk at 16% use, but roughly 23 GB of 31 GB swap was occupied during the snapshot. That can be harmless cold-page retention; trend it before interpreting it as current pressure.

## External-research synthesis

The highest-return outside practices are narrowly targeted:

- Follow GitHub's recommended JIT/ephemeral runner pattern, but do not confuse ephemerality with host isolation. GitHub's self-hosted runner reference explicitly requires a clean environment around each JIT runner.
- Move npm publication toward OIDC trusted publishing (docs.npmjs.com/trusted-publishers/) — removes long-lived npm tokens and automatically creates provenance attestations.
- Generate and verify attestations for R2 artifacts as well as npm packages. GitHub documents a path to SLSA Build Level 3 with reusable workflows.
- Add dependency-review enforcement and SBOM export per GitHub's supply-chain guidance.
- Keep the current multi-tool design where capabilities differ. PostHog/Plausible/Grafana/Better Stack, Playwright/CDP, Exa/crawl4ai, and Graphify/LSP/`rg` are complementary rather than accidental duplication.

## Fork questions

1. **How should the runner boundary be corrected?** (a) Disable `dind`, Docker jobs to hosted (audit rec) · (b) all PR CI to GitHub-hosted · (c) dedicated disposable dind VM. → operator sent to RESEARCH (see routing above).
2. **What should define a release?** (a) Version PR → green CI → immutable tag → publish exact tagged bytes (audit rec) · (b) release-first + second final tag · (c) record both SHAs. → LOCKED (a), ADR-0325.
3. **How far should host service isolation go?** (a) phased capability-scoped users/env groups (audit rec) · (b) systemd hardening only · (c) accept single-user model. → gridwork-core session, operator-run.
4. **How should state drift be controlled?** (a) one generated machine inventory feeding all views + CI freshness (audit rec) · (b) per-doc parity checks · (c) manual sweeps. → OPEN on the board.

No files, services, credentials, workflows, or external systems were changed by the audit.
