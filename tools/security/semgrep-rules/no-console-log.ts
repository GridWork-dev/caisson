// Fixture for the no-console-log rule. `semgrep test tools/security/semgrep-rules/`
// checks the ruleid/ok annotations below. This file is excluded from real scans via
// .semgrepignore (it contains deliberately-flagged code).

export function bad(): void {
  // ruleid: no-console-log
  console.log("leaks to stdout");
  // ruleid: no-console-log
  console.debug("also forbidden");
  // ruleid: no-console-log
  console.info("and this");
}

export function good(): void {
  // ok: no-console-log
  process.stderr.write("sanctioned log sink\n");
  // ok: no-console-log
  console.error("errors are allowed");
  // ok: no-console-log
  console.warn("warnings are allowed");
}
