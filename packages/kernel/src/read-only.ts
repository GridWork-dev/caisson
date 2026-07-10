// src/read-only.ts — the read-only-mode mutation gate. A single fail-closed guard every mutation
// entrypoint calls FIRST, before touching the DB, so a maintenance window / admin toggle can stop
// writes at the boundary — mirroring caisson's fail-closed-RLS ethos (deny by construction, never
// by a check someone forgot). Reuses ConflictError (409): a mutation attempted while the system is
// read-only is a conflict with system state, not a new error class.
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
 * The live mode source is the admin service's operator lever (an admin maintenance/incident
 * switch): its mutation surface reads the persisted mode and calls this gate first. The mode is
 * deliberately never derived from billing/dunning state — past-due subscriptions keep full access.
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
