import styles from "./architecture-fit-diagram.module.css";

// Architecture-fit integration diagram (ADR-0323 Cookiy-response — developers want to see fit
// before adopting anything). Server component, static, theme-aware by --cs-* token cascade
// (matches the isolation-diagrams.tsx pattern: hand-authored CSS, no charting/graph dependency,
// real <div>/text labels — no image-of-text). Depicts SHIPPED behaviour only (ADR-0080): the
// module layer installs as ordinary packages on the Postgres database you already run, and
// telemetry is OTLP/HTTP to whatever collector you already run (packages/observability) — never a
// hosted Caisson dashboard you're locked into.
export function ArchitectureFitDiagram() {
  return (
    <div
      className={styles.arch}
      role="group"
      aria-label="How Caisson lands in an existing stack"
    >
      <div className={styles.stack}>
        <div className={styles.layer} data-layer="app">
          <div className={styles.layerHead}>Your app</div>
          <div className={styles.layerSub}>
            Next.js or any Node runtime — your routes, your UI, your domain
            logic
          </div>
        </div>
        <div className={styles.down} aria-hidden="true">
          ↓ imports
        </div>
        <div className={styles.layer} data-layer="modules">
          <div className={styles.layerHead}>Caisson module layer</div>
          <div className={styles.layerSub}>
            fail-closed RLS, audit-chain, field-crypto, billing, and the rest of
            the catalog — installed packages, composed into your app, never a
            fork you maintain
          </div>
        </div>
        <div className={styles.down} aria-hidden="true">
          ↓ runs on
        </div>
        <div className={styles.layer} data-layer="db">
          <div className={styles.layerHead}>Postgres, with RLS</div>
          <div className={styles.layerSub}>
            the database you already run — FORCE ROW LEVEL SECURITY on your
            existing instance, not a new datastore to stand up
          </div>
        </div>
      </div>

      <div>
        <p className={styles.sideLabel}>
          One thing attaches to that stack without a rewrite:
        </p>
        <div className={styles.side}>
          <div className={styles.sideCard}>
            <div className={styles.sideHead}>Observability — out</div>
            <div className={styles.sideSub}>
              OpenTelemetry traces and logs export over OTLP/HTTP to the
              collector you already run — Grafana, Datadog, whatever it is. No
              hosted Caisson dashboard to get locked into.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
