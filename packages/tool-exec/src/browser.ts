// The browser-safe entry (`@caisson-sh/tool-exec/browser`, ADR-0396): the default-deny allowlist
// lookup + the Zod argv validation, i.e. the whole phase-1 gate. ADDITIVE — the `.` barrel is
// untouched and stays the full node-capable surface; every name here is also on `.` (the subset
// test in browser-safety.test.ts pins that direction).
//
// DELIBERATELY EXCLUDED, so the next reader does not "complete" this entry: tool-exec.ts —
// `createToolExec` and its `execFile` spawn seam (node:child_process). Irreducibly node-only, and
// nothing is lost: a browser has no process to spawn, and the gate that decides whether a call is
// even permitted is entirely here.
export * from "./propose.ts";
