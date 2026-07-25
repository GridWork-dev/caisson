---
"@caisson/email": patch
---

Email footer honesty fix: the shared "not a marketing message" transactional
claim was false on the nurture-follow-up lifecycle send. `EmailLayout` now
takes an optional `footerNote` prop (defaults to the transactional claim);
nurture-follow-up passes its own accurate note. Every template's footer also
now carries a support contact path (`support@caisson.sh`), which money
receipts previously had none of.
