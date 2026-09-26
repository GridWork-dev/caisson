# Security policy

Caisson is compliance and security infrastructure, so we take reports seriously, even though it is
maintained on a best-effort basis by a small team.

## Reporting a vulnerability

Please **do not open a public issue**. Use either:

- GitHub's private vulnerability reporting: the **Report a vulnerability** button on this repo's
  Security tab, or
- email **security@caisson.sh**.

Include the affected package and version, a description of the issue, and steps or a proof of
concept to reproduce it.

## What to expect

- An acknowledgement within 7 days.
- A fix or mitigation plan for confirmed issues, prioritised by severity.
- Coordinated disclosure: we publish a GitHub Security Advisory once a fix ships, or 90 days
  after your report, whichever comes first. We credit reporters who want to be credited.

## Supported versions

Only the latest published version of each `@caisson-sh/*` package receives security fixes.

## Scope

In scope: the code in this repository and the packages published from it. Out of scope: issues
that need a compromised host or a misconfigured deployment of your own application, and findings
from automated scanners that come with no demonstrated impact.
