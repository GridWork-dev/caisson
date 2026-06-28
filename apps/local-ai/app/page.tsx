// apps/local-ai/app/page.tsx — the reference page (ADR-0044). A server component that runs the whole
// edition offline (`runDemo`) per request and renders each SPEC exit-gate clause. `nodejs` runtime +
// `force-dynamic`: the demo executes at request time (bun:sqlite + sqlite-vec live behind the
// externalized `@caisson/*` packages), never at build — `next build` runs no model, store, or socket.
import type { CSSProperties, ReactNode } from "react";
import { runDemo, type DemoResult } from "./demo/pipeline.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD: CSSProperties = {
  background: "#11161d",
  border: "1px solid #232b36",
  borderRadius: 10,
  padding: "16px 18px",
  marginBottom: 14,
};

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: ok ? "#0b0f14" : "#fff",
        background: ok ? "#3fb950" : "#f85149",
      }}
    >
      {ok ? "PASS" : "FAIL"} · {label}
    </span>
  );
}

function Clause({
  ok,
  title,
  children,
}: {
  ok: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={CARD}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
        <Pill ok={ok} label={ok ? "verified" : "regressed"} />
      </div>
      <div style={{ marginTop: 8, fontSize: 14, color: "#aeb9c5" }}>
        {children}
      </div>
    </section>
  );
}

export default async function Page() {
  const r: DemoResult = await runDemo();

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px" }}>
      <header style={{ marginBottom: 22 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>
          Caisson · Local-first AI
        </h1>
        <p style={{ margin: 0, color: "#8b97a4" }}>
          Offline, zero-egress reference app composing{" "}
          <code>@caisson/local-ai</code>. Embedding dim {r.embeddingDim} ·
          schema <code>{r.schemaVersion.slice(0, 12)}…</code> · tenants{" "}
          {r.tenants.join(", ")}.
        </p>
        <div style={{ marginTop: 12 }}>
          <Pill ok={r.ok} label="all exit-gate clauses" />
        </div>
      </header>

      <Clause ok={r.privacy.egressBlocked} title="Zero egress (privacy gate)">
        Mode <code>{r.privacy.mode}</code>. The empty-allowlist policy blocks
        every host — your data never leaves the device; no silent fallback to a
        hosted provider.
      </Clause>

      <Clause
        ok={
          r.retrieval.hybridTop === "d4" &&
          r.retrieval.hybridCount > r.retrieval.ftsOnlyCount
        }
        title="Hybrid retrieval (sqlite-vec + FTS5 RRF)"
      >
        Query <code>{r.retrieval.query}</code> → hybrid top{" "}
        <code>{r.retrieval.hybridTop}</code> ({r.retrieval.hybridCount} hits,
        vec+FTS fused); FTS-only degrade top{" "}
        <code>{r.retrieval.ftsOnlyTop}</code> ({r.retrieval.ftsOnlyCount} hit).
      </Clause>

      <Clause
        ok={r.atRest.roundTrip && r.atRest.crossTenantBlocked}
        title="At-rest field-crypto + file-per-tenant isolation"
      >
        Sealed envelope <code>{r.atRest.sealedPreview}</code> round-trips for
        tenant-a; a tenant-b context cannot open a tenant-a row (AEAD auth-fail)
        — cross-tenant read is unexpressible.
      </Clause>

      <Clause
        ok={
          r.license.valid.valid &&
          r.license.tampered === "community" &&
          r.license.absent === "community"
        }
        title="Offline license verify (Ed25519)"
      >
        Valid token → <code>{r.license.valid.tier}</code> (entitlements{" "}
        {r.license.valid.entitlements.join(", ") || "—"}); tampered →{" "}
        <code>{r.license.tampered}</code>; absent →{" "}
        <code>{r.license.absent}</code>. Verified with zero network.
      </Clause>

      <Clause
        ok={r.sync.converged && r.sync.tombstones.includes("docs/n4")}
        title="Two-way sync convergence"
      >
        Two device replicas converge byte-equal after one round-trip (
        {r.sync.rows.length} live rows); the delete is a durable tombstone (
        {r.sync.tombstones.join(", ") || "none"}) — no resurrection.
      </Clause>

      <footer style={{ marginTop: 8, fontSize: 12, color: "#6b7785" }}>
        <p style={{ margin: 0 }}>
          GET <code>/api/demo</code> for the JSON summary.{" "}
          {r.reconciliationNote}
        </p>
      </footer>
    </main>
  );
}
