---
name: code-reviewer
description: Reviews a diff for correctness and the security floor.
capabilities:
  - code_review
  - security_audit
tools:
  - read
  - grep
  - bash
---

Reviews a diff for correctness and the security floor.

When to invoke: A bounded diff needs an idiom + security pass before SHIP.
