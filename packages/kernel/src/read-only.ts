// src/read-only.ts — the read-only-mode mutation gate (ADR-0229 row 54). A single fail-closed guard
// every mutation entrypoint calls FIRST, before touching the DB, so a maintenance window / dunning
// freeze / admin toggle can stop writes at the boundary — mirroring caisson's fail-closed-RLS ethos
// (deny by construction, never by a check someone forgot). Reuses ConflictError (409): a mutation
// attempted while the system is read-only is a conflict with system state, not a new error class.
import { ConflictError } from "./errors.ts";

/** The two system write-modes. `read_only` freezes every mutation the gate guards; `active` is open. */
export type SystemMode = "active" | "read_only";

/**
 * Throw {@link ConflictError} (409) when `mode` is `read_only`; a no-op when `active`. Call at the TOP
 * of a mutation entrypoint, BEFORE any write — the `mode` source (a maintenance flag, a dunning state,
 * an admin toggle) is the caller's to supply; this is only the gate. `action` (e.g. `"grant credits"`)
 * is echoed into the error message and `details.action` so the client learns WHICH mutation was
 * refused, never leaking anything else.
 *
 * ponytail: no live read-only mode source is wired yet (dunning #53 is unbuilt). Ships as the tested
 * primitive; call it at the admin-write / billing-mutation boundary once a mode source exists — do not
 * fabricate a caller.
 */
export function assertNotReadOnly(mode: SystemMode, action?: string): void {
  if (mode === "read_only") {
    throw new ConflictError(
      action !== undefined
        ? `Refusing to ${action}: system is in read-only mode`
        : "System is in read-only mode",
      action !== undefined ? { action } : undefined,
    );
  }
}
