"use client";

// BYOK key-entry form (ADR-0183, `frontend`). Submits to `POST /api/byok`, which validates the key
// live before persisting. Masked-secret input, per-submit Validating -> Connected / Failed state, and
// the free-billing note (ADR-0182). Rotation is the same form (re-submit a provider = UPSERT).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FormField } from "@caisson/ui/components";
import { BYOK_PROVIDERS, type ByokProvider } from "@/lib/byok-providers";

type SubmitState =
  | { kind: "idle" }
  | { kind: "validating" }
  | { kind: "ok"; masked: string }
  | { kind: "error"; reason: string };

export function ByokForm() {
  const router = useRouter();
  const [provider, setProvider] = useState<ByokProvider>(BYOK_PROVIDERS[0]);
  const [apiKey, setApiKey] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (apiKey.trim().length < 8) {
      setState({ kind: "error", reason: "Enter the full provider key." });
      return;
    }
    setState({ kind: "validating" });
    try {
      const res = await fetch("/api/byok", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey }),
      });
      const data: unknown = await res.json();
      if (res.ok) {
        const masked =
          typeof data === "object" &&
          data !== null &&
          "status" in data &&
          typeof (data as { status: { maskedLast4?: unknown } }).status
            .maskedLast4 === "string"
            ? (data as { status: { maskedLast4: string } }).status.maskedLast4
            : "••••";
        setApiKey(""); // never keep the plaintext in component state after a successful save
        setState({ kind: "ok", masked });
        router.refresh(); // re-read the (server-side) masked status list
      } else {
        const reason =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Validation failed.";
        setState({ kind: "error", reason });
      }
    } catch {
      setState({ kind: "error", reason: "Network error — try again." });
    }
  }

  const busy = state.kind === "validating";

  return (
    <Card>
      <form
        onSubmit={onSubmit}
        style={{ display: "grid", gap: "var(--cs-space-4)" }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <FormField label="Provider" mono style={{ minWidth: "14ch" }}>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ByokProvider)}
            >
              {BYOK_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            label="Secret API key"
            mono
            style={{ flex: 1, minWidth: "28ch" }}
          >
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…"
              maxLength={500}
            />
          </FormField>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Validating…" : "Save & validate"}
          </Button>
        </div>

        <p
          className="cs-muted"
          style={{ fontSize: "var(--cs-text-xs)", margin: 0 }}
        >
          Your usage is billed by your provider — no Caisson credits are charged
          for bring-your-own-key lanes. The key is validated live, stored
          encrypted, and never shown again.
        </p>

        {state.kind === "ok" && (
          <p
            style={{
              fontSize: "var(--cs-text-sm)",
              color: "var(--cs-success)",
              margin: 0,
            }}
          >
            Connected — key stored ({state.masked}).
          </p>
        )}
        {state.kind === "error" && (
          <p
            role="alert"
            style={{
              fontSize: "var(--cs-text-sm)",
              color: "var(--cs-danger)",
              margin: 0,
            }}
          >
            {state.reason}
          </p>
        )}
      </form>
    </Card>
  );
}
