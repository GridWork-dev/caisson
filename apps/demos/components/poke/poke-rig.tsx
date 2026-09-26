"use client";

// The shared rig under every interactive "poke" slide (ADR-0378 lock 2). A poke is the one slide
// kind that genuinely owns interactive state, so the shell deliberately does NOT pass `decorative`
// to <MediaFrame> (that prop collapses the frame to role="img" + aria-hidden internals, correct for
// static schematics only). `data-poke` marks the subtree so the carousel's arrow-key handler yields
// keyboard events to the poke instead of swallowing them as slide navigation.
import type { ReactNode } from "react";

import { MediaFrame } from "../media-frame";

import styles from "./poke-rig.module.css";

/** The client-side guarantee, stated out loud on every poke (ADR-0378 lock 2). */
const TRUST_LINE = "Runs entirely in your browser. Nothing leaves this page.";

export function PokeShell({
  label,
  title,
  children,
}: {
  /** MediaFrame chrome-bar label (the package name, e.g. "@caisson-sh/field-crypto"). */
  label: string;
  /** One-line poke title in the imperative register (e.g. "Seal a value as one tenant."). */
  title: string;
  children: ReactNode;
}) {
  return (
    <MediaFrame label={label}>
      <div className={styles.shell} data-poke="">
        <p className={styles.title}>{title}</p>
        {children}
        <p className={styles.trust}>{TRUST_LINE}</p>
      </div>
    </MediaFrame>
  );
}

export type VerdictState = "ok" | "fail" | "neutral";

/** The verdict line: a computed outcome, never asserted copy. */
export function Verdict({
  state,
  children,
}: {
  state: VerdictState;
  children: ReactNode;
}) {
  return (
    <p
      className={styles.verdict}
      data-state={state}
      role="status"
      aria-live="polite"
    >
      <span className={styles.verdictDot} aria-hidden="true" />
      {children}
    </p>
  );
}
