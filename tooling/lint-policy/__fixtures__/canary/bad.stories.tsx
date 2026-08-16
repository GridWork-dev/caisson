// CANARY FIXTURE (ADR-0408 constraint 1) — exercised only by tooling/scripts/lint-canary.ts.
//
// This file MUST produce a `storybook/*` finding on every run. It is the SECOND jsPlugins arm:
// slop-violation.tsx proves a LOCAL plugin file still loads, this proves an NPM plugin package
// still resolves — two different failure modes of the same alpha API. Zero findings FAILS.
//
// The violation: a story file with no default export (`storybook/default-exports`), plus a named
// export that is not a valid story, which `storybook/story-exports` flags. Never imported by
// product code; ignored by the repo-wide lint via the `__fixtures__` pattern.
export const notAStory = 1;
