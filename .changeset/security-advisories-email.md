---
"@caisson-sh/email": patch
---

Update nodemailer to 10.x for security advisories. nodemailer 10 ships its own type definitions,
so `@types/nodemailer` is no longer a dependency. It requires Node.js 20 or newer (Bun is
supported); the SMTP driver's options are unchanged.
