// The browser-safe entry (`@caisson-sh/agent-runner/browser`, ADR-0396): the provider profile model
// and the env scrub, i.e. everything a client can meaningfully exercise about this package.
// ADDITIVE — the `.` barrel is untouched and stays the full node-capable surface; every name here
// is also on `.` (the subset test in browser-safety.test.ts pins that direction).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry:
//   - agent-runner.ts — the spawn + run-registry machinery (node:child_process, node:fs,
//     node:path). Irreducibly node-only: a browser cannot detach a subprocess or hold a run
//     registry on disk.
//   - trajectory.ts — node:crypto `createHash` over the transcript. Its digests are the audit
//     record's spine, so this is not a WebCrypto swap: the hash is synchronous by contract and
//     WebCrypto's `subtle.digest` is async.
export * from "./engine-env.ts";
