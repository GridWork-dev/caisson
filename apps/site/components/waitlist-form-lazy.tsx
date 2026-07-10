"use client";

import dynamic from "next/dynamic";

import { Button } from "./button";
import styles from "./waitlist-form.module.css";

// A4b (ADR-0310): the footer's product-updates form is a below-fold, always-mounted client
// island carrying Turnstile script wiring + multi-field state on EVERY marketing page, for a
// form almost nobody touches at t0. Same in-repo `next/dynamic ssr:false` poster pattern A2's
// `stack-builder-lazy.tsx` uses: the real <UpdatesForm> (waitlist-form.tsx, unchanged) never
// ships in the initial client bundle; the poster below is UpdatesForm's own idle-state resting
// markup (disabled, non-interactive) so swapping it in is a no-op layout-wise — no CLS. Unlike
// StackBuilderLazy this doesn't wait for an idle callback: `ssr:false` alone is enough to drop
// the Turnstile script + form state out of the initial hydration pass, and the footer is already
// the last thing on the page to paint.

const RealUpdatesForm = dynamic(
  () => import("./waitlist-form").then((m) => m.UpdatesForm),
  { ssr: false, loading: () => <UpdatesFormPoster /> },
);

/** UpdatesForm's idle-state resting markup — same wrapper, same email input, same consent row,
 *  same submit copy, so swapping to the hydrated form is a no-op layout-wise. The honeypot input
 *  and the visually-hidden `<label>` in the real component are 0×0 / absolutely-positioned (no
 *  layout contribution) and are safely omitted here. */
function UpdatesFormPoster() {
  return (
    <form
      style={{ display: "flex", gap: "var(--cs-space-2)", flexWrap: "wrap" }}
    >
      <input
        type="email"
        placeholder="you@company.com"
        disabled
        aria-hidden="true"
        tabIndex={-1}
        className={styles.emailInput}
        style={{
          flex: "1 1 16rem",
          padding: "var(--cs-space-3) var(--cs-space-4)",
          borderRadius: "var(--cs-radius-md)",
          border: "1px solid var(--cs-border-strong)",
          background: "var(--cs-surface-1)",
          color: "var(--cs-fg)",
          fontFamily: "var(--cs-font-sans)",
          fontSize: "var(--cs-text-sm)",
        }}
      />
      <label
        style={{
          flexBasis: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--cs-space-2)",
          fontSize: "var(--cs-text-xs)",
        }}
      >
        <input
          type="checkbox"
          disabled
          aria-hidden="true"
          tabIndex={-1}
          style={{ marginTop: "2px" }}
        />
        <span className="cs-muted">
          I agree to receive product update emails. Privacy policy
        </span>
      </label>
      <Button type="button" variant="ghost" disabled>
        Get product updates
      </Button>
      <p
        className="cs-muted"
        style={{
          flexBasis: "100%",
          fontSize: "var(--cs-text-xs)",
          marginTop: "var(--cs-space-1)",
        }}
      >
        Occasional product updates. Unsubscribe anytime.
      </p>
    </form>
  );
}

export function UpdatesFormLazy({ source = "site" }: { source?: string }) {
  return <RealUpdatesForm source={source} />;
}
