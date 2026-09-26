"use client";

import { lazy, Suspense, useEffect, useRef, useState, type JSX } from "react";
import { StatusChip } from "@caisson-sh/ui/components";

import {
  CHAIN_ENTRIES,
  CHAIN_VERIFICATION,
  eventName,
  shortHash,
} from "@/lib/audit-chain-sample";
import { SealBadge } from "@/components/seal-on-proof";
import styles from "./living-chain.module.css";

// Gate + rest frame for the Living Chain (ADR-0334 §4: the motion component loads via dynamic
// import behind in-view + no-reduced-motion — motion (formerly framer-motion) and the commercial
// ChainViewer tree stay in a lazy chunk, never in first-load JS).
//
// The SSR'd rest frame below is the ADR-0334 §6 reduced-motion contract made literal: the FULL
// chain, every hash visible, verdict stamped — no-JS, reduced-motion, and pre-upgrade visitors
// all see the complete evidence, never a blank runway. The motion build is purely additive.

const LivingChain = lazy(() => import("./living-chain"));

function StaticChain(): JSX.Element {
  return (
    <div className={styles.staticChain}>
      {CHAIN_ENTRIES.map((entry, i) => (
        <div key={entry.seq} className={styles.cardSlot}>
          <article
            className={styles.card}
            data-state={i === 0 ? "genesis" : "pending"}
          >
            <div className={styles.cardHead}>
              <span className={styles.seq}>seq {entry.seq}</span>
              <StatusChip
                tone="accent"
                dot
                label={i === 0 ? "genesis" : "linked · sha-256"}
              />
            </div>
            <div className={styles.event}>{eventName(entry)}</div>
            <dl className={styles.hashes}>
              <div>
                <dt>prevHash</dt>
                <dd className={styles.mono}>
                  {entry.prevHash === null ? "null" : shortHash(entry.prevHash)}
                </dd>
              </div>
              <div>
                <dt>hash</dt>
                <dd className={styles.mono}>{shortHash(entry.hash)}</dd>
              </div>
            </dl>
          </article>
          {i < CHAIN_ENTRIES.length - 1 ? (
            <div className={styles.connector} aria-hidden="true">
              <span className={styles.connectorRail} />
            </div>
          ) : null}
        </div>
      ))}
      <p className={styles.staticVerdict}>
        <SealBadge />
        <span className={styles.mono}>
          verifyChain(entries) → {"{"} valid: {String(CHAIN_VERIFICATION.valid)}
          , brokenAt: {String(CHAIN_VERIFICATION.brokenAt)} {"}"}
        </span>
      </p>
    </div>
  );
}

export function LivingChainSection(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [upgrade, setUpgrade] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return; // rest frame IS the experience
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setUpgrade(true);
          obs.disconnect();
        }
      },
      // Upgrade ~one viewport before arrival so the swap (and the chunk fetch) happen offscreen.
      { rootMargin: "100% 0px 100% 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {upgrade ? (
        <Suspense fallback={<StaticChain />}>
          <LivingChain />
        </Suspense>
      ) : (
        <StaticChain />
      )}
    </div>
  );
}
