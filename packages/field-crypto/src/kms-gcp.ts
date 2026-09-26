// src/kms-gcp.ts — the real GCP Cloud KMS `KmsClient` driver (ADR-0171 pre-authorized: "GCP KMS...
// implement the same three methods and are equally drop-in behind the KmsClient port", kms.ts:279-282),
// wiring kms.ts's documented seam over the official `@google-cloud/kms` client. Mirrors kms-aws.ts's
// injected-config / `ConfigError` fail-closed factory shape exactly — same raw-vendor-SDK call (not
// REST): GCP's Node client already resolves Application Default Credentials internally the same way
// the AWS SDK resolves its default credential chain, so hand-rolling a REST+OAuth2 token exchange
// would only re-implement what the official client does for free.
//
// GCP KMS HAS NO GenerateDataKey RPC (unlike AWS): envelope encryption there is BYO-DEK — mint the
// 32-byte plaintext DEK locally (same as `LocalKmsClient`) and call `Encrypt` on the CryptoKey to get
// the wrapped form back. `Encrypt`/`Decrypt` address a CryptoKey resource (GCP auto-picks the primary
// version to encrypt with, and auto-detects the version from the ciphertext to decrypt) — there is no
// per-call version to choose for those two ops. Only destroy is version-scoped:
// `DestroyCryptoKeyVersion` schedules deletion of ONE CryptoKeyVersion (GCP CryptoKeys/KeyRings
// themselves can never be deleted, only their versions). A crypto-shred therefore LISTS the
// CryptoKey's versions and destroys EVERY live (ENABLED/DISABLED) one — destroying a single
// configured version would leave a rotated key's older versions decryptable while reporting
// success (silently incomplete tenant crypto-erasure).
//
// PER-TENANT CMK (mirrors ADR-0197). The port's per-call `keyId` IS the CryptoKey resource name for
// that tenant, falling back to the configured default (`config.cryptoKeyName`) ONLY when the per-call
// scope is empty — same rule as kms-aws.ts's `cmkFor`.
//
// TENANT BINDING. Each Encrypt/Decrypt call sets `additionalAuthenticatedData` binding the scope
// (GCP's raw-bytes AAD is the analog of AWS's `EncryptionContext` map / this package's own GCM AAD in
// aad.ts): a DEK wrapped for tenant A cannot be unwrapped in tenant B's context even on a shared
// CryptoKey.
//
// Mapping (per kms.ts's documented seam comment, kms.ts:279-282):
//   generateDataKey(keyId)      -> local randomBytes(32) DEK, then Encrypt({ name: cryptoKeyFor(keyId), plaintext, additionalAuthenticatedData })
//   decryptDataKey(keyId, blob) -> Decrypt({ name: cryptoKeyFor(keyId), ciphertext: blob, additionalAuthenticatedData })
//   scheduleKeyDeletion(keyId)  -> ListCryptoKeyVersions({ parent: cryptoKeyFor(keyId) }) then DestroyCryptoKeyVersion on every live version  // empty keyId throws
//
// The default `cryptoKeyName` is injected via `config`, never a module constant; a missing default
// fails closed with `ConfigError` at construction, not at the first call. Tests inject a fake
// `client` (a `Pick<KeyManagementServiceClient, "encrypt"|"decrypt"|"destroyCryptoKeyVersion"|
// "listCryptoKeyVersions">`), so `bun test` never reaches GCP.
import { randomBytes } from "node:crypto";
import { KeyManagementServiceClient, protos } from "@google-cloud/kms";
import {
  ConfigError,
  InternalError,
  ValidationError,
} from "@caisson-sh/kernel";
import { withKmsOperationBudget } from "./kms-budget.ts";
import type {
  KmsClient,
  KmsDeletionReceipt,
  KmsOperationOptions,
} from "./kms-port.ts";

/**
 * The injected GCP KMS transport — only the three RPCs this driver calls, collapsed to a `Pick<>`
 * (mirrors `KmsSendable` in kms-aws.ts; GCP's client has no single dispatch method to collapse to, so
 * this picks the three named methods instead of one `send`). Production supplies a real
 * `KeyManagementServiceClient`; tests inject a fake so no call reaches GCP.
 */
export type GcpKmsSendable = Pick<
  KeyManagementServiceClient,
  "encrypt" | "decrypt" | "destroyCryptoKeyVersion" | "listCryptoKeyVersions"
>;

export interface GcpKmsClientConfig {
  /**
   * The DEFAULT CryptoKey resource name — used only when a call passes no per-tenant scope `keyId`.
   * Full path shape: `projects/<project>/locations/<location>/keyRings/<ring>/cryptoKeys/<key>`.
   */
  cryptoKeyName: string;
  /** Override the underlying KMS transport. Tests inject a fake here so no call reaches GCP. */
  client?: GcpKmsSendable;
}

/** CryptoKeyVersion states that still hold usable (or re-enablable) key material — the versions a
 *  crypto-shred must destroy. GAX may surface the proto enum as its string name or its number;
 *  match both. */
const LIVE_VERSION_STATES = new Set<string | number>([
  "ENABLED",
  protos.google.cloud.kms.v1.CryptoKeyVersion.CryptoKeyVersionState.ENABLED,
  "DISABLED",
  protos.google.cloud.kms.v1.CryptoKeyVersion.CryptoKeyVersionState.DISABLED,
]);
const DESTROY_SCHEDULED_VERSION_STATES = new Set<string | number>([
  "DESTROY_SCHEDULED",
  protos.google.cloud.kms.v1.CryptoKeyVersion.CryptoKeyVersionState
    .DESTROY_SCHEDULED,
]);
const DESTROYED_VERSION_STATES = new Set<string | number>([
  "DESTROYED",
  protos.google.cloud.kms.v1.CryptoKeyVersion.CryptoKeyVersionState.DESTROYED,
]);

function timestampToIso(timestamp: unknown): string | undefined {
  if (typeof timestamp !== "object" || timestamp === null) return undefined;
  const seconds = Reflect.get(timestamp, "seconds");
  const nanos = Reflect.get(timestamp, "nanos");
  if (seconds === undefined || seconds === null) return undefined;
  const secondsNumber = Number(String(seconds));
  const nanosNumber =
    nanos === undefined || nanos === null ? 0 : Number(String(nanos));
  const milliseconds = secondsNumber * 1_000 + nanosNumber / 1_000_000;
  if (!Number.isFinite(milliseconds)) return undefined;
  return new Date(milliseconds).toISOString();
}

/**
 * The `additionalAuthenticatedData` binding a wrapped DEK to its tenant/subject scope — mirrors
 * `scopeContext`'s `EncryptionContext` in kms-aws.ts and the GCM AAD in aad.ts. A blob generated
 * under one scope's AAD fails `Decrypt` under another's.
 */
function scopeAad(keyId: string): Buffer {
  return Buffer.from(`caisson:field-crypto:scope=${keyId}`, "utf8");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason ?? new Error("field-crypto: GCP KMS operation aborted");
  }
}

function assertCryptoKeyVersionName(
  name: unknown,
  parent: string,
): asserts name is string {
  const prefix = `${parent}/cryptoKeyVersions/`;
  if (
    typeof name !== "string" ||
    !name.startsWith(prefix) ||
    !/^[1-9]\d*$/.test(name.slice(prefix.length))
  ) {
    throw new InternalError(
      "field-crypto: GCP KMS returned a CryptoKeyVersion outside the requested CryptoKey",
      { parent },
    );
  }
}

/** The real GCP Cloud KMS `KmsClient` (ADR-0171) — see the module-level mapping comment for the three ops. */
export function createGcpKmsClient(config: GcpKmsClientConfig): KmsClient {
  if (config.cryptoKeyName === undefined || config.cryptoKeyName.length === 0) {
    throw new ConfigError(
      "createGcpKmsClient requires a default `cryptoKeyName`",
    );
  }
  const defaultCryptoKeyName = config.cryptoKeyName;
  const sdk: GcpKmsSendable = config.client ?? new KeyManagementServiceClient();

  // The CryptoKey a call targets: the per-tenant scope `keyId`, or the default CryptoKey when none is passed.
  const cryptoKeyFor = (keyId: string): string =>
    keyId.length > 0 ? keyId : defaultCryptoKeyName;

  return {
    async generateDataKey(
      keyId: string,
      options?: KmsOperationOptions,
    ): Promise<{ plaintextKey: Buffer; wrappedKey: Buffer }> {
      const plaintextKey = randomBytes(32);
      let succeeded = false;
      try {
        const [{ ciphertext }] = await withKmsOperationBudget(
          options,
          (_abortSignal, remainingTimeoutMs) =>
            sdk.encrypt(
              {
                name: cryptoKeyFor(keyId),
                plaintext: plaintextKey,
                additionalAuthenticatedData: scopeAad(keyId),
              },
              { timeout: remainingTimeoutMs() },
            ),
        );
        if (
          !(ciphertext instanceof Uint8Array) ||
          ciphertext.byteLength === 0
        ) {
          throw new InternalError(
            "field-crypto: GCP KMS Encrypt returned no ciphertext: wrapped ciphertext must be non-empty",
          );
        }
        const wrappedKey = Buffer.from(ciphertext);
        succeeded = true;
        return { plaintextKey, wrappedKey };
      } finally {
        if (!succeeded) plaintextKey.fill(0);
      }
    },

    async decryptDataKey(
      keyId: string,
      wrappedKey: Buffer,
      options?: KmsOperationOptions,
    ): Promise<Buffer> {
      return withKmsOperationBudget(
        options,
        (abortSignal, remainingTimeoutMs) =>
          sdk
            .decrypt(
              {
                name: cryptoKeyFor(keyId),
                ciphertext: wrappedKey,
                additionalAuthenticatedData: scopeAad(keyId),
              },
              { timeout: remainingTimeoutMs() },
            )
            .then(([result]) => {
              const { plaintext } = result;
              if (!(plaintext instanceof Uint8Array)) {
                throw new InternalError(
                  "field-crypto: GCP KMS Decrypt returned no plaintext",
                );
              }
              try {
                if (plaintext.byteLength !== 32) {
                  throw new InternalError(
                    "field-crypto: GCP KMS Decrypt returned a DEK that is not 32-byte AES-256 material",
                  );
                }
                throwIfAborted(abortSignal);
                return Buffer.from(plaintext);
              } finally {
                plaintext.fill(0);
              }
            }),
      );
    },

    async scheduleKeyDeletion(keyId: string): Promise<KmsDeletionReceipt> {
      // Refuse an empty scope: falling back to the default CryptoKey here would destroy its
      // versions for EVERY tenant that shares it as their fallback.
      if (keyId.length === 0) {
        throw new ValidationError(
          "field-crypto: GCP KMS scheduleKeyDeletion requires an explicit keyId — refusing to destroy the default CryptoKey's versions",
        );
      }
      // Crypto-shred must destroy EVERY live version, not just one: a rotated CryptoKey holds
      // older versions whose wrapped DEKs would otherwise stay decryptable while the call reports
      // success (silently incomplete tenant crypto-erasure). List, then destroy each live version.
      const parent = cryptoKeyFor(keyId);
      const versions: protos.google.cloud.kms.v1.ICryptoKeyVersion[] = [];
      let pageRequest: protos.google.cloud.kms.v1.IListCryptoKeyVersionsRequest | null =
        { parent };
      while (pageRequest !== null) {
        const pageResult: [
          protos.google.cloud.kms.v1.ICryptoKeyVersion[],
          protos.google.cloud.kms.v1.IListCryptoKeyVersionsRequest | null,
          protos.google.cloud.kms.v1.IListCryptoKeyVersionsResponse,
        ] = await sdk.listCryptoKeyVersions(pageRequest, {
          autoPaginate: false,
        });
        const [pageVersions, nextPageRequest] = pageResult;
        versions.push(...pageVersions);
        if (nextPageRequest === null) {
          pageRequest = null;
        } else if (
          typeof nextPageRequest.pageToken === "string" &&
          nextPageRequest.pageToken.length > 0
        ) {
          pageRequest = { parent, pageToken: nextPageRequest.pageToken };
        } else {
          throw new InternalError(
            "field-crypto: GCP KMS pagination returned an invalid next-page request",
          );
        }
      }
      if (versions.length === 0) {
        throw new InternalError(
          "field-crypto: GCP KMS crypto-shred found no CryptoKeyVersions — a CryptoKey always has at least one; refusing to report an erasure that touched nothing",
          { cryptoKeyName: parent },
        );
      }
      const liveNames: string[] = [];
      let sawScheduled = false;
      let sawDestroyed = false;
      let destroyedFinalityProved = true;
      const scheduledFor: string[] = [];
      const seenNames = new Set<string>();
      for (const v of versions) {
        if (v.state === undefined || v.state === null) {
          throw new InternalError(
            "field-crypto: GCP KMS returned a CryptoKeyVersion without a provable name/state",
          );
        }
        assertCryptoKeyVersionName(v.name, parent);
        if (seenNames.has(v.name)) {
          throw new InternalError(
            "field-crypto: GCP KMS returned a duplicate CryptoKeyVersion",
            { name: v.name },
          );
        }
        seenNames.add(v.name);
        if (LIVE_VERSION_STATES.has(v.state)) {
          liveNames.push(v.name);
        } else if (DESTROY_SCHEDULED_VERSION_STATES.has(v.state)) {
          sawScheduled = true;
          const date = timestampToIso(v.destroyTime);
          if (date !== undefined) scheduledFor.push(date);
        } else if (DESTROYED_VERSION_STATES.has(v.state)) {
          sawDestroyed = true;
          destroyedFinalityProved &&= v.reimportEligible === false;
        } else {
          throw new InternalError(
            "field-crypto: GCP KMS returned a CryptoKeyVersion state that cannot prove destruction",
            { state: String(v.state) },
          );
        }
      }
      for (const name of liveNames) {
        const [version] = await sdk.destroyCryptoKeyVersion({ name });
        if (version.name !== name) {
          throw new InternalError(
            "field-crypto: GCP KMS DestroyCryptoKeyVersion returned an unexpected CryptoKeyVersion",
            { expected: name },
          );
        }
        if (
          version.state !== undefined &&
          version.state !== null &&
          DESTROY_SCHEDULED_VERSION_STATES.has(version.state)
        ) {
          sawScheduled = true;
          const date = timestampToIso(version.destroyTime);
          if (date !== undefined) scheduledFor.push(date);
        } else if (
          version.state !== undefined &&
          version.state !== null &&
          DESTROYED_VERSION_STATES.has(version.state)
        ) {
          sawDestroyed = true;
          destroyedFinalityProved &&= version.reimportEligible === false;
        } else {
          throw new InternalError(
            "field-crypto: GCP KMS DestroyCryptoKeyVersion did not prove DESTROY_SCHEDULED or DESTROYED",
          );
        }
      }
      if (sawScheduled) {
        const latest = scheduledFor.sort().at(-1);
        return latest === undefined
          ? { state: "destroy-scheduled", irreversible: false }
          : {
              state: "destroy-scheduled",
              irreversible: false,
              scheduledFor: latest,
            };
      }
      if (sawDestroyed) {
        if (!destroyedFinalityProved) {
          throw new InternalError(
            "field-crypto: GCP KMS DESTROYED state did not prove that external key material is non-re-importable",
          );
        }
        return { state: "destroyed", irreversible: true };
      }
      throw new InternalError(
        "field-crypto: GCP KMS crypto-shred returned no provable destruction state",
      );
    },
  };
}
