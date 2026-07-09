---
"@caisson/email": minor
"@caisson/admin": patch
---

Move EMAIL_SAMPLE_DATA + isEmailTemplateId into @caisson/email as public exports (single source
for the admin catalog preview, the send-test route, and the visual harness email leg); admin
imports repointed, app-local copy deleted.
