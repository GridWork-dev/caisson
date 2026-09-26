"use client";

// The audit-worm module's `component` media slide (ADR-0308 full-depth) — the module's own shipped
// surface `@caisson-sh/audit-worm/ui` <ChainViewer>, rendered live over a REAL hash chain. The entries
// below were computed once by @caisson-sh/kernel `buildChain` (each hash is SHA-256 over
// [prevHash, canonical(payload)]) and `verifyChain` (the verdict), then baked as static data — the
// kernel is NOT imported at runtime here, because its barrel pulls node-only code (ssrf → node:dns)
// that cannot enter the browser bundle. So the buyer sees the shipped component over a genuine,
// verifiable chain, not a mock. Presentational still-frame — no paging props wired. Loaded via
// next/dynamic (ssr: false) so this commercial-tier tree never lands in the shared client bundle.
// Sources: packages/audit-worm/src/ui/chain-viewer.tsx · packages/kernel/src/audit-chain.ts.
import { ChainViewer } from "@caisson-sh/audit-worm/ui";

import { CHAIN_ENTRIES, CHAIN_VERIFICATION } from "@/lib/audit-chain-sample";
import { MediaFrame } from "./media-frame";

// Real kernel-built chain (buildChain output) — genuine SHA-256 links, shared with the Living
// Chain moment via lib/audit-chain-sample.ts.

export default function AuditWormDemo() {
  return (
    <MediaFrame label="Audit chain">
      <div style={{ padding: "var(--cs-space-6)" }}>
        <ChainViewer
          entries={CHAIN_ENTRIES}
          verification={CHAIN_VERIFICATION}
        />
      </div>
    </MediaFrame>
  );
}
