---
"@caisson-sh/alerting": patch
"@caisson-sh/local-inference": patch
---

Trailing slashes on a configured base URL are trimmed with a plain scan instead of a regular
expression, which took quadratic time on a long run of slashes. This covers the Telegram channel's
`botApiUrl` and the OpenRouter and Azure OpenAI transports' base URLs.
