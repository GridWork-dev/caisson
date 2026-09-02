---
"@caisson/audit-harness": patch
---

Adds a static test guarding the image-publish pipeline's vulnerability-scan posture. The shared CI template that publishes container images records CVE findings but never blocks a publish on them by default, relying on a repository variable being left unset — a choice documented only in prose until now. The new test reads the template and the security playbook directly and fails if the template's default ever flips, or if the playbook section documenting the choice disappears, so a silent posture change can no longer pass unnoticed.
