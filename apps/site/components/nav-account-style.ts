import type { CSSProperties } from "react";

// The shared nav-account pill style, in its own module so the shell (`nav-account`) and its
// idle-loaded live half (`nav-account-live`) can both import it without importing each other —
// the shell dynamic-imports the live half, so a style import back at the shell was a cycle
// (standards-gate no-circular).
export const NAV_PILL_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "2.25rem",
  minWidth: "4.5rem",
  padding: "0 var(--cs-space-3)",
  borderRadius: "var(--cs-radius-md)",
  border: "1px solid var(--cs-border)",
  color: "var(--cs-fg)",
  fontSize: "var(--cs-text-sm)",
};
