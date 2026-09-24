---
updated: 2026-09-24
status: live
grounds:
  - knowledge/decisions/ADR-0382-upgrade-credit-floor-and-tag-signing.md
  - scripts/release-readiness.ts
  - .github/workflows/release-train.yml
---

# Signing release tags

Ordinary release mechanics — an agent may perform every step on this page, including generating the
signing key (operator lock 2026-07-28, superseding the original "no agent performs any step here").
The private key never leaves the box and is never printed; what gets published is the public half.

## Why the tag and not just the commit

Every downstream leg of the release train resolves the **tag**, not a SHA: the registry publish
verifies and uploads the tagged bytes, the registry Worker deploy bakes the tagged index onto the
live edge, the mirror sync exports at the tag, and the fleet redeploys from the tag. A tag is a
mutable pointer. Anyone with push access can delete one and recreate it
against a different commit, and each of those legs would follow it without complaint. The annotation
already on our tags records who _claims_ to have cut it; a signature is what makes that claim
checkable.

Every tag through `v2026.07.20.3` reports `verified: false`, `reason: "unsigned"` from
`gh api repos/{owner}/{repo}/git/tags/<sha>`. `v2026.07.27.1` is the first to report
`verified: true` — see the status section below.

## One-time setup

SSH signing, not GPG — the key format is one you already manage, and there is no keyring to
maintain.

1. Use an existing SSH key or create one dedicated to signing:

   ```bash
   ssh-keygen -t ed25519 -C "caisson release signing" -f ~/.ssh/caisson-release
   ```

2. Point git at it:

   ```bash
   git config --global gpg.format ssh
   git config --global user.signingkey ~/.ssh/caisson-release.pub
   git config --global tag.gpgsign true          # sign every tag without needing -s
   ```

3. Record the public key as an allowed signer, so verification has something to check against:

   ```bash
   mkdir -p ~/.config/git
   printf '%s %s\n' "admin@caisson.sh" "$(cat ~/.ssh/caisson-release.pub)" \
     >> ~/.config/git/allowed_signers
   git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers
   ```

4. Add the same public key to GitHub as a **signing key** (Settings → SSH and GPG keys → New SSH
   key → key type **Signing Key**). Without this GitHub shows the tag as unverified in the UI even
   though `git tag -v` passes locally. An authentication key already on the account does not count;
   the same key must be added a second time with the signing type.

## Per release

Nothing changes in the release procedure. With `tag.gpgsign` set, `git tag -a v… -m "…"` signs.
Verify before pushing:

```bash
git tag -v v2026.07.30            # must print "Good \"git\" signature"
git push origin v2026.07.30
```

`scripts/release-readiness.ts` runs the same `git tag -v` as check 0b and reports the result.

## Why the check is advisory

Every tag cut before this lock is unsigned, and a tag's signature covers its own bytes — an existing
tag cannot become signed without being deleted and recreated, which is exactly the tag mutation the
signature is meant to prevent. A blocking check would therefore fail the train on history it cannot
legitimately repair.

So check 0b reports and does not fail. Leave the old unsigned tags alone — they are history, and
rewriting them to satisfy a gate would defeat the gate.

### Status: the first signed tag exists, and promotion is NOT yet safe

`v2026.07.27.1` (2026-07-28) is the first signed release tag. It verifies locally
(`Good "git" signature for admin@caisson.sh`) and on GitHub
(`repos/.../git/tags/<sha>` → `verified: true`, `reason: "valid"`), and it trained end to end —
readiness 8/8, all propagation legs green.

That satisfies the _first_ half of the old promotion condition, but promoting check 0b to blocking
today would **fail every future train**. The readiness job runs `git tag -v` on a CI runner
(`vars.CI_RUNNER_LINUX`), which has no `~/.config/git/allowed_signers` — that file lives on the
operator's box. Still true on 2026-09-24: no signer file is committed and the readiness job sets
no `gpg.ssh.allowedSignersFile`. In the
`v2026.07.27.1` readiness run, CI reported the tag as _"UNSIGNED or its signer is not in the
allowed-signers file"_ while the tag was in fact correctly signed. The check cannot currently tell
those two cases apart, and in CI it is always the second.

Promotion therefore needs a signer source CI can read, first:

- commit an `allowed_signers` file to the repo and point `gpg.ssh.allowedSignersFile` at it in the
  readiness job (the signing key's **public** half is not a secret), or
- verify through the GitHub API's `verification.verified` on the tag object instead of `git tag -v`,
  which needs no local trust store.

Until one of those lands, the honest state is: tags are signed and verifiable by anyone with the
public key, and the CI check remains advisory. Do not flip the `console.log` in `checkTagSigned`'s
catch to a `record(..., false, …)` before then.

## What this does not do

- It does not sign **commits**, only tags. The release train trusts the tag; commit signing is a
  separate decision nobody has made.
- It does not stop someone with push access from deleting a tag. It stops them from producing a
  _valid-looking_ replacement, and makes the deletion visible as a verification failure.
- It is not a supply-chain attestation. Provenance for the published bytes is the release record's
  job (tarball digests bound to the commit), not the tag's.
