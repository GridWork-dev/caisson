# @caisson-sh/eslint-config

The single ESLint standards source (ADR-0002). Every package extends it.

```js
// each package's eslint.config.js
import config from "@caisson-sh/eslint-config";
export default config;
```

## Layout (two-track ownership)

| File            | Owner           | What                                                              |
| --------------- | --------------- | ----------------------------------------------------------------- |
| `index.js`      | composed        | the exported flat config — spreads the strict base + `boundaries` |
| `boundaries.js` | D9 (this track) | the **import-boundary rules** (ADR-0022, Gate 2)                  |

- **Foundations** prepends the **strict base** (typescript-eslint strict +
  no-`any`/no-`console.log`) at the `MERGE POINT` in `index.js`.
- **D9** owns `boundaries.js` — the **provider-SDK import boundary** (ADR-0011): only
  `@caisson-sh/ai-config` + `@caisson-sh/ai-kit` may import a provider SDK; everything else routes through
  `ai-config`. The prohibited list is `PROVIDER_SDKS` in `boundaries.js` — extend it when a new
  provider is added.

The other two boundary gates (AGPL license boundary, down-only deps) are package-graph facts and
live in the kernel's standards gate (`@caisson-sh/kernel`), not ESLint.
