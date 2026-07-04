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
  // The mutation committed but the tamper-evident WORM append failed (ADR-0220): a DISTINCT,
  // do-not-retry state — the action succeeded and is in the log; retrying would double-apply.
  | { kind: "warn"; message: string; body: unknown }
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
    // A 200 that carries `worm: "failed"` is the committed-but-WORM-append-failed signal — surface
    // it as a distinct do-not-retry warning, never as a plain success or a retryable error.
    if (
      body !== null &&
      typeof body === "object" &&
      "worm" in body &&
      (body as { worm: unknown }).worm === "failed"
    ) {
      const message =
        "message" in body &&
        typeof (body as { message: unknown }).message === "string"
          ? (body as { message: string }).message
          : "Mutation committed; WORM audit append failed — do NOT retry.";
      return { kind: "warn", message, body };
    }
    return { kind: "ok", body };
  } catch (err) {
    return {
      kind: "err",
      message: err instanceof Error ? err.message : "network error",
    };
  }
}

// --- ADR-0225 paid-revoke impact preview (R-6) ------------------------------------------------

interface SourcePreview {
  purchaseId: string;
  grantedAt: string;
  entitlementsDropping: string[];
  entitlementsSurviving: string[];
  granted: number;
  alreadyClawed: number;
  clawPreview: number;
}
interface AccountPreview {
  accountId: string;
  balance: number;
  licensesToDeny: string[];
  sources: SourcePreview[];
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

// Narrow the preview endpoint's JSON at the trust boundary — never trust the shape blindly (no `any`).
function asAccountPreview(v: unknown): AccountPreview | null {
  if (v === null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.accountId !== "string" || typeof o.balance !== "number")
    return null;
  if (!isStringArray(o.licensesToDeny) || !Array.isArray(o.sources))
    return null;
  const sources: SourcePreview[] = [];
  for (const raw of o.sources) {
    if (raw === null || typeof raw !== "object") return null;
    const s = raw as Record<string, unknown>;
    if (typeof s.purchaseId !== "string" || typeof s.grantedAt !== "string")
      return null;
    if (
      typeof s.granted !== "number" ||
      typeof s.alreadyClawed !== "number" ||
      typeof s.clawPreview !== "number"
    )
      return null;
    if (
      !isStringArray(s.entitlementsDropping) ||
      !isStringArray(s.entitlementsSurviving)
    )
      return null;
    sources.push({
      purchaseId: s.purchaseId,
      grantedAt: s.grantedAt,
      entitlementsDropping: s.entitlementsDropping,
      entitlementsSurviving: s.entitlementsSurviving,
      granted: s.granted,
      alreadyClawed: s.alreadyClawed,
      clawPreview: s.clawPreview,
    });
  }
  return {
    accountId: o.accountId,
    balance: o.balance,
    licensesToDeny: o.licensesToDeny,
    sources,
  };
}

function errorMessage(body: unknown, status: number): string {
  if (
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return `request failed (${String(status)})`;
}

async function loadPreview(
  accountId: string,
): Promise<
  { ok: true; preview: AccountPreview } | { ok: false; message: string }
> {
  try {
    const res = await fetch("/api/admin/entitlement/revoke-purchase/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetAccountId: accountId }),
    });
    const body: unknown = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: errorMessage(body, res.status) };
    const preview = asAccountPreview(body);
    if (preview === null)
      return { ok: false, message: "unexpected preview response" };
    return { ok: true, preview };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "network error",
    };
  }
}

/**
 * A mutation response body carrying a plaintext secret. The only such shape today is the license
 * reissue result (`{ token, licenseId, major, worm, ... }`) — never render `token` via a raw JSON
 * dump (this is NOT an HTML-injection finding; React already escapes text — it's a "don't display
 * the secret by default" finding).
 */
export function isTokenBody(
  body: unknown,
): body is { token: string } & Record<string, unknown> {
  return (
    body !== null &&
    typeof body === "object" &&
    "token" in body &&
    typeof (body as { token: unknown }).token === "string"
  );
}

/** The non-secret fields (`licenseId`, `major`, `worm`, …) stay in the JSON dump; only `token` is masked. */
export function redactToken(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return { ...body, token: "[masked — see reveal above]" };
}

/** Fixed-length mask regardless of token length, so the mask itself never leaks the secret's shape. */
export function tokenDisplayValue(token: string, revealed: boolean): string {
  return revealed ? token : "•".repeat(8);
}

// ponytail: one component for the one secret-bearing result shape today — a generic
// secret-redaction framework is speculative until a second token-bearing mutation exists.
function TokenReveal({ token }: { token: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);

  if (cleared) {
    return (
      <p className="muted" style={{ fontSize: "0.85em" }}>
        Token cleared.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="muted" style={{ fontSize: "0.8em" }}>
        License token (masked — reveal explicitly before copying):
      </span>
      <code
        className="mono"
        style={{
          display: "block",
          fontSize: "0.85em",
          padding: "var(--cs-space-2, 8px)",
          background: "var(--cs-surface-2, rgba(127,127,127,0.08))",
          borderRadius: 6,
          wordBreak: "break-all",
        }}
      >
        {tokenDisplayValue(token, revealed)}
      </code>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setRevealed((r) => !r)}>
          {revealed ? "Hide" : "Show"}
        </button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(token).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" onClick={() => setCleared(true)}>
          Clear
        </button>
      </div>
    </div>
  );
}

function ResultBody({ body }: { body: unknown }) {
  const dump = isTokenBody(body) ? redactToken(body) : body;
  return (
    <>
      {isTokenBody(body) ? <TokenReveal token={body.token} /> : null}
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
        {JSON.stringify(dump, null, 2)}
      </pre>
    </>
  );
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
  if (result.kind === "warn")
    return (
      <div className="stack" style={{ gap: "var(--cs-space-2, 8px)" }}>
        <p style={{ color: "var(--cs-warning, #b45309)", fontWeight: 600 }}>
          Committed — do NOT retry. {result.message}
        </p>
        <ResultBody body={result.body} />
      </div>
    );
  return <ResultBody body={result.body} />;
}

/** Armed only when the operator retypes the EXACT target account id — no universal bypass string. */
export function isArmed(
  confirm: string,
  targetAccountId: string,
  disabled?: boolean,
): boolean {
  return (
    targetAccountId.trim() !== "" &&
    confirm.trim() === targetAccountId.trim() &&
    disabled !== true
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
  const armed = isArmed(confirm, targetAccountId, disabled);

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
          Type the target account id to arm:
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

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className="stack"
      style={{
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        fontSize: "0.85em",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; preview: AccountPreview }
  | { kind: "error"; message: string };

/**
 * ADR-0225 action 5 — revoke a REAL paid one-time purchase. The MANDATORY impact preview (R-6 = A):
 * the operator loads the account's active one-time purchases, picks one, and sees the exact effect
 * (entitlements dropping vs surviving by refcount, the credit claw, the edge deny-set size) BEFORE
 * the type-to-confirm gate can arm — `disabled` stays true until a source is selected, which is only
 * possible once the preview has loaded. Both destructive effects are explicit checkboxes, default ON
 * (R-1 claw + R-4 edge), matching the service body's per-action choices.
 */
function RevokePurchaseCard() {
  const [acct, setAcct] = useState("");
  const [load, setLoad] = useState<LoadState>({ kind: "idle" });
  const [selected, setSelected] = useState("");
  const [claw, setClaw] = useState(true);
  const [edge, setEdge] = useState(true);
  const [reason, setReason] = useState("");

  const preview = load.kind === "loaded" ? load.preview : null;
  const source =
    preview !== null
      ? (preview.sources.find((s) => s.purchaseId === selected) ?? null)
      : null;

  return (
    <MutationCard
      title="Revoke purchase"
      description="Strip a REAL paid one-time purchase (fraud / chargeback / ToS) with no Paddle refund. Load the impact preview and pick the purchase before confirming (ADR-0225)."
      targetAccountId={acct}
      disabled={source === null}
      onSubmit={() =>
        callRoute("/api/admin/entitlement/revoke-purchase", {
          targetAccountId: acct.trim(),
          purchaseId: selected,
          clawUnspentCredits: claw,
          revokeEdgeAccess: edge,
          ...(reason.trim() === "" ? {} : { reason: reason.trim() }),
        })
      }
    >
      <Field
        label="Target account id"
        value={acct}
        onChange={(v) => {
          setAcct(v);
          setLoad({ kind: "idle" });
          setSelected("");
        }}
      />
      <button
        type="button"
        disabled={acct.trim() === "" || load.kind === "loading"}
        onClick={() => {
          setLoad({ kind: "loading" });
          setSelected("");
          void loadPreview(acct.trim()).then((r) =>
            setLoad(
              r.ok
                ? { kind: "loaded", preview: r.preview }
                : { kind: "error", message: r.message },
            ),
          );
        }}
        style={{ padding: "6px 12px", alignSelf: "flex-start" }}
      >
        {load.kind === "loading" ? "Loading…" : "Load impact preview"}
      </button>

      {load.kind === "error" ? (
        <p style={{ color: "var(--cs-danger, crimson)", fontSize: "0.85em" }}>
          Preview error: {load.message}
        </p>
      ) : null}

      {preview !== null && preview.sources.length === 0 ? (
        <p className="muted" style={{ fontSize: "0.85em" }}>
          No active one-time purchases to revoke for this account.
        </p>
      ) : null}

      {preview !== null && preview.sources.length > 0 ? (
        <div className="stack" style={{ gap: 4 }}>
          <span className="muted" style={{ fontSize: "0.8em" }}>
            Select the purchase to revoke:
          </span>
          {preview.sources.map((s) => (
            <label
              key={s.purchaseId}
              className="stack"
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <input
                type="radio"
                name="revoke-purchase-source"
                checked={selected === s.purchaseId}
                onChange={() => setSelected(s.purchaseId)}
              />
              <span className="mono" style={{ fontSize: "0.8em" }}>
                {s.purchaseId}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {preview !== null && source !== null ? (
        <div
          className="stack"
          style={{
            gap: 4,
            fontSize: "0.82em",
            background: "var(--cs-surface-2, rgba(127,127,127,0.08))",
            padding: "var(--cs-space-2, 8px)",
            borderRadius: 6,
          }}
        >
          <p style={{ fontWeight: 600 }}>Impact preview</p>
          <p>
            Entitlements dropping:{" "}
            <span className="mono">
              {source.entitlementsDropping.length === 0
                ? "none"
                : source.entitlementsDropping.join(", ")}
            </span>
          </p>
          <p>
            Surviving (refcount):{" "}
            <span className="mono">
              {source.entitlementsSurviving.length === 0
                ? "none"
                : source.entitlementsSurviving.join(", ")}
            </span>
          </p>
          <p>
            Credit claw if enabled: <strong>{source.clawPreview}</strong> of{" "}
            {source.granted} granted (already clawed {source.alreadyClawed};
            wallet balance {preview.balance})
          </p>
          <p>
            Licenses denied at edge if enabled:{" "}
            <strong>{preview.licensesToDeny.length}</strong>
          </p>
        </div>
      ) : null}

      <Checkbox
        label="Also claw unspent credits"
        checked={claw}
        onChange={setClaw}
      />
      <Checkbox
        label="Also revoke edge license access"
        checked={edge}
        onChange={setEdge}
      />
      <Field
        label="Reason (optional — WORM evidence)"
        value={reason}
        onChange={setReason}
        placeholder="chargeback lost on txn …"
      />
    </MutationCard>
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

      <RevokePurchaseCard />
    </div>
  );
}
