import type { ReactNode } from "react";

import { adminDbConfigured, readAdmin } from "@/lib/admin-db";
import {
  INTEL_SEVERITIES,
  INTEL_SOURCES,
  isIntelSeverity,
  isIntelSource,
  readIntelFindings,
  type IntelFindingRow,
} from "@/lib/intel-read";

// ADR-0286 — the admin intel findings page. The standing intel daemon (services/intel) has been
// writing findings into the admin database's `intel` schema; until now nothing rendered them, so
// every finding was invisible without raw SQL (per the ADR, this page was deliberately sequenced
// AFTER the OAuth + catalog merge queue drained — it has). Reads run through the SAME read-only
// `admin` role every other business-admin view uses.
export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

// intel.findings carries no "reviewed"/acknowledged column (services/intel/migrations/
// 0001_intel_schema.sql: id, source, kind, severity, title, body, dedup_key, seen_count,
// first_seen, last_seen, run_id, payload) — no mark-reviewed state is rendered here; the schema
// does not support one yet.
export default async function IntelPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; source?: string }>;
}) {
  const params = await searchParams;
  const severity =
    params.severity !== undefined && isIntelSeverity(params.severity)
      ? params.severity
      : undefined;
  const source =
    params.source !== undefined && isIntelSource(params.source)
      ? params.source
      : undefined;

  const configured = adminDbConfigured();
  const findings: IntelFindingRow[] = configured
    ? await readAdmin((tx) =>
        readIntelFindings(tx, {
          ...(severity === undefined ? {} : { severity }),
          ...(source === undefined ? {} : { source }),
        }),
      )
    : [];

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-10)" }}>
      <section>
        <p className="eyebrow">caisson · admin</p>
        <h1 className="page-title">Intel findings</h1>
        <p className="lede">
          Competitor, compliance-framework, GitHub-traction, analytics, and
          error-triage findings from the standing intel daemon (ADR-0286),
          newest first. Read-only, through the same{" "}
          <span className="mono">admin</span> role as every other business-admin
          view.
        </p>
      </section>

      {!configured ? (
        <div className="panel">
          <p className="section-title">Not configured</p>
          <p className="muted">
            Set <span className="mono">CAISSON_ADMIN_DB_URL</span> to read live
            findings. The intel daemon writes to the same admin Postgres, in its
            own <span className="mono">intel</span> schema.
          </p>
        </div>
      ) : null}

      <form
        method="GET"
        className="row"
        style={{ gap: "var(--cs-space-3)", flexWrap: "wrap" }}
      >
        <Select
          name="severity"
          label="Severity"
          value={severity ?? ""}
          options={INTEL_SEVERITIES}
        />
        <Select
          name="source"
          label="Source"
          value={source ?? ""}
          options={INTEL_SOURCES}
        />
        <button
          type="submit"
          style={{ alignSelf: "flex-end", padding: "6px 12px" }}
        >
          Filter
        </button>
        {severity !== undefined || source !== undefined ? (
          <a
            href="/intel"
            className="muted"
            style={{ alignSelf: "flex-end", fontSize: "0.85em" }}
          >
            Clear
          </a>
        ) : null}
      </form>

      <Section title={`Findings (${findings.length})`}>
        <Table
          head={[
            "Severity",
            "Source",
            "Title",
            "Seen",
            "First seen",
            "Last seen",
          ]}
          empty={configured ? "No findings match this filter." : "—"}
          rows={findings.map((f) => [
            f.severity,
            f.source,
            f.title,
            String(f.seenCount),
            fmtDate(f.firstSeen),
            fmtDate(f.lastSeen),
          ])}
        />
      </Section>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly string[];
}) {
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span className="muted" style={{ fontSize: "0.8em" }}>
        {label}
      </span>
      <select name={name} defaultValue={value} style={{ padding: 6 }}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stack" style={{ gap: "var(--cs-space-3)" }}>
      <h2 className="section-title">{title}</h2>
      <div className="panel">{children}</div>
    </section>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="muted">{empty}</p>;
  }
  return (
    <table className="admin-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} className={j === 2 ? undefined : "mono"}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
