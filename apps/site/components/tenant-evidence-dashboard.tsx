import type { CrosswalkRollupCell } from "@caisson/compliance-core";
import { Button, Card } from "@caisson/ui/components";
import {
  mapBuyerCrosswalk,
  type LatestEvidencePackResponse,
  type TenantProofResponse,
} from "@/lib/tenant-evidence";

export interface TenantEvidenceDashboardProps {
  readonly proof?: TenantProofResponse;
  readonly proofSeq?: number;
  readonly proofError?: string;
  readonly latestPack?: LatestEvidencePackResponse;
  readonly latestPackError?: string;
}

function CrosswalkEdges({
  headingId,
  heading,
  edges,
}: {
  readonly headingId: string;
  readonly heading: "Maps to" | "Implements";
  readonly edges: readonly CrosswalkRollupCell[];
}) {
  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="cs-card-title"
        style={{ fontSize: "var(--cs-text-lg)" }}
      >
        {heading}
      </h2>
      {edges.length === 0 ? (
        <p className="cs-muted">
          No edges of this kind are present in the pack.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gap: "var(--cs-space-3)",
          }}
        >
          {edges.map((edge) => (
            <li
              key={`${edge.claim}:${edge.framework}:${edge.reference}`}
              style={{
                borderTop: "1px solid var(--cs-border)",
                paddingTop: "var(--cs-space-3)",
              }}
            >
              <strong>
                {edge.framework} {edge.reference}
              </strong>
              <div className="cs-muted">
                Evidence state: {edge.status}. Evidence pointer:{" "}
                <code>{edge.evidencePointers.join(", ")}</code>
              </div>
              {edge.note === undefined ? null : (
                <p className="cs-muted">{edge.note}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProofResult({ proof }: { readonly proof: TenantProofResponse }) {
  if ("state" in proof) {
    return (
      <div role="alert">
        <strong>Unverifiable</strong>
        <p>{proof.reason}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-3)" }}>
      <p>
        Row {proof.receipt.seq} is anchored in a chain of {proof.chainLength}{" "}
        entries.
      </p>
      {proof.redacted ? (
        <p role="status">
          Original fields were redacted before this receipt crossed the service
          boundary
          {proof.redactedPaths === undefined
            ? "."
            : `: ${proof.redactedPaths.join(", ")}.`}
        </p>
      ) : null}
      <pre
        aria-label={
          proof.redacted ? "Redacted row proof receipt" : "Row proof receipt"
        }
        style={{ overflowX: "auto" }}
      >
        {JSON.stringify(proof.receipt, null, 2)}
      </pre>
    </div>
  );
}

export function TenantEvidenceDashboard({
  proof,
  proofSeq,
  proofError,
  latestPack,
  latestPackError,
}: TenantEvidenceDashboardProps) {
  const crosswalk =
    latestPack === undefined
      ? undefined
      : mapBuyerCrosswalk(latestPack.manifest);

  return (
    <div style={{ display: "grid", gap: "var(--cs-space-8)" }}>
      <div>
        <h1
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-2xl)" }}
        >
          Audit evidence
        </h1>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-2)" }}>
          Inspect one audit-row receipt and the two claim kinds recorded in your
          latest persisted evidence pack.
        </p>
      </div>

      <Card style={{ display: "grid", gap: "var(--cs-space-4)" }}>
        <h2
          className="cs-card-title"
          style={{ fontSize: "var(--cs-text-lg)", margin: 0 }}
        >
          Row proof
        </h2>
        <form method="get" action="/dashboard/evidence">
          <label htmlFor="audit-proof-seq">Audit row sequence</label>
          <div
            style={{
              display: "flex",
              alignItems: "end",
              gap: "var(--cs-space-3)",
              marginTop: "var(--cs-space-2)",
            }}
          >
            <input
              id="audit-proof-seq"
              name="seq"
              type="number"
              min={0}
              step={1}
              required
              defaultValue={proofSeq}
            />
            <Button type="submit">Load proof</Button>
          </div>
        </form>
        {proofError === undefined ? null : <p role="alert">{proofError}</p>}
        {proof === undefined ? null : <ProofResult proof={proof} />}
      </Card>

      <Card style={{ display: "grid", gap: "var(--cs-space-5)" }}>
        <div>
          <h2
            className="cs-card-title"
            style={{ fontSize: "var(--cs-text-lg)", margin: 0 }}
          >
            Latest evidence-pack crosswalk
          </h2>
          {latestPack === undefined ? null : (
            <p className="cs-muted">
              Persisted {latestPack.generatedAt}. SHA-256{" "}
              <code>{latestPack.sha256}</code>.
            </p>
          )}
        </div>
        {latestPackError === undefined ? null : (
          <p role="alert">{latestPackError}</p>
        )}
        {crosswalk === undefined ? null : (
          <>
            <CrosswalkEdges
              headingId="crosswalk-maps-to"
              heading="Maps to"
              edges={crosswalk.mapsTo}
            />
            <CrosswalkEdges
              headingId="crosswalk-implements"
              heading="Implements"
              edges={crosswalk.implements}
            />
          </>
        )}
      </Card>
    </div>
  );
}
