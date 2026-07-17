import type { DemoRunUnavailableReason } from "./types";

// Pure client-side input gates for the demo-run form. These are UX-only fast feedback — the server's
// Zod .strict() + the CLI ProjectName rules are the authoritative gate (T1). Kept out of the "use
// client" component so they're testable without a render harness.

// Mirrors the CLI's ProjectName shape (lowercase, digits, internal hyphens, 1-40 chars).
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidDemoProject(name: string): boolean {
  return SLUG_RE.test(name.trim());
}

export function isValidEmail(email: string): boolean {
  const v = email.trim();
  return v.length <= 254 && EMAIL_RE.test(v);
}

/** Narrow the `503 { reason }` discriminator; anything unrecognized is NOT a valid reason. */
export function isUnavailableReason(v: unknown): v is DemoRunUnavailableReason {
  return v === "daily-cap" || v === "disabled";
}
