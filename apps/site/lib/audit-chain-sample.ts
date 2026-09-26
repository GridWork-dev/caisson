// The shared REAL sample hash chain (extracted from audit-worm-demo.tsx so the Living Chain
// moment and the marketplace media slide render the same genuine data). Computed once by
// @caisson-sh/kernel `buildChain` (each hash is SHA-256 over [prevHash, canonical(payload)]) and
// `verifyChain` (the verdict), then baked as static data — the kernel is NOT imported at runtime
// because its barrel pulls node-only code (ssrf → node:dns) that cannot enter the browser bundle.
// Regenerate with the same payloads if the sample changes.
import type { AuditChainEntry, ChainVerification } from "@caisson-sh/kernel";

export const CHAIN_ENTRIES: readonly AuditChainEntry[] = [
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
      package: "@caisson-sh/audit-worm",
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

export const CHAIN_VERIFICATION: ChainVerification = {
  valid: true,
  brokenAt: null,
};

/** Short display form of a 64-hex hash: `9a79…e085`. */
export function shortHash(hash: string): string {
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`;
}

/** The payload's event name for display (kernel types payload as nullable JSON). */
export function eventName(entry: AuditChainEntry): string {
  const p = entry.payload;
  if (p !== null && typeof p === "object" && "event" in p) {
    return String((p as Record<string, unknown>)["event"]);
  }
  return "—";
}

// The ADR-0331 per-row verification state vocabulary (six states). The Living Chain moment is
// SWAP-READY per the ADR-0331 sequencing gate: its cards are typed against this union but the
// demo only ever renders `genesis`/`pending` plus honest chain-consistency copy — the
// anchor-aware states light up when the per-row verification feature ships a real proof bundle.
export type ChainRowState =
  | "verified"
  | "anchor-confirmed-original-not-disclosed"
  | "tampered"
  | "unverifiable"
  | "pending"
  | "genesis";
