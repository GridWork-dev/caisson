// TEST-ONLY dev-key license support for the worker tests (P1 remediation, PR #117 follow-up): mints
// license tokens AT RUNTIME with the DOCUMENTED deterministic dev keypair
// (SHA-256("caisson-license-verify-KAT-seed-v1"), the same seed the license-verify tests and the
// standards-gate entitlement-token-scan reconstruct), so NO prod-signed token string is ever
// committed — a real entitlement token IS the entitlement (offline verify has no revocation list),
// which is exactly the P0-incident class the issuer-key rotation closed. Imported ONLY by *.test.ts;
// never by shipped worker code (deploy-entry wires the baked-key default).
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  type KeyObject,
} from "node:crypto";
import { Ed25519Signer, issueLicense } from "@caisson/license-issue";
import {
  verifyLicenseWithKey,
  type VerifiedLicense,
} from "@caisson/license-verify";

const DEV_SEED = createHash("sha256")
  .update("caisson-license-verify-KAT-seed-v1")
  .digest();

// Ed25519 PKCS#8 DER = 16-byte fixed prefix ‖ 32-byte raw seed (RFC 8410).
const DEV_PRIVATE_KEY: KeyObject = createPrivateKey({
  key: Buffer.concat([
    Buffer.from("302e020100300506032b657004220420", "hex"),
    DEV_SEED,
  ]),
  format: "der",
  type: "pkcs8",
});

// Derived via the private key's PEM (`createPublicKey(KeyObject)`'s overload is absent from bun-types).
const DEV_PUBLIC_KEY: KeyObject = createPublicKey(
  DEV_PRIVATE_KEY.export({ format: "pem", type: "pkcs8" }),
);

/** The explicit-key verifier tests inject into `makeLicenseEntitlementResolver` / `buildResolver`. */
export const devVerify = (token: string): VerifiedLicense =>
  verifyLicenseWithKey(token, DEV_PUBLIC_KEY);

/** Mint a dev-signed wire token through the REAL issuer path (canonicalize → sign → encode). */
export const mintDevToken = (claims: unknown): Promise<string> =>
  issueLicense(new Ed25519Signer("dev-test", DEV_PRIVATE_KEY), claims);
