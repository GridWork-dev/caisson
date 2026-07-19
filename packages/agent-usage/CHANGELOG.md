# @caisson/agent-usage

## 0.2.3

### Patch Changes

- Updated dependencies [2229209]
  - @caisson/agent-trajectory@0.3.3
  - @caisson/ai-meter@1.0.7

## 0.2.2

### Patch Changes

- Updated dependencies [fc0bb99]
  - @caisson/kernel@0.5.2
  - @caisson/agent-trajectory@0.3.2
  - @caisson/ai-meter@1.0.6

## 0.2.1

### Patch Changes

- Updated dependencies [7de6fa4]
  - @caisson/kernel@0.5.1
  - @caisson/agent-trajectory@0.3.1
  - @caisson/ai-meter@1.0.5

## 0.2.0

### Minor Changes

- f40653b: New usage-adapter package for the agent-trajectory event contract: a Codex CLI rollout reader and a
  price-normalization pass that turns real, adapter-extracted token counts into a cost estimate you can
  trust. The Codex reader never guesses which model or provider produced a turn, reads per-turn usage
  from the session's own reported deltas rather than summing its running counters, and marks a session
  with no usable usage data as unsupported instead of reporting a false zero. The price-normalization
  pass upgrades an adapter's estimated usage into a priced cost statement — computed against the same
  versioned rate table the metered gateway uses, in whole credit units — whenever the reported model is
  one this release recognizes; an unrecognized model is left as an honest estimate rather than a guess.
  This is a cost statement only: nothing here settles against your credit balance. Reserved and
  unpublished for now: it joins no bundle and carries no committed price until the runtime loop lands.

### Patch Changes

- Updated dependencies [9d50e7c]
- Updated dependencies [c7476b9]
- Updated dependencies [c3b0e41]
- Updated dependencies [dffd0c1]
- Updated dependencies [696b2c5]
  - @caisson/ai-meter@1.0.4
  - @caisson/agent-trajectory@0.3.0
