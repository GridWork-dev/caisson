# Supply-chain scanner recon — Sentrik (competitor intel) + Socket/bun/Railway check

- **Date:** 2026-07-13 · **Kickoff:** T (tasks 3 + 4) · **Session:** platform wave
- **Status of the live Sentrik scan:** NOT RUN by the agent session — the permission classifier
  (correctly) blocked agent-executed installation of an unaudited early-access PyPI package.
  The one-shot scan is a 20-minute operator act; commands below. Everything else in this note is
  from Sentrik's own published docs/site, cited.

## Sentrik — what it is

- Product: "the compliance layer for AI-generated code" (sentrik.dev / docs.sentrik.dev),
  Early Access stage, co-founded by Max Gerhardson (PyPI maintainer) + Scott Nelson (per his
  LinkedIn). No incorporation/funding record surfaced; no published paid-tier pricing
  (contact-gated).
- Mechanics: local-first CLI (`pip install sentrik` / `npm i -g sentrik`), `sentrik scan` in a
  repo = one-shot zero-config scan writing findings to `out/`; also a VS Code/Cursor extension,
  GitHub Action, GitLab/Azure support, and an MCP server for coding agents.
- Free-forever tier: 6 standards packs, 193 rules, no license key. Paid tiers add HIPAA/PCI-DSS/
  ISO-27001/MISRA-C/DO-178C packs + "agent governance" (task-scope binding, anomaly detection,
  signed attestations).
- The relevant pack: **Supply Chain Security** — its own docs page says **20 rules** (16
  code-enforcement + 4 documentation obligations), based on SLSA, NIST SSDF, and CISA guidance.
  Note: Sentrik's docs self-contradict on the count elsewhere (20 vs 26) — treat neither as
  authoritative until the operator scan enumerates them.

## Checklist diff vs `tools/security/` (from documented rule categories)

Caisson's deterministic layer (semgrep floor rules + p/security-audit, trivy, osv-scanner,
trufflehog, ruff-bandit, Dockerfile digest gate, CAISSON-95 pinned installs, zizmor as of this
wave) covers the SAST/SCA/secrets/workflow surface. What Sentrik's supply-chain pack frames that
caisson's stack does NOT currently express as first-class checks:

1. **Documentation obligations as rules** (4 of its 20) — e.g. provenance/SBOM statements as
   auditable artifacts. Caisson analog: the evidence-pack/build-evidence story (ADR-0275) covers
   more ground but isn't framed as per-rule checklist output a buyer can tick.
2. **SLSA-framing** — caisson pins + verifies (CAISSON-95) but publishes no SLSA level claim or
   provenance attestation for its own artifacts. (zizmor research also flagged: our release
   consumption now verifies digests, while our own releases don't attest.)
3. **Agent governance** (paid tier) — task-scope binding + signed attestations for AI-written
   code. Caisson's classifier/permission-mode + in-session SHIP audits are stronger operationally
   but invisible as product surface. This is POSITIONING intel, not a gap in our controls:
   Sentrik sells the _visibility layer_; caisson sells the _infrastructure_ — the compliance
   crosswalk + evidence packs could absorb the "checklist visibility" idea cheaply.

**Verdict:** no control gap demanding immediate work; one idea worth stealing later (checklist-
shaped rendering of controls we already run — natural fit for the crosswalk rollup's
binding-table artifact, see outputs/plans/compliance-crosswalk/PLAN.md task on the derived
binding table). Never CI-wire Sentrik (kickoff constraint; early-access vendor, unaudited).

## Operator one-shot (20 min, when desired)

```bash
cd "$(mktemp -d)" && git clone --depth 1 file:///home/gw/lab/caisson caisson-scan
uv venv v && ./v/bin/pip install sentrik && cd caisson-scan && ../v/bin/sentrik scan
# findings land in out/ — diff the supply-chain pack's rule list against tools/security/
```

## Socket / bun #31028 / Railway (task 4 — the coverage-claim check)

- **bun #31028 is OPEN** (created 2026-05-19, no fix merged as of 2026-07-13; contested fix PR
  #31031): `bun install --production` with a bunfig `[install.security]` scanner configured as a
  devDependency hard-fails ("no packages were installed during security scanner installation").
  Affects every released bun through 1.3.14.
- **Railway ground truth:** all five service Dockerfiles run `bun install --frozen-lockfile`
  WITHOUT `--production` (services/docs, intel, license, apps/admin, apps/site; support-bot is
  uv/Python) — so the bug would not bite today's builds, but a scanner in the deploy path adds a
  Socket-API network dependency to every Railway build and the `--production` hazard is one
  Dockerfile optimization away.
- **Decision (recorded in ADR-0341):** no repo-level bunfig scanner now. `minimumReleaseAge`
  (landed this wave) covers the freshness-attack window; Socket-in-CI is re-evaluated once
  #31028 is fixed in a released bun — and if adopted, in a PR-check job, never the deploy path.
  Dev-machine global-bunfig Socket remains the gw-core kickoff's lane, not this repo's.
