---
"@caisson-sh/email": patch
---

Update nodemailer to 10.x for security advisories. nodemailer 10 requires Node.js 20 or newer
(Bun is supported), and the package now declares that in `engines`. The SMTP driver's options are
unchanged.
