# ADR-0423 — Bind tool approvals to private records

- Date: 2026-09-16
- Status: Accepted — operator R359 / EST-ASK-317
- Scope: `@caisson/tool-exec` two-phase approval execution
- Supersedes: ADR-0360 S3 acceptance of caller-owned validated proposals

## Context

CR-01 demonstrated that a serialized caller-owned proposal could alter validated argv
or child environment before execution. A command-name check alone did not bind approval
to the action that was originally validated.

## Decision

The server creates a private immutable record and a public strict `ToolApproval` envelope.
Its SHA-256 digest uses a fixed JSON tuple of approval ID, name, executable, validated argv,
reason (explicit null when absent), and policy version. Execution atomically consumes the
record once and compares both the claimed and recomputed digest in constant time. It
revalidates saved original input against the current CommandSpec and requires identical
validated argv. Command, explicit environment and policy-version changes invalidate the
record. Environment is copied solely from the current spec, never from the public proposal.

The default bounded in-memory store snapshots records. An injected durable store must
remain server-private, enforce create-only IDs and atomically consume records. The caller
must authenticate and authorize the approving actor before invoking execute; neither the
digest nor possession of an ID is a replacement for application authorization. Pure browser
validation continues to return ProposedToolCall, which carries no execution authority.

## Consequences

Two-phase callers must retain the server record (or provide a durable adapter); hand-built
and old serialized proposals fail closed. Replayed, modified and rotated approvals require
a fresh proposal. Run remains single-phase. The inherited environment default of ADR-0420
is unchanged; callers needing isolation still set an explicit spec environment. There is no
approval-expiry policy in this lock; the default store bounds pending record count to 1,000.

Tests cover input mutation, forged fields, environment injection, policy rotation, current
schema transformations, replay and concurrent consumption. Guard-removal mutations and
byte-identical restoration are recorded in the S8 RUN-NOTES.
