"use client";

// The audit-worm module's `component` media slide (ADR-0306 full-depth) — the module's own shipped
// surface `@caisson/audit-worm/ui` <ChainViewer>, rendered live over a REAL hash chain. The entries
// below were computed once by @caisson/kernel `buildChain` (each hash is SHA-256 over
// [prevHash, canonical(payload)]) and `verifyChain` (the verdict), then baked as static data — the
// kernel is NOT imported at runtime here, because its barrel pulls node-only code (ssrf → node:dns)
// that cannot enter the browser bundle. So the buyer sees the shipped component over a genuine,
// verifiable chain, not a mock. Presentational still-frame — no paging props wired. Loaded via
// next/dynamic (ssr: false) so this commercial-tier tree never lands in the shared client bundle.
// Sources: packages/audit-worm/src/ui/chain-viewer.tsx · packages/kernel/src/audit-chain.ts.
import { ChainViewer } from "@caisson/audit-worm/ui";
import type { AuditChainEntry, ChainVerification } from "@caisson/kernel";

import { MediaFrame } from "./media-frame";

// Real kernel-built chain (buildChain output) — genuine SHA-256 links, regenerate with the same
// payloads if the sample changes.
const ENTRIES: readonly AuditChainEntry[] = [
  {
    seq: 0,
    prevHash: null,
    payload: {
      event: "license.issued",
      licenseId: "lic_8a2f",
      actor: "system",
    },
    hash: "9a79093302a495ef273674f9feaf0fc0c6f5db8ab5b91a973f5e87519822e085",
  },
  {
    seq: 1,
    prevHash:
      "9a79093302a495ef273674f9feaf0fc0c6f5db8ab5b91a973f5e87519822e085",
    payload: {
      event: "entitlement.granted",
      module: "audit-worm",
      actor: "admin",
    },
    hash: "84a1913b107ee8dfd15a8b9f47fa483f50a14e01acac81e40919cb3a7a51ebd4",
  },
  {
    seq: 2,
    prevHash:
      "84a1913b107ee8dfd15a8b9f47fa483f50a14e01acac81e40919cb3a7a51ebd4",
    payload: {
      event: "registry.pull",
      package: "@caisson/audit-worm",
      actor: "acme-co",
    },
    hash: "2462835b846566ae467a81aa816e7bc72443df7c21b75b87888422302bb46643",
  },
  {
    seq: 3,
    prevHash:
      "2462835b846566ae467a81aa816e7bc72443df7c21b75b87888422302bb46643",
    payload: {
      event: "evidence.exported",
      pack: "soc2-2026q3",
      actor: "auditor",
    },
    hash: "130a6cbb8810e1b77986044e3f6e4917a1527ce2871c004e0b5192a4480c7b21",
  },
];
const VERIFICATION: ChainVerification = { valid: true, brokenAt: null };

export default function AuditWormDemo() {
  return (
    <MediaFrame label="ChainViewer">
      <div style={{ padding: "var(--cs-space-6)" }}>
        <ChainViewer entries={ENTRIES} verification={VERIFICATION} />
      </div>
    </MediaFrame>
  );
}
