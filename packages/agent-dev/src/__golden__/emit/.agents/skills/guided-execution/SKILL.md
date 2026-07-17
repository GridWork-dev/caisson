---
name: guided-execution
description: Execute a written plan task-by-task with review checkpoints.
license: Apache-2.0
compatibility: Designed for Claude Code (or similar products)
allowed-tools: Bash(git:*) Read
metadata:
  author: caisson
  channel: stable
---

Execute a written plan task-by-task with review checkpoints.

Steps:
1. dispatch a fresh subagent per task
2. review the diff
3. unblock the next task
