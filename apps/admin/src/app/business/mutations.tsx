"use client";

// The ADR-0220 operator mutation panel: the four locked actions (grant · revoke · adjust · reissue),
// each behind a type-to-confirm gate (retype the target account id to arm the destructive submit —
// the security floor's input-validation-at-the-boundary rule, made visible). Each form POSTs to its
// CF-Access-gated route (`/api/admin/...`); the middleware supplies the verified actor, so the client
// never sends one. The money/license blast radius is why the confirm gate is mandatory, not cosmetic.
import { useState, type ReactNode } from "react";

type Result =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "ok"; body: unknown }
  | { kind: "err"; message: string };

async function callRoute(path: string, payload: unknown): Promise<Result> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message =
        body !== null &&
        typeof body === "object" &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : `request failed (${String(res.status)})`;
      return { kind: "err", message };
    }
    return { kind: "ok", body };
  } catch (err) {
    return {
      kind: "err",
      message: err instanceof Error ? err.message : "network error",
    };
  }
}

function ResultLine({ result }: { result: Result }) {
  if (result.kind === "idle") return null;
  if (result.kind === "busy") return <p className="muted">Working…</p>;
  if (result.kind === "err")
    return (
      <p style={{ color: "var(--cs-danger, crimson)" }}>
        Error: {result.message}
      </p>
    );
  return (
    <pre
      className="mono"
      style={{
        whiteSpace: "pre-wrap",
        fontSize: "0.85em",
        background: "var(--cs-surface-2, rgba(127,127,127,0.08))",
        padding: "var(--cs-space-2, 8px)",
        borderRadius: 6,
        overflowX: "auto",
      }}
    >
      {JSON.stringify(result.body, null, 2)}
    </pre>
  );
}

function MutationCard({
  title,
  description,
  targetAccountId,
  children,
  onSubmit,
  disabled,
}: {
  title: string;
  description: string;
  targetAccountId: string;
  children: ReactNode;
  onSubmit: () => Promise<Result>;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });
  // Armed only when the operator retypes the exact target account id (or the literal CONFIRM).
  const armed =
    targetAccountId.trim() !== "" &&
    (confirm.trim() === targetAccountId.trim() ||
      confirm.trim() === "CONFIRM") &&
    disabled !== true;

  return (
    <div
      className="panel stack"
      style={{ gap: "var(--cs-space-3)", padding: "var(--cs-space-4, 16px)" }}
    >
      <div>
        <p className="section-title">{title}</p>
        <p className="muted" style={{ fontSize: "0.85em" }}>
          {description}
        </p>
      </div>
      <div className="stack" style={{ gap: "var(--cs-space-2)" }}>
        {children}
      </div>
      <label className="stack" style={{ gap: 4 }}>
        <span className="muted" style={{ fontSize: "0.8em" }}>
          Type the target account id (or <span className="mono">CONFIRM</span>)
          to arm:
        </span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="confirm"
          className="mono"
          style={{ padding: 6 }}
        />
      </label>
      <button
        type="button"
        disabled={!armed || result.kind === "busy"}
        onClick={() => {
          setResult({ kind: "busy" });
          void onSubmit().then(setResult);
        }}
        style={{
          padding: "8px 14px",
          alignSelf: "flex-start",
          opacity: armed ? 1 : 0.5,
          cursor: armed ? "pointer" : "not-allowed",
        }}
      >
        {title}
      </button>
      <ResultLine result={result} />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="stack" style={{ gap: 4 }}>
      <span className="muted" style={{ fontSize: "0.8em" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mono"
        style={{ padding: 6 }}
      />
    </label>
  );
}

export function AdminMutations() {
  const [grantAcct, setGrantAcct] = useState("");
  const [grantIds, setGrantIds] = useState("");
  const [revokeAcct, setRevokeAcct] = useState("");
  const [revokeId, setRevokeId] = useState("");
  const [adjustAcct, setAdjustAcct] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [reissueAcct, setReissueAcct] = useState("");
  const [reissueMajor, setReissueMajor] = useState("");

  const ids = grantIds
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const delta = Number.parseInt(adjustDelta, 10);
  const major = Number.parseInt(reissueMajor, 10);

  return (
    <div
      className="stack"
      style={{
        gap: "var(--cs-space-3)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      }}
    >
      <MutationCard
        title="Grant entitlement"
        description="Comp one or more entitlement ids (source_kind admin_comp). Comma-separate ids."
        targetAccountId={grantAcct}
        disabled={ids.length === 0}
        onSubmit={() =>
          callRoute("/api/admin/entitlement/grant", {
            targetAccountId: grantAcct.trim(),
            entitlementIds: ids,
          })
        }
      >
        <Field
          label="Target account id"
          value={grantAcct}
          onChange={setGrantAcct}
        />
        <Field
          label="Entitlement ids (comma-separated)"
          value={grantIds}
          onChange={setGrantIds}
          placeholder="compliance, ai-kit"
        />
      </MutationCard>

      <MutationCard
        title="Revoke entitlement"
        description="Soft-revoke an operator comp (admin_comp grants only; real purchases are unaffected)."
        targetAccountId={revokeAcct}
        disabled={revokeId.trim() === ""}
        onSubmit={() =>
          callRoute("/api/admin/entitlement/revoke", {
            targetAccountId: revokeAcct.trim(),
            entitlementId: revokeId.trim(),
          })
        }
      >
        <Field
          label="Target account id"
          value={revokeAcct}
          onChange={setRevokeAcct}
        />
        <Field label="Entitlement id" value={revokeId} onChange={setRevokeId} />
      </MutationCard>

      <MutationCard
        title="Adjust credits"
        description="± integer credits (billing-error correction). Negative clamps to the balance — never below zero."
        targetAccountId={adjustAcct}
        disabled={
          !Number.isInteger(delta) || delta === 0 || adjustReason.trim() === ""
        }
        onSubmit={() =>
          callRoute("/api/admin/credit/adjust", {
            targetAccountId: adjustAcct.trim(),
            deltaCredits: delta,
            reason: adjustReason.trim(),
          })
        }
      >
        <Field
          label="Target account id"
          value={adjustAcct}
          onChange={setAdjustAcct}
        />
        <Field
          label="Delta (integer, ±)"
          value={adjustDelta}
          onChange={setAdjustDelta}
          placeholder="-500"
        />
        <Field label="Reason" value={adjustReason} onChange={setAdjustReason} />
      </MutationCard>

      <MutationCard
        title="Reissue license"
        description="Re-serve the buyer's existing token for a major (lost key). v1 re-serves only."
        targetAccountId={reissueAcct}
        disabled={!Number.isInteger(major) || major < 0}
        onSubmit={() =>
          callRoute("/api/admin/license/reissue", {
            targetAccountId: reissueAcct.trim(),
            major,
          })
        }
      >
        <Field
          label="Target account id"
          value={reissueAcct}
          onChange={setReissueAcct}
        />
        <Field
          label="Major version"
          value={reissueMajor}
          onChange={setReissueMajor}
          placeholder="1"
        />
      </MutationCard>
    </div>
  );
}
