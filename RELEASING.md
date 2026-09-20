# Releasing Kanbase

Kanbase releases are built and published by GitHub Actions when a version tag
is pushed. Tags use plain semantic versions such as `1.0.1`, without a `v`
prefix.

## Prepare the release

- [ ] Merge user-facing changes as their own PR(s), each labeled `enhancement`,
      `bug`, `fix`, `dependencies`, or `chore` per `.github/release.yml` so the
      tag's auto-generated release notes group them correctly.
- [ ] Start from the latest `main` and choose the next semantic version.
- [ ] Open a separate, minimal version-bump PR labeled `release` (this label
      is excluded from the auto-generated notes) and update all version
      metadata with:

  ```sh
  npm version <version> --no-git-tag-version
  ```

- [ ] Confirm that `manifest.json`, `package.json`, `package-lock.json`, and
      `versions.json` contain the new version.
- [ ] Keep commit and pull-request descriptions focused on user-visible changes
      so GitHub can generate useful release notes.

## Validate

- [ ] Install locked dependencies with `npm ci`.
- [ ] Run the deterministic CI suite with `npm run ci`.
- [ ] Validate the intended tag with
      `npm run validate:release -- <version>`.
- [ ] Run the real Obsidian suite:

  ```sh
  OBSIDIAN_VERSIONS=1.13.7/1.13.7 npm run test:e2e
  ```

- [ ] Install the production build in a test vault and complete a manual smoke
      test.
- [ ] Merge the release changes into `main` only after required CI passes.

## Publish

- [ ] Confirm that `main` is synchronized with GitHub and that its root
      `manifest.json` contains the intended version.
- [ ] Create an annotated tag on the release commit and push it:

  ```sh
  git tag -a <version> -m "Kanbase <version>"
  git push origin <version>
  ```

- [ ] Confirm that the **Release Obsidian plugin** workflow succeeds. It builds
      from the tagged commit, validates the release, creates provenance
      attestations, and publishes the GitHub release automatically.

## Verify the published release

- [ ] Confirm that the GitHub release is neither a draft nor a prerelease.
- [ ] Confirm that the release contains exactly `main.js`, `manifest.json`, and
      `styles.css`; it must not contain source files, development artifacts, or
      `data.json`.
- [ ] Download the release assets and run
      `npm run validate:bundle -- <download-directory>`.
- [ ] Confirm that the downloaded `manifest.json` version matches the tag.
- [ ] Review the generated release notes and verify that the release is usable
      through the intended installation method.
