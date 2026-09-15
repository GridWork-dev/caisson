---
phase: publish-scan-disk-2026-09
tags: [security, infra]
tier: STANDARD
---

# S8 image-scan disk repair

S8_PUBLISH_RED assigns R324's remaining scan-runner repair to this lane. At main 6604844a, all six gates passed; license/docs/migrate exhausted disk while Trivy exported images from Docker. Site/admin/demos passed. This repair must make six branch build/scan jobs finish successfully, with image sizes and runner disk measurements. Main publication remains the operator's path; task 3 still requires six scan passes on main.

Preserve the shared publish-image template and its record-only image-CVE policy. Use the repository-owned prepare-build hook to free unused SDKs on disposable GitHub Linux runners and select Trivy's remote image source via GITHUB_ENV. No local workstation cleanup: require GitHub Actions, Linux and runner-temp/env files. No credentials, registry settings, signatures, Dockerfiles or package semantics change in this PR. R333 OS patching and schedule disposition are separate work.

Acceptance: six branch images build and scan with actual disk/size evidence; full required CI green; no transport failure hidden as a scan pass. Negative fixtures prove non-CI safety and failure propagation. Branch proof carries no cloud auth, registry publish or deployment. Hold PR at green; report S8_SCAN_FIX_PR. Peer review dispatches were refused and never ran; no retry or implicit peer pass.
