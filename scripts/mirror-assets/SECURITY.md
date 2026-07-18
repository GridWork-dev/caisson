# Security Policy

This repository is a **read-only public mirror** (see [CONTRIBUTING.md](CONTRIBUTING.md)) —
a vulnerability found here still matters. A fix lands in the private source monorepo first
and reaches this mirror on the next sync, with a `CHANGELOG.md` entry on the affected
package.

## Reporting a vulnerability

Email **security@caisson.sh** with a description, the affected package and version, and a
minimal reproduction if you have one. Please do not open a public issue for a suspected
vulnerability — report it privately first so a fix can ship before the report itself becomes
a roadmap for exploiting it.

There is no dedicated security team or bug-bounty program today. We read every report and aim
to acknowledge within a few business days.

## Scope

This policy covers the open (Apache-2.0) packages in this repository. Caisson generates
compliance controls into the applications it builds — the project itself does not hold a
compliance certification.

## More

- [caisson.sh/trust](https://caisson.sh/trust) — the shipped security posture, evidence, and
  subprocessor list.
- [status.caisson.sh](https://status.caisson.sh) — live and historical availability.
