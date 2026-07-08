---
"@caisson/site": patch
---

The Ask AI widget's "Talk to the team" link now opens a direct email to the team instead of
routing to the security/procurement page, and a question the assistant couldn't answer now
files a support ticket automatically from the question text so a human can follow up —
previously the widget captured the question for product analytics only, with no ticket and
no direct contact path. A capacity-limit escalation (the daily usage cap) does not file a
ticket, since it isn't a question a human needs to answer.
