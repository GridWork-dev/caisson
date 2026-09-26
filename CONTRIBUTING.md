# Contributing to Caisson

Thanks for your interest. Caisson is maintained on a best-effort basis, so small, focused pull
requests with tests are the ones that land fastest.

## Before you start

- **Questions and ideas** go to [GitHub Discussions](../../discussions), not issues.
- **Bugs** go in an issue, using the bug form: a minimal reproduction beats a long description.
- **Larger changes** (a new package, a new provider, a behaviour change): open a Discussion first so
  we can agree on the shape before you write code.
- **Security issues:** never file them publicly. See [SECURITY.md](SECURITY.md).

## Development

Requirements: [Bun](https://bun.sh) (the version in `package.json#packageManager`) and Node 22+.
Some package tests need Docker (Postgres).

```sh
bun install
bun run check      # build + lint + typecheck + test across the workspace
bun run --filter @caisson-sh/<package> test   # one package
```

## Engineering rules

These are enforced in review and, where possible, by the standards gate in `tooling/`:

- TypeScript strict mode. No `any`, no `console.log` in package code.
- Bun only; never npm or yarn in scripts.
- Validate every external boundary with Zod `.strict()` schemas.
- Every outbound `fetch` goes through `fetchWithTimeout`.
- Compare secrets and tokens with `crypto.timingSafeEqual`, never `===`.
- Money and credits are integers, never floats.
- Row-level security fails closed.
- Packages only depend on packages at the same level or below; nothing depends "up" on an
  application.

## Pull requests

1. Branch from `main` and keep one logical change per PR.
2. Add or update tests. Bug fixes should come with a test that fails without the fix.
3. Any change under `packages/` needs a changeset: run `bunx changeset` and describe the change for
   users.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit subjects, e.g.
   `fix(auth): reject expired sessions`.
5. Make sure `bun run check` passes locally. CI runs the same checks.

## License

Caisson is licensed under the [Apache License 2.0](LICENSE). By submitting a contribution, you agree
that it is licensed under the same terms (Apache-2.0 section 5). There is no CLA.

## Code of conduct

This project follows the [Contributor Covenant 3.0](CODE_OF_CONDUCT.md).
