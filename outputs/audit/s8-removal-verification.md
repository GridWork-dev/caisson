# S8 diagnostic removal verification — R324

## R378 fresh candidate proof — 2026-09-16

Candidate c9250e861117c6c05b06002835a76cfb9bde60e2: all five proof items pass.
Exact eight-file hashes, four marker UUIDs, five identifiers, ancestry and changeset
accounting: [s8-r378-absence.json](s8-r378-absence.json). Fresh Bun 1.4.2 tests
64/0/168, build and six-file lint pass. Source/emitted artifacts match the historical
removal hashes below. Only the two approval/egress repair changesets differ from main.
The R373 code/security reviews later ran and passed with stated limits; the older
never-ran statement below is historical. Final candidate CI remains a separate PR gate.

Removal merge: `0b2046e722750a732ad23aa6f9d9ff230fbd2d5d` (#479, forge-verified 2026-09-14T17:50:51Z). Verified candidate: `bb99e27ee809f9b764cac6ef1632a4de9de8e196`, with removal `0b2046e722750a732ad23aa6f9d9ff230fbd2d5d` as its second parent; ancestry check exited zero. Subsequent receipt-only commits do not change these measured source files.

1. **Source:** all four fixed UUID markers, `[s8-direct-key]`, `[s8-direct-ip]`, `s8ProbeDeadline`, `s8ProbeMarkers` and `observeKey` absent from the three named implementation paths.
2. **Emitted artifacts:** successful `packages/rate-limit` build; inspected `dist/token-bucket.js` and `dist/token-bucket.d.ts`. JS `check(bucket, ip)` directly charges `${bucket}|${ip}` with the original per-IP configuration; declarations expose only `check(bucket: B, ip: string): RateDecision`. No observer. Existing X-Real-IP/unknown and global ceiling contract retained. The marker scan is empty in both artifacts.
3. **Changesets/tests:** all of `.changeset` and six diagnostic source/test paths match removal main exactly (`git diff --cached origin/main -- ...` empty). Original diagnostic entry absent; empty removal entry remains; unrelated entries intact. Diagnostic-only tests removed.
4. **Gates:** reconciled lane three suites freshly passed 64 tests, zero failures, 168 assertions; six-file oxlint exited zero. All six required CI checks passed on actual removal SHA (check, standards-gate, registry-index, oscal-conformance, deterministic, support-bot), independently read from forge. Lane PR CI must still run on its eventual head; this is not a full lane-CI claim. R324 disposes known image-publish failures as a separate pipeline repair, not an implicit pass.
5. **Accounted differences:** staged three implementation files exactly equal pre-diagnostic e2116849 (`git diff --cached e2116849 -- ...` empty). No later product differences to explain or overwrite. The reconciled candidate retains all later main work and all 22 unique lane-history commits. Only the diagnostic seven-path delta is removed from the lane, preserving its SPEC/PLAN/audit documents.

## Artifact hashes

- `apps/site/lib/ask-ai/handler.ts`: SHA-256 `1359c935a4558a928f4e5810e7b02e59ac1fb983820e0749dbfdac61295e9099`
- `packages/rate-limit/src/token-bucket.ts`: SHA-256 `3e5f9606f3cc1c7d912724ea25ee11d0abb0356c9499a8674b6f5751bce97795`
- `services/license/src/app.ts`: SHA-256 `97a2aae5cd981b8995e2bd945b6dc19b521ce10a7a451a83c92fa3ecebf99709`
- `packages/rate-limit/dist/token-bucket.js`: SHA-256 `9102ea692227822125ab132391536f4531eca0ec170e134a6ef8bc66d2092b7c`
- `packages/rate-limit/dist/token-bucket.d.ts`: SHA-256 `e871e8461f1547f7c9e45f0b87c1e94246bdcfdb87bd4c0048a7645fd7b814d6`

This establishes diagnostic absence from this measured source and emitted limiter artifact. Before a release cut, re-bind the actual final candidate SHA and its artifacts/CI; no package has been published. License runtime cleanup remains pending S8_LICENSE_CLEAN under R325; cockpit owns deployment. Independent peer reviews never ran under the recorded admission disposition.
