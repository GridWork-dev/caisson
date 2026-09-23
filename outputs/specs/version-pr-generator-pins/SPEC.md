---
title: Version PR generator pins and golden
date: 2026-09-17
tags: [infra, external-system]
tier: STANDARD
status: approved
---

# Goal

R405 requires the version PR consume path to keep both generator template
package manifests and the Next starter golden aligned with workspace versions.
The release remains held; this phase ends at an opened PR, pending cockpit merge.

## Acceptance

- After Changesets consumes a bump, derive caret pins from workspace manifests
  for the Next and EU AI Act sample templates, then regenerate the Next golden
  using its existing BLESS test invocation, before tarball recording.
- Stage the generated golden with the complete version PR source truth.
- A scratch consume run passes both pin test files and the Next golden test.
  Disabling the added step makes all three fail; restoration passes again.
- No live release, workflow dispatch, tag, publish, branch deletion, or merge.
- The PR distinguishes local proof from the next real train's hosted execution.

## Boundary

Run only in the existing trusted main workflow_dispatch job. Do not extend
permissions or execute the new helper in the candidate-data refresh job.
Read fixed local template paths, validate workspace names and versions, and
validate all updates before writing either template. The golden is generated.
