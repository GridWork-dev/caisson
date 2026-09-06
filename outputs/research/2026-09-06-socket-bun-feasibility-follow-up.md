# Socket install gate — deferred feasibility follow-up

Decision: estate S3 T36, Round 21 R105, 2026-09-06. The operator selected F05=A: defer the Socket gate and record this follow-up. No Socket install gate was added, and no install-time blocking coverage is claimed.

The 2026-09-05 inspection did not establish a supported Bun invocation, authenticated release/checksum procedure, fail-closed error contract, the PLAN's `socket-npm-sink-test` fixture, or a stable scanned-count schema. A binary installed only in a SAST job would leave dependency installation in other jobs outside the gate. These are evidence gaps, not claims that the vendor can never support Bun.

Before proposing adoption, a separate bounded feasibility task must deliver:

1. A pinned release and verified integrity procedure, with licensing and access requirements recorded from current primary sources.
2. A supported invocation against the repository's pinned Bun version, retaining Bun as its package manager.
3. An inert, documented fixture that the tool blocks, plus a clean fixture that it accepts; missing binary, network failure, malformed output and internal failure must all discriminate from a passing scan.
4. A validated scanned-package count or equivalent coverage contract with a nonzero fixture floor and an omitted-package mutation.
5. An inventory of every intended installation path, with explicit evidence that the gate runs before installation on each covered path. CI and deployment scope require a separate decision; a check-job binary installation alone is insufficient.
6. A concrete proposed diff, rollback and operating-cost impact for operator review. Deferral does not authorize installation or fleet propagation.

Existing known-vulnerability checks keep their current scope. This disposition is consistent with the earlier scanner deferral recorded in [the July supply-chain recon](sentrik-socket-supply-chain-recon.md), which cites ADR-0341; it does not reopen that decision or claim that its version-specific observations remain current.

Primary sources inspected for the estate attempt: [vendor repository](https://github.com/SocketDev/sfw-free), [reported internal-error exit behavior](https://github.com/SocketDev/sfw-free/issues/61), [report-schema discussion](https://github.com/SocketDev/sfw-free/issues/47), [release artifacts](https://github.com/SocketDev/firewall-release/releases). Recheck these at the feasibility sitting.
