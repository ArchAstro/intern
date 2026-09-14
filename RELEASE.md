# Release the Intern CLI

Releases use tag-bound npm Trusted Publishing with GitHub Actions OIDC.

## Publisher configuration

The repository is public. The initial `@archastro/intern@1.0.0` release was
published on September 10, 2026. npm Trusted Publishing is configured for:
   - organization: `ArchAstro`
   - repository: `intern`
   - workflow: `publish.yml`
   - environment: `npm-release`

Keep the workflow filename and environment aligned with that configuration.
Do not republish 1.0.0; subsequent releases need a new version.
The initial release used interactive npm authentication. Version 1.0.1 verified
the GitHub Actions OIDC path on September 10, 2026, including signed provenance.
See the [successful publish run](https://github.com/ArchAstro/intern/actions/runs/34520272695).

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
