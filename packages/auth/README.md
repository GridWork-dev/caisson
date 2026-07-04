# @caisson/auth

Provider-agnostic authentication: short-lived EdDSA JWTs for account/session tokens, a
session contract any auth runtime can implement, and multi-user account membership
(owner/seat roles) scoped by row-level security.

- **Layer:** base

## Install

```bash
bun add @caisson/auth
```

## Use

```ts
import {
  requireSession,
  verifyAccountJwt,
  resolveUserAccounts,
} from "@caisson/auth";
```

better-auth is the reference session-provider implementation. The resolved `accountId` is
the only value the data layer trusts for tenant isolation — never raw user input.
