// src/anchor-rekor-optin.test.ts — Fork D: strictly-opt-in public-log anchoring (R10). The security
// gate on IRREVERSIBLE public egress. Mirrors the store.s3 COMPLIANCE opt-in (ADR-0051): the only way
// to obtain the branded consent is the exact acknowledgement string, and `RekorAnchorLog` refuses to
// construct without it — so a public entry can never be minted by accident or default. TSA needs none.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ValidationError } from "@caisson-sh/kernel";
import {
  irreversiblePublicityOptIn,
  isIrreversiblePublicityOptIn,
  PUBLICITY_ACKNOWLEDGEMENT,
  type AnchorSubmissionSigner,
  type IrreversiblePublicityOptIn,
} from "./anchor-transparency.ts";
import { RekorAnchorLog } from "./anchor-rekor.ts";

const FIX = join(import.meta.dir, "__fixtures__", "rekor-v2");
const signingConfig = (): unknown =>
  JSON.parse(readFileSync(join(FIX, "signing_config.json"), "utf8"));
const trustedRoot = (): unknown =>
  JSON.parse(readFileSync(join(FIX, "trusted_root.json"), "utf8"));

// Construction never signs — only submit does — so a trivial fake signer (no crypto dep) suffices.
const signer: AnchorSubmissionSigner = {
  keyId: "test/anchoring/v1",
  algorithm: "ed25519ph",
  publicKey: () => Promise.resolve(new Uint8Array(32)),
  sign: () => Promise.resolve(new Uint8Array(64)),
};

const optIn = (): IrreversiblePublicityOptIn =>
  irreversiblePublicityOptIn({ acknowledgement: PUBLICITY_ACKNOWLEDGEMENT });

describe("irreversible-publicity opt-in (Fork D)", () => {
  test("mints only with the EXACT acknowledgement string", () => {
    expect(isIrreversiblePublicityOptIn(optIn())).toBe(true);
    expect(() =>
      irreversiblePublicityOptIn({ acknowledgement: "I agree" }),
    ).toThrow(ValidationError);
    expect(() =>
      irreversiblePublicityOptIn({
        acknowledgement: PUBLICITY_ACKNOWLEDGEMENT + " ",
      }),
    ).toThrow(ValidationError);
  });

  test("a forged/absent opt-in is rejected by the brand check", () => {
    expect(isIrreversiblePublicityOptIn({})).toBe(false);
    expect(isIrreversiblePublicityOptIn(null)).toBe(false);
    expect(isIrreversiblePublicityOptIn({ acknowledged: true })).toBe(false);
  });

  test("RekorAnchorLog constructs WITH a valid opt-in", () => {
    expect(
      () =>
        new RekorAnchorLog({
          signer,
          signingConfig: signingConfig(),
          trustedRoot: trustedRoot(),
          optIn: optIn(),
        }),
    ).not.toThrow();
  });

  test("RekorAnchorLog REFUSES a forged opt-in at runtime (untyped-JS belt)", () => {
    const forged = { fake: true } as unknown as IrreversiblePublicityOptIn;
    expect(
      () =>
        new RekorAnchorLog({
          signer,
          signingConfig: signingConfig(),
          trustedRoot: trustedRoot(),
          optIn: forged,
        }),
    ).toThrow(ValidationError);
  });

  test("RekorAnchorLog refuses a non-ed25519ph signer", () => {
    const badSigner = {
      ...signer,
      algorithm: "ed25519",
    } as unknown as AnchorSubmissionSigner;
    expect(
      () =>
        new RekorAnchorLog({
          signer: badSigner,
          signingConfig: signingConfig(),
          trustedRoot: trustedRoot(),
          optIn: optIn(),
        }),
    ).toThrow(ValidationError);
  });

  test("RekorAnchorLog refuses a sub-20s timeout (spike decision #7)", () => {
    expect(
      () =>
        new RekorAnchorLog({
          signer,
          signingConfig: signingConfig(),
          trustedRoot: trustedRoot(),
          optIn: optIn(),
          timeoutMs: 5_000,
        }),
    ).toThrow(ValidationError);
  });
});
