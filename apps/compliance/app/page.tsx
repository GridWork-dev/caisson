import type { ReactNode } from "react";

// A static server component — the thin reference shell (NO dashboard, P2-19a). It describes the leg
// and links to the live runner; it never touches the database at render time, so the build stays a
// pure compile. The runnable end-to-end proof is the `/api/leg` route handler + `lib/leg.test.ts`.
export default function Home(): ReactNode {
  const steps = [
    "Seed a tenant and write an encrypted SEC/HIPAA field under withTenantCrypto (crypto nested inside the RLS scope).",
    "Lock an append-only versioned artifact into WORM storage with a SHA-256 audit-chain anchor.",
    "Gather real substrate facts, generate a deterministic control→evidence pack, validate it against the format contract, sign it per-tenant, and emit an operational event.",
    "Prove flag-never-guess: an unresolved control blocks generation with no partial pack.",
  ];

  return (
    <main>
      <h1>Caisson — Compliance edition</h1>
      <p>
        A thin Next.js App Router reference app that runs the Compliance leg end
        to end over a fully test-doubled substrate (embedded Postgres, a local
        WORM store, derived field keys) — no live cloud.
      </p>
      <h2>The leg</h2>
      <ol>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <h2>Run it</h2>
      <p>
        Hit <a href="/api/leg">/api/leg</a> to execute the leg and return a
        structured report of the four exit checks. The byte-stable evidence
        manifest is golden-pinned by the integration test (
        <code>bun test apps/compliance</code>).
      </p>
    </main>
  );
}
