---
"@caisson/tenancy-rls": minor
---

Added a Drizzle bridge (queryDrizzle/execDrizzle over any `.toSQL()`-shaped query) and a Prisma bridge (createPrismaBridge over a structural $queryRawUnsafe/$executeRawUnsafe facade), both feeding the unmodified TenantExecutor port inside withTenant. Neither adds a runtime dependency on drizzle-orm or @prisma/client.
