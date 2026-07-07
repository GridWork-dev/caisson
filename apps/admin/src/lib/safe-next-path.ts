// The `?next=` redirect-target guard for the login page (ADR-0283, security-audit hardening).
// Root-relative only, and never carrying a backslash: some browsers normalize a leading
// `/\evil.example` (or `\/evil.example`) into a scheme-relative `//evil.example` before
// navigating, which `!next.startsWith("//")` alone doesn't catch since the STRING itself starts
// with a single `/`. `^\/(?!\/)` pins "exactly one leading slash, not two"; the backslash check
// closes the browser-normalization side door on top of that.
export function safeNextPath(next: string | undefined): string {
  if (next === undefined) return "/";
  if (!/^\/(?!\/)/.test(next)) return "/";
  if (next.includes("\\")) return "/";
  return next;
}
