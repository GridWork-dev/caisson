// live/tsa.live.test.ts — the LIVE RFC-3161 proof for TsaAnchorLog (ADR-0346 P2). Runs the REAL DER
// TimeStampReq -> HTTP -> TimeStampResp/TSTInfo round-trip the deterministic stub can never vouch for.
//
// This file NEVER runs in the default suite: it lives OUTSIDE ./src (so `bun test ./src` and CI never
// run it) AND self-skips without a real TSA endpoint (ADR-0201 live-test convention). Run it via
// `bun run test:live` with CAISSON_TSA_LIVE_URL set to a real RFC-3161 endpoint, e.g.
//   CAISSON_TSA_LIVE_URL=https://freetsa.org/tsr bun run --filter @caisson-sh/audit-worm test:live
// Egress is imprint-only (a sha256, no payload) — safe against any public TSA.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { sha256Hex, TsaAnchorLog } from "../src/anchor-transparency.ts";

setDefaultTimeout(30_000);

const TSA_URL = process.env.CAISSON_TSA_LIVE_URL ?? "";
const liveTest = test.skipIf(TSA_URL.length === 0);

describe("TsaAnchorLog — live RFC-3161 round-trip", () => {
  liveTest(
    "submits an imprint and gets a granted, imprint-matching receipt",
    async () => {
      // A fresh per-run anchor byte-string so the imprint is unique to this run.
      const anchorBytes = new TextEncoder().encode(
        `{"length":1,"tipHash":"${randomUUID()}"}`,
      );
      const log = new TsaAnchorLog({ url: TSA_URL });
      const receipt = await log.submit(anchorBytes);

      expect(receipt.algorithm).toBe("rfc3161");
      expect(receipt.hashAlgorithm).toBe("sha256");
      // the TSA must have attested the exact imprint we submitted
      expect(receipt.messageImprint).toBe(sha256Hex(anchorBytes));
      // a real DER TimeStampToken, base64-encoded, and a parseable genTime
      expect(receipt.token.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(receipt.timestampedAt))).toBe(false);
    },
  );
});
