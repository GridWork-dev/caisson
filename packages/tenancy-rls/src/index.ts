// Buyer tenant-isolation floor only. The admin-WRITE seam moved to @caisson/org-controls (ADR-0257 §1.3).
export {
  TENANT_GUC,
  USER_GUC,
  withTenant,
  withUser,
  buildTenantPolicySql,
} from "./rls.ts";
export type { TenantExecutor, Transactor, TenantPolicyOptions } from "./rls.ts";
export { createSupabaseTransactor } from "./supabase.ts";
export type { SupabaseTransactorConfig } from "./supabase.ts";
