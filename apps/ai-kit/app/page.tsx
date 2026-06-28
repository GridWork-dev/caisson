import { DemoConsole } from "@/components/demo-console";

const PIPELINE = [
  "resolve",
  "render",
  "input-guard",
  "reserve (402)",
  "provider call",
  "record usage",
  "output-guard",
  "reconcile",
];

export default function Home() {
  return (
    <>
      <h1>Caisson · AI Production Kit</h1>
      <p className="lede">
        One metered <code>infer()</code> gateway is the enforced chokepoint for
        every AI feature: token metering, hard spend caps + a runaway-loop
        circuit breaker, versioned injection-safe prompts, and fail-closed
        guardrails — by construction, not by discipline.
      </p>

      <ol className="pipeline">
        {PIPELINE.map((step, i) => (
          <li key={step}>
            {i + 1}. {step}
          </li>
        ))}
      </ol>

      <DemoConsole />

      <p className="note">
        Every demo runs the real <code>@caisson/ai-kit</code> gateway
        server-side against an embedded PGlite store and a test-doubled model —
        zero network, zero provider secret. A buyer swaps the injected model for{" "}
        <code>buildRegistryResolver</code> over the real provider adapters and
        points the transactor at their Postgres; the gateway code above is
        unchanged.
      </p>
    </>
  );
}
