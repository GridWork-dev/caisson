"use client";

import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ChainViewer } from "@caisson-sh/audit-worm/ui";
import { StatusChip } from "@caisson-sh/ui/components";

import {
  CHAIN_ENTRIES,
  CHAIN_VERIFICATION,
  eventName,
  shortHash,
  type ChainRowState,
} from "@/lib/audit-chain-sample";
import { SealBadge } from "@/components/seal-on-proof";
import styles from "./living-chain.module.css";

// The Living Chain (ADR-0334 moment 4 — the flagship). ONE of the exactly-two library-bearing
// components the ADR admits: motion (formerly framer-motion) drives a ~260vh sticky evidence
// build of the REAL SHA-256 chain. Motion NEVER enters @caisson-sh/audit-worm — this site-local
// wrapper drives the shipped <ChainViewer> purely through its public props (entries grow row by
// row; the verdict stamp is the real `verifyChain` output baked in lib/audit-chain-sample.ts).
//
// Composition: left, the storytelling cards — each append lands with a spring, and the link's
// prevHash chip visibly TRAVELS down the connector into the next card's prevHash slot (the hash
// chain made literal). Right, the proof layer — the real ChainViewer building itself in sync,
// closing with `valid: true` + the seal tick. Lineage: Linear autonomous-demo · Ramp walkthrough
// · NRK scroll sequencing.
//
// Swap-ready (ADR-0331 sequencing gate): card states are typed against the six-state per-row
// vocabulary but render only `genesis`/`pending` + honest chain-CONSISTENCY copy ("linked ·
// sha-256") — anchor-aware `verified` chips light up only when the per-row feature ships real
// proof bundles. Never overclaim: the demo proves link consistency, not WORM anchoring.
//
// This file is reached ONLY via living-chain-lazy.tsx (in-view + no-reduced-motion gates), so
// motion stays in a lazy chunk (ADR-0334 §4/§7: never first-load, ≤60 KiB combined).

const N = CHAIN_ENTRIES.length; // 4 entries + 1 verdict stage
// Each entry claims an equal progress band; the verdict takes the tail.
const BAND = 0.72 / N; // entries appear across p ∈ [0, 0.72]
const VERDICT_AT = 0.78;

function stateFor(index: number, built: number): ChainRowState {
  if (index >= built) return "pending";
  return index === 0 ? "genesis" : "pending"; // anchor-aware states wait for the per-row ship
}

/** Per-entry storytelling card: springs into place inside its progress band. */
function ChainCard({
  index,
  progress,
  built,
}: {
  index: number;
  progress: MotionValue<number>;
  built: number;
}) {
  const entry = CHAIN_ENTRIES[index];
  const start = index * BAND;
  // Raw band progress → spring-smoothed so the card lands with weight, not a linear slide.
  const raw = useTransform(progress, [start, start + BAND * 0.6], [0, 1]);
  const eased = useSpring(raw, { stiffness: 260, damping: 26, mass: 0.9 });
  const y = useTransform(eased, [0, 1], [56, 0]);
  const scale = useTransform(eased, [0, 1], [0.96, 1]);
  // The traveling prevHash chip: rides the connector BELOW this card into the next card's
  // prevHash slot during the gap between the two bands.
  const travel = useTransform(
    progress,
    [start + BAND * 0.55, start + BAND * 1.05],
    [0, 1],
  );
  const travelY = useTransform(travel, [0, 1], ["0%", "100%"]);
  const travelOpacity = useTransform(travel, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);

  if (!entry) return null;
  const state = stateFor(index, built);
  const linked = index < built;
  return (
    <div className={styles.cardSlot}>
      <motion.article
        className={styles.card}
        style={{ opacity: eased, y, scale }}
        data-state={state}
      >
        <div className={styles.cardHead}>
          <span className={styles.seq}>seq {entry.seq}</span>
          <StatusChip
            tone={linked ? "accent" : "muted"}
            dot
            label={
              index === 0 ? "genesis" : linked ? "linked · sha-256" : "pending"
            }
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
      </motion.article>
      {index < N - 1 ? (
        <div className={styles.connector} aria-hidden="true">
          <span className={styles.connectorRail} />
          <motion.span
            className={`${styles.travelChip} ${styles.mono}`}
            style={{ top: travelY, opacity: travelOpacity }}
          >
            {shortHash(entry.hash)} →
          </motion.span>
        </div>
      ) : null}
    </div>
  );
}

export default function LivingChain() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });
  // How many entries the real ChainViewer has "appended" so far (React state derived from the
  // motion value — one cheap setState per band crossing, not per scroll frame).
  const [built, setBuilt] = useState(0);
  const [verdict, setVerdict] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const k = Math.max(
      0,
      Math.min(N, Math.floor(p / BAND) + (p > 0.01 ? 1 : 0)),
    );
    if (k !== built) setBuilt(k);
    const v = p >= VERDICT_AT;
    if (v !== verdict) setVerdict(v);
  });

  const verdictRaw = useTransform(scrollYProgress, [VERDICT_AT, 0.9], [0, 1]);
  const verdictEased = useSpring(verdictRaw, {
    stiffness: 220,
    damping: 24,
  });
  const verdictY = useTransform(verdictEased, [0, 1], [32, 0]);

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.sticky}>
        <div className={styles.columns}>
          <div className={styles.cards}>
            {CHAIN_ENTRIES.map((e, i) => (
              <ChainCard
                key={e.seq}
                index={i}
                progress={scrollYProgress}
                built={built}
              />
            ))}
          </div>
          <div className={styles.proof}>
            {/* The REAL shipped component, building itself — entries grow with scroll; the
                verdict stamp is the real verifyChain output, never a mock. */}
            <ChainViewer
              entries={CHAIN_ENTRIES.slice(0, Math.max(1, built))}
              loading={!verdict}
              verification={CHAIN_VERIFICATION}
            />
            <motion.p
              className={styles.verdict}
              style={{ opacity: verdictEased, y: verdictY }}
              data-verdict={verdict ? "valid" : undefined}
            >
              {verdict ? <SealBadge /> : null}
              <span className={styles.mono}>
                verifyChain(entries) → {"{ valid: true, brokenAt: null }"}
              </span>
            </motion.p>
          </div>
        </div>
      </div>
    </div>
  );
}
