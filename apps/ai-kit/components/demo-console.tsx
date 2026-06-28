"use client";

import { useState } from "react";

// The buyer-facing demo trigger. Each button POSTs to the matching route handler, which drives the
// real @caisson/ai-kit gateway server-side against the embedded store + mock model and returns the
// settled result as JSON. No model key, no network egress — the whole pipeline runs locally.
interface Action {
  readonly id: string;
  readonly label: string;
  readonly blurb: string;
}

const ACTIONS: readonly Action[] = [
  {
    id: "metered",
    label: "Run a metered call",
    blurb: "resolve greet@1 → reserve → call → reconcile to actual",
  },
  {
    id: "cap",
    label: "Trip the hard cap",
    blurb: "cross a per-tenant hard cap → breaker → next call 402s",
  },
  {
    id: "guardrail",
    label: "Block a flagged input",
    blurb: "fail-closed moderation → GuardrailError 422, no spend",
  },
  {
    id: "empty-wallet",
    label: "Empty wallet → 402",
    blurb: "reserve before spend → 402 before the model is reached",
  },
];

export function DemoConsole() {
  const [pending, setPending] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [output, setOutput] = useState<string>("");

  async function run(id: string): Promise<void> {
    setPending(id);
    setActive(id);
    // Explicit AbortController timeout (the native AbortSignal.timeout helper is forbidden — same
    // floor as the server-side fetchWithTimeout, applied here without pulling kernel into the client).
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, 15_000);
    try {
      const res = await fetch(`/api/demo/${id}`, {
        method: "POST",
        signal: controller.signal,
      });
      const body: unknown = await res.json();
      setOutput(JSON.stringify(body, null, 2));
    } catch (err) {
      setOutput(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
      setPending(null);
    }
  }

  return (
    <section>
      <div className="scenarios">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={pending !== null}
            onClick={() => void run(a.id)}
            title={a.blurb}
          >
            {pending === a.id ? "running…" : a.label}
          </button>
        ))}
      </div>
      {output !== "" && (
        <div className="result">
          <strong>{active}</strong>
          <span className="tag">server-driven · mock model</span>
          <pre>{output}</pre>
        </div>
      )}
    </section>
  );
}
