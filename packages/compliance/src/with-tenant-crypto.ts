// withTenantCrypto — the single seam where the RLS tenant boundary and the field-crypto boundary
// become ONE boundary (ADR-0005/0055). It nests the field-crypto context INSIDE
// the RLS transaction: `withTenant(db, accountId, …)` opens the tenant-scoped transaction (SET ROLE
// app + bind `app.current_account`), and within it `withFieldCryptoContext(derivedContext(provider,
// accountId), …)` binds the SAME `accountId` into the synchronous crypto context the encrypted
// column reads. Product code runs its tenant work inside `fn`; any encrypted-column read/write is
// then automatically scoped to that one tenant.
//
// WHY HERE, WHY NESTED: field-crypto stays kernel-only (ADR-0003) — it must NOT import tenancy-rls —
// so the wiring that joins the two lives in the edition that composes both (down-only). The nesting
// is load-bearing: the crypto context lives for exactly the life of the RLS transaction, never
// beyond it, so a value can never be sealed/opened outside a bound tenant scope.
//
// FAIL-CLOSED ON EITHER HALF (the encryption boundary EQUALS the RLS boundary):
//   - No `withTenant` → no GUC bound → an INSERT/SELECT on a tenant table is refused by RLS
//     (WITH CHECK / USING evaluates against a NULL account) — the row never lands.
//   - No `withFieldCryptoContext` → `currentFieldCryptoContext()` throws — an encrypted column
//     refuses to seal/open. Encryption never happens outside a tenant scope.
// Because BOTH ids derive from the one `accountId` argument, the crypto context can never be bound to
// a different tenant than the RLS scope — the boundary == boundary invariant is structural, not a
// convention a caller can drift from.
import {
  type TenantExecutor,
  type Transactor,
  withTenant,
} from "@caisson-sh/tenancy-rls";
import {
  derivedContext,
  type SyncFieldKeyProvider,
  withFieldCryptoContext,
} from "@caisson-sh/field-crypto";

/**
 * Run `fn` inside a transaction that is BOTH tenant-RLS-scoped and field-crypto-scoped to
 * `accountId`. `withTenant` opens the transaction and drops to the `app` role with the tenant GUC
 * bound; `withFieldCryptoContext(derivedContext(provider, accountId))` binds the synchronous crypto
 * context for the life of that transaction. `accountId` MUST come from a verified session/JWT
 * (ADR-0015), never request params — an empty id is refused by `withTenant` (fail-closed).
 *
 * @param provider the synchronous tenant-key provider (e.g. `DerivedKeyProvider`) — its key
 *   derivation backs the encrypted-column hot path inside `fn`.
 */
export async function withTenantCrypto<T>(
  db: Transactor,
  accountId: string,
  provider: SyncFieldKeyProvider,
  fn: (tx: TenantExecutor) => Promise<T>,
): Promise<T> {
  return withTenant(db, accountId, (tx) =>
    // The crypto context carries the SAME accountId and lives only inside this RLS transaction.
    withFieldCryptoContext(derivedContext(provider, accountId), () => fn(tx)),
  );
}
