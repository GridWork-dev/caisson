// Entitlement-token scan (P0 audit remediation). The invariant under test: a license-token-shaped
// string under packages/*/src/__golden__/ or apps/*/app/demo/ is an ERROR unless it verifies
// against the DOCUMENTED dev test keypair — a real (prod-signed) entitlement token must never be
// committed, because the token IS the entitlement (offline verify has no revocation list).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, createPrivateKey, sign as cryptoSign } from "node:crypto";
import { checkEntitlementTokenScan } from "./checks";

/** Mint a wire-shaped token signed by the given seed string (dev seed or an attacker seed). */
function mintToken(seedText: string, payloadJson: string): string {
  const key = createPrivateKey({
    key: Buffer.concat([
      Buffer.from("302e020100300506032b657004220420", "hex"),
      createHash("sha256").update(seedText).digest(),
    ]),
    format: "der",
    type: "pkcs8",
  });
  const payload = Buffer.from(payloadJson, "utf8");
  const signature = cryptoSign(null, payload, key);
  return `CAISSON-PRO-${Buffer.concat([payload, signature]).toString("base64url")}`;
}

const DEV_SEED_TEXT = "caisson-license-verify-KAT-seed-v1";
const CLAIMS = `{"entitlements":["local-ai"],"expiry":null,"licenseId":"f47ac10b-58cc-4372-a567-0e02b2c3d479","major":1,"tier":"pro"}`;

describe("checkEntitlementTokenScan", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "standards-gate-token-scan-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const goldenDir = () => {
    const dir = join(root, "packages/example/src/__golden__");
    mkdirSync(dir, { recursive: true });
    return dir;
  };
  const demoDir = () => {
    const dir = join(root, "apps/example/app/demo");
    mkdirSync(dir, { recursive: true });
    return dir;
  };

  test("a NON-dev-signed token in a golden fixture is an error", () => {
    const rogue = mintToken("not-the-dev-seed-at-all", CLAIMS);
    writeFileSync(
      join(goldenDir(), "signed-token.json"),
      JSON.stringify({ token: rogue }),
    );
    const findings = checkEntitlementTokenScan(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("entitlement-token-scan");
    expect(findings[0]?.severity).toBe("error");
    expect(findings[0]?.pkg).toBe("packages/example");
  });

  test("a dev-signed token in a golden fixture is exempt", () => {
    const dev = mintToken(DEV_SEED_TEXT, CLAIMS);
    writeFileSync(
      join(goldenDir(), "signed-token.json"),
      JSON.stringify({ token: dev }),
    );
    expect(checkEntitlementTokenScan(root)).toHaveLength(0);
  });

  test("a NON-dev-signed token in a reference-app demo is an error", () => {
    const rogue = mintToken("another-rogue-seed", CLAIMS);
    writeFileSync(
      join(demoDir(), "pipeline.ts"),
      `const PRO_TOKEN = "${rogue}";\n`,
    );
    const findings = checkEntitlementTokenScan(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.pkg).toBe("apps/example");
  });

  test("a tampered dev-signed token (flipped signature tail) is an error, not exempt", () => {
    const dev = mintToken(DEV_SEED_TEXT, CLAIMS);
    const tampered = dev.slice(0, -1) + (dev.endsWith("Q") ? "R" : "Q");
    writeFileSync(join(demoDir(), "tampered.ts"), `const T = "${tampered}";\n`);
    const findings = checkEntitlementTokenScan(root);
    expect(findings).toHaveLength(1);
  });

  test("prose and short strings never match — empty repo areas return no findings", () => {
    writeFileSync(
      join(goldenDir(), "readme.md"),
      "CAISSON-PRO tokens are described here but no token appears.\n",
    );
    expect(checkEntitlementTokenScan(root)).toHaveLength(0);
  });
});
