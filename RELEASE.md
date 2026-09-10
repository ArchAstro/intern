# Release the Intern CLI

Releases use tag-bound npm Trusted Publishing with GitHub Actions OIDC.

## One-time setup

1. Keep the GitHub repository private until its owner deliberately makes it
   public.
2. The repository has an `npm-release` GitHub environment. Add a required
   reviewer when the repository visibility and GitHub plan support that rule.
3. Publish the initial `@archastro/intern` package version through an approved
   bootstrap path if npm requires the package to exist before configuring a
   trusted publisher.
4. In npm package settings, configure a GitHub Actions trusted publisher:
   - organization: `ArchAstro`
   - repository: `intern`
   - workflow: `publish.yml`
   - environment: `npm-release`

The workflow intentionally omits npm provenance while the source repository is
private. Add `--provenance` to the publish command after the repository becomes
public.

## Subsequent releases

Run the `release` workflow from `main` and select a semantic version bump. It:

1. runs the complete package checks;
2. commits `package.json` and `package-lock.json` on a release branch;
3. opens and rebase-merges a version-only PR;
4. tags the exact resulting `main` commit; and
5. dispatches `publish.yml` at that immutable tag.

`publish.yml` reruns the checks, verifies the tag matches the package version,
refuses an existing npm version, publishes through OIDC, and creates the GitHub
release.
