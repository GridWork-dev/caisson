import { createPublicKey, timingSafeEqual, type KeyObject } from "node:crypto";
import {
  ANCHOR_SIGNING_KEY_ENV,
  Ed25519AnchorSigner,
  type AnchorSigner,
} from "@caisson/audit-worm";
import { ConfigError } from "@caisson/kernel";
import type { PinnedAnchorKey } from "@caisson/kernel/audit-verify";

export const ANCHOR_PUBLIC_KEY_ENV = "CAISSON_ANCHOR_PUBLIC_KEY";

export interface AdminAuditAnchorTrust {
  readonly signer: AnchorSigner;
  readonly pinnedKey: PinnedAnchorKey;
}

function parsePublicKey(value: string): KeyObject {
  try {
    const key = createPublicKey({
      key: Buffer.from(value, "base64"),
      format: "der",
      type: "spki",
    });
    if (key.asymmetricKeyType !== "ed25519") {
      throw new Error("wrong key type");
    }
    return key;
  } catch {
    throw new ConfigError(
      `${ANCHOR_PUBLIC_KEY_ENV} must be base64-encoded Ed25519 SPKI DER`,
      { keys: [ANCHOR_PUBLIC_KEY_ENV] },
    );
  }
}

/**
 * Load the private signer and its independently configured public trust root as one fail-closed
 * composition. Dev/test may omit both for legacy fixtures; production requires both. Supplying only
 * one, a malformed key, or a public key that does not match the private signer is always an error.
 */
export function adminAuditAnchorTrustFromEnv(
  env: Record<string, string | undefined> = process.env,
): AdminAuditAnchorTrust | null {
  const privateConfigured =
    (env[ANCHOR_SIGNING_KEY_ENV]?.trim().length ?? 0) > 0;
  const publicValue = env[ANCHOR_PUBLIC_KEY_ENV]?.trim() ?? "";
  const publicConfigured = publicValue.length > 0;

  if (!privateConfigured && !publicConfigured) {
    if (env.NODE_ENV === "production") {
      throw new ConfigError(
        `${ANCHOR_SIGNING_KEY_ENV} and ${ANCHOR_PUBLIC_KEY_ENV} are required in production`,
        { keys: [ANCHOR_SIGNING_KEY_ENV, ANCHOR_PUBLIC_KEY_ENV] },
      );
    }
    return null;
  }
  if (!privateConfigured || !publicConfigured) {
    throw new ConfigError(
      `${ANCHOR_SIGNING_KEY_ENV} and ${ANCHOR_PUBLIC_KEY_ENV} must be configured together`,
      { keys: [ANCHOR_SIGNING_KEY_ENV, ANCHOR_PUBLIC_KEY_ENV] },
    );
  }

  const signer = Ed25519AnchorSigner.fromEnv(env);
  const configuredPublic = parsePublicKey(publicValue).export({
    format: "der",
    type: "spki",
  });
  const derivedPublic = Buffer.from(signer.publicKeySpkiBase64(), "base64");
  if (
    configuredPublic.length !== derivedPublic.length ||
    !timingSafeEqual(configuredPublic, derivedPublic)
  ) {
    throw new ConfigError(
      `${ANCHOR_PUBLIC_KEY_ENV} does not match ${ANCHOR_SIGNING_KEY_ENV}`,
      { keys: [ANCHOR_SIGNING_KEY_ENV, ANCHOR_PUBLIC_KEY_ENV] },
    );
  }

  return {
    signer,
    pinnedKey: {
      keyId: signer.keyId,
      publicKeySpkiBase64: configuredPublic.toString("base64"),
    },
  };
}
