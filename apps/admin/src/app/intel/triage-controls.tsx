"use client";

// ADR-0316 F5 — per-row triage controls on the /intel page. Two buttons POST to the GitHub-OAuth-
// gated review/dismiss routes; the button matching the current status is disabled (idempotent, but
// no point re-firing). On success it `router.refresh()`es the server component so the row re-renders
// with its new status. No type-to-confirm gate: flipping a finding's triage state is benign (not
// tenant money/entitlement state), unlike the /business mutation cards.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TriageControls({
  findingId,
  status,
}: {
  findingId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(verb: "review" | "dismiss"): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/intel/${verb}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ findingId }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => ({}));
        const message =
          body !== null &&
          typeof body === "object" &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : `failed (${String(res.status)})`;
        setErr(message);
        setBusy(false);
        return;
      }
      router.refresh(); // re-render the server component with the updated status
    } catch (e) {
      setErr(e instanceof Error ? e.message : "network error");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <button
        type="button"
        disabled={busy || status === "reviewed"}
        onClick={() => void act("review")}
        style={{ padding: "3px 8px", fontSize: "0.8em" }}
      >
        Review
      </button>
      <button
        type="button"
        disabled={busy || status === "dismissed"}
        onClick={() => void act("dismiss")}
        style={{ padding: "3px 8px", fontSize: "0.8em" }}
      >
        Dismiss
      </button>
      {err !== null ? (
        <span
          style={{ color: "var(--cs-danger, crimson)", fontSize: "0.75em" }}
        >
          {err}
        </span>
      ) : null}
    </div>
  );
}
