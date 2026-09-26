---
"@caisson/mcp-server": minor
---

The server no longer scopes tools by entitlement. Every registered tool is listed and callable by any authenticated caller, `list_modules` returns the whole catalog, `describe_module` returns the module's latest version and description, and `generate` takes a project name and modules. Bearer authentication is unchanged: tokens are still compared in constant time, and a missing or wrong token is refused. `BuyerToken` is now `{ token, accountId }`, and `requiredEntitlement` is gone from tool, resource and prompt registrations.
