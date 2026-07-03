// live/grafana.live.test.ts — the LIVE Grafana Cloud query proof (seam 4, ADR-0224 / ADR-0207).
// The unit suite (apps/admin/src/lib/grafana.test.ts) proves the dormant-env short-circuit and the
// mapTraces/mapServiceNames pure mappers against canned payloads — it never touches the wire. THIS
// leg proves the one thing a double cannot: the real Grafana Cloud datasource proxy accepts the real
// `glsa_` query token and returns the fleet's own service names over the real Tempo `service.name`
// tag-values endpoint. A rotated/wrong-scoped query token (the `glc_` write token 401s here, ADR-0177)
// or a stale datasource UID passes every unit test and fails HERE.
//
// Read-only — pure query, no mutation, no teardown (the cheapest of the five seams). listServiceNames
// is module-private, so the proof drives it through the exported aggregator fetchOpsSnapshot(), whose
// service inventory IS listServiceNames() against the real proxy (grafana.ts fetchOpsSnapshot →
// listServiceNames). No product-code export was added.
//
// ADR-0201 convention: lives OUTSIDE ./src (default suite / CI / tarball never see it) AND self-skips
// unless all three query envs are set (the same grafanaEnv() gate the client itself reads).
import { describe, expect, test } from "bun:test";

import { fetchOpsSnapshot, grafanaConfigured } from "../src/lib/grafana.ts";

const HAVE_CREDS =
  (process.env.GRAFANA_URL ?? "").length > 0 &&
  (process.env.GRAFANA_QUERY_TOKEN ?? "").length > 0 &&
  (process.env.GRAFANA_TEMPO_DATASOURCE_UID ?? "").length > 0;
const liveTest = test.skipIf(!HAVE_CREDS);
const TIMEOUT = 30_000;

describe("Grafana Cloud query live proof — real Tempo service inventory (seam 4, ADR-0224)", () => {
  liveTest(
    "the real glsa_ token reaches the datasource proxy and lists the fleet's service names",
    async () => {
      // Sanity: the three query envs the client reads are present (mirrors the gate above).
      expect(grafanaConfigured()).toBe(true);

      const snapshot = await fetchOpsSnapshot();

      // configured=true only when the env gate passed AND the round-trip ran (fetchOpsSnapshot returns
      // the unconfigured empty snapshot otherwise) — proves the client took the live path, not the gate.
      expect(snapshot.configured).toBe(true);

      // The load-bearing assertion: the real proxy returned the fleet's own emitting services. A
      // dormant/401/empty response degrades to [] (proxyGet swallows to null → mapServiceNames → []),
      // so a non-empty inventory is the credential-works signal a rotated token would flip to red.
      expect(Array.isArray(snapshot.services)).toBe(true);
      expect(snapshot.services.length).toBeGreaterThan(0);
      for (const name of snapshot.services) {
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
      }
    },
    TIMEOUT,
  );
});
