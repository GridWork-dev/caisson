import { Button, CodeBlock, StatusChip, Terminal } from "@/components";
import { DoorsWithWeight } from "@/components/doors-with-weight";
import { HeroField } from "@/components/hero-field";
import { ProofChips } from "@/components/proof-chips";
import { BUNDLES, MODULES, modulesByBundle } from "@/lib/catalog";

import styles from "./dual-door-hero.module.css";

// Dual-door hero (D1 lock, 2026-07-07 research-synthesis picker) — the correct rendering of the
// ADR-0040 two-layer frame: compliance is the sharp wedge (the LEAD door, accent identity),
// production the umbrella (the SECONDARY door into the six bundles). Server component — the doors
// are real links, no interactivity. Replaces the compliance-only <Hero> on `/`.
//
// Door sub-claims are honest + mechanism-named now (ADR-0080). They are refinable from the Cookiy
// frame-test (survey 287453) in a later copy-only pass — a swap of these two strings, no rebuild.

// Build facts for the production door chip — computed, never hand-typed, so they can't drift from
// the catalog (ADR-0080: no invented numbers; every figure is a real build fact).
const BUNDLE_COUNT = BUNDLES.length;
const MODULE_COUNT = MODULES.length;

export function DualDoorHero() {
  return (
    <section className={`cs-section ${styles.heroShell}`} data-flush="">
      {/* Ambient depth-fog lattice field (ADR-0306) — additive layer BEHIND the content; the h1/LCP
          contract below is untouched. */}
      <HeroField />
      <DoorsWithWeight />
      <div className="cs-container">
        <span className="cs-eyebrow">One audited base — two ways in</span>
        <h1 className="cs-display" style={{ marginTop: "var(--cs-space-5)" }}>
          Audit-ready and production-hard from commit one.
        </h1>
        <p
          className="cs-lede"
          style={{ marginTop: "var(--cs-space-5)", maxWidth: "60ch" }}
        >
          Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only
          audit chain sit on the same base as token metering, on-device
          inference, and signed provenance. Pick the door that fits — the base
          underneath is the same.
        </p>

        {/* Two doors: Compliance leads (accent), production is the secondary umbrella door.
            data-doors/data-door: hooks for the Doors With Weight enhancer (ADR-0334 moment 5) —
            interruptible springs attach post-idle on hover-capable devices; HTML unchanged. */}
        <div className={styles.doors} data-doors="">
          {/* ponytail: door sub-claim copy is Cookiy-287453-refinable later (string swap, no rebuild). */}
          <div className={styles.door} data-lead data-door="">
            <span className={styles.kicker}>Building something regulated?</span>
            <StatusChip
              className={styles.chip}
              tone="accent"
              dot
              label={`Compliance · ${modulesByBundle("compliance").length} modules`}
            />
            <p className={styles.claim}>
              The compliance wedge: fail-closed RLS, WORM evidence storage, an
              append-only audit chain, per-tenant field encryption, and an
              evidence-pack generator you run — the technical controls an audit
              checks for, mapped to SOC 2, HIPAA, ISO 27001, NIST 800-53, PCI
              DSS, and GDPR, with an ISO 27001 Statement-of-Applicability
              export. Never a certification we claim.
            </p>
            <div className={styles.cta}>
              {/* hard: the Door Morph (ADR-0334 moment 3) rides a cross-DOCUMENT view
                  transition — next/link soft navs never fire it. The Speculation Rules
                  hover-prerender makes the hard nav instant. */}
              <Button href="/compliance" variant="primary" hard>
                Open the Compliance bundle
              </Button>
            </div>
          </div>

          <div className={styles.door} data-door="">
            <span className={styles.kicker}>Building for production?</span>
            <StatusChip
              className={styles.chip}
              tone="muted"
              dot
              label={`${BUNDLE_COUNT} bundles · ${MODULE_COUNT} modules`}
            />
            <p className={styles.claim}>
              Six composable bundles on one base: token metering and spend caps,
              on-device inference behind a privacy egress gate, a governed-agent
              kernel, and cryptographic provenance. Compose what you need —
              never a fork.
            </p>
            <div className={styles.cta}>
              <Button href="/#bundles" variant="ghost">
                Explore the six bundles
              </Button>
            </div>
          </div>
        </div>

        {/* Supporting honest artifact (ADR-0104 static hero): the real cross-tenant denial + the
            install line — the denial carries the claim, no diagram standing in for behaviour.
            The CLI package is not yet on the public registry (CAISSON-147), so the chip states
            "private beta", never a success-tone "ready". Both terminals are framed, so the two
            cards carry matching elevation (ADR-0285 §4); the install column fills to the psql
            terminal's height with a proof-chip row. */}
        <div className={styles.artifact}>
          <Terminal
            label="psql — cross-tenant read"
            status={<StatusChip tone="accent" dot label="denied" />}
          >
            <span className="cs-tok-muted">
              -- tenant context was never set
            </span>
            {
              "\n$ SELECT count(*) FROM invoices;\n\n count\n-------\n     0\n(1 row)"
            }
          </Terminal>
          <div className={styles.artifactRight}>
            <CodeBlock
              frame
              label="install"
              status={<StatusChip tone="muted" dot label="private beta" />}
              code={
                <>
                  <span className="cs-tok-muted">$</span> bunx{" "}
                  <span className="cs-tok-accent">@caisson-sh/cli</span>@latest
                </>
              }
            />
            {/* A filled proof panel absorbs the height difference with the taller psql terminal, so
                the install column reads as a deliberate block instead of one stretched, near-empty
                terminal frame (ADR-0285 §4). */}
            <div className={styles.artifactProof}>
              <ProofChips
                items={[
                  "Apache-2.0 base",
                  "Postgres + RLS",
                  "Perpetual — no phone-home",
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
