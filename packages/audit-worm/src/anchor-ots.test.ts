// src/anchor-ots.test.ts — the OpenTimestamps drop-in (Fork R-γ, R9). Proves the SAME TransparencyLog
// port carries a very different (signature-free, Bitcoin-anchored) proof: the stub round-trips a
// digest → pending `PendingAttestation` receipt that is schema-valid as an `AnchorSubmitReceipt`, and
// the opt-in guard holds. No network.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { ValidationError } from "@caisson-sh/kernel";
import {
  anchorSubmitReceiptSchema,
  irreversiblePublicityOptIn,
  PUBLICITY_ACKNOWLEDGEMENT,
  type IrreversiblePublicityOptIn,
} from "./anchor-transparency.ts";
import { StubOpenTimestampsLog } from "./anchor-ots.ts";

const optIn = (): IrreversiblePublicityOptIn =>
  irreversiblePublicityOptIn({ acknowledgement: PUBLICITY_ACKNOWLEDGEMENT });
const ANCHOR = new TextEncoder().encode('{"length":9,"tipHash":"deadbeef"}');

describe("OpenTimestamps drop-in (Fork R-γ)", () => {
  test("stub submit returns a schema-valid pending OTS receipt bound to the digest", async () => {
    const log = new StubOpenTimestampsLog({ optIn: optIn() });
    const receipt = await log.submit(ANCHOR);
    // A valid member of the receipt union (so the checkpoint handler can persist it).
    const parsed = anchorSubmitReceiptSchema.parse(receipt);
    expect(parsed.algorithm).toBe("opentimestamps");
    if (parsed.algorithm !== "opentimestamps") throw new Error("unreachable");
    expect(parsed.status).toBe("pending");
    expect(parsed.messageImprint).toBe(
      createHash("sha256").update(ANCHOR).digest("hex"),
    );
    expect(parsed.calendars.length).toBeGreaterThan(0);
    expect(parsed.proof.length).toBeGreaterThan(0);
  });

  test("the stub refuses to construct without the irreversible-publicity opt-in", () => {
    const forged = {} as unknown as IrreversiblePublicityOptIn;
    expect(() => new StubOpenTimestampsLog({ optIn: forged })).toThrow(
      ValidationError,
    );
  });
});
