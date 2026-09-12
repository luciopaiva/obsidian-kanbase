# Kanbase Plugin Promotion Plan

This plan turns the current Base Board fork into a separately published Obsidian plugin named **Kanbase**.

## Decisions to make before implementation

- [x] Confirm the public author name to use in `manifest.json`, `package.json`, and the copyright notice: **Lucio Paiva**.
- [x] Confirm the new GitHub repository name, preferably `obsidian-kanbase`: **luciopaiva/obsidian-kanbase**.
- [x] Confirm the new plugin ID, preferably `kanbase`, and check that it is not already in use.
- [x] Decide how existing `.base` files using `type: kanban` will be handled: do not migrate them automatically; users can create and configure a separate `kanbase` view while the old view remains untouched.
- [x] Decide whether to preserve the existing `project/base-board` tag for compatibility, support both old and new tags, or introduce a migration: no changes or migration; this tag is out of scope.
- [x] Decide whether global Base Board settings need to be migrated from the old plugin data directory: no migration; legacy global settings are out of scope.

## Phase 1: Create the new plugin identity

- [x] Rename the GitHub repository to `obsidian-kanbase` or the chosen alternative.
- [x] Update the local `origin` remote to the renamed repository.
- [x] Change `manifest.json`:
  - [x] Set `id` to `kanbase`.
  - [x] Set `name` to `Kanbase`.
  - [x] Set `version` to `1.0.0`.
  - [x] Rewrite the description for Kanbase.
  - [x] Set the chosen author name: **Lucio Paiva**.
  - [x] Add `authorUrl` and `fundingUrl` only if desired.
  - [x] Keep `minAppVersion` at `1.13.0` unless compatibility testing justifies lowering it.
- [x] Change `package.json` to the new package name, version, author, repository, and issue URLs.
- [x] Synchronize the root metadata in `package-lock.json`.
- [x] Reset `versions.json` to the new plugin history, beginning with the `1.0.0` compatibility entry.
- [x] Search the repository for stale Base Board branding and old repository URLs.

## Phase 2: Prevent identity and styling collisions

- [x] Change the custom Bases view type from `kanban` to a unique Kanbase type such as `kanbase`.
- [x] Update `KanbanView.type`, `registerBasesView`, generated `.base` configurations, examples, and documentation.
- [x] Decide and document that existing Base Board `.base` views are not migrated automatically.
- [x] Rename `base-board-*` CSS classes and selectors to `kanbase-*`.
- [x] Update corresponding class names in TypeScript and `styles.css`.
- [x] Change hover-link source IDs and other plugin-specific string identifiers to Kanbase equivalents.
- [x] Rename internal classes such as `BaseBoardPlugin` and `BaseBoardSettingTab` where appropriate.
- [x] Update user-facing commands, notices, settings labels, and error messages.
- [x] Keep persisted configuration keys and `kanban_order` unchanged unless a migration is intentionally implemented.

## Phase 3: Preserve user data and plugin isolation

- [x] Verify which settings are stored in `.base` files and which are stored in plugin data.
- [x] Preserve existing configuration property names where possible.
- [x] Do not read or migrate data from `.obsidian/plugins/base-board`.
- [x] Do not inspect or copy settings from legacy `type: kanban` views.
- [x] Never convert an existing `type: kanban` view in place.
- [x] Keep Kanbase views independent: a newly created `type: kanbase` view starts with its own defaults and configuration.
- [x] Test coexistence with Base Board and verify that opening a Kanbase view does not rewrite the `.base` file.

## Phase 4: Documentation and attribution

- [x] Rebrand `README.md` as Kanbase documentation.
- [x] Replace old logo, repository, release, issue, and BRAT URLs.
- [x] Update command names, screenshots, examples, and installation instructions.
- [x] Do not add an automatic migration flow; Base Board views remain separate and users configure new Kanbase views manually.
- [x] Add an attribution section linking to Base Board and Michael DeRazon.
- [x] Update `AI-INSTRUCTIONS-TEMPLATE.md` or clearly mark any remaining Base Board references.
- [x] Review whether sample tags and examples should retain old names for compatibility: no tag changes; `project/base-board` remains out of scope.
- [x] Update `LICENSE` while preserving the original copyright notice:

  ```text
  Copyright (c) 2026 Michael DeRazon
  Copyright (c) 2026 Lucio Paiva
  ```

## Phase 5: Continuous integration and delivery

The pipeline should provide fast, deterministic checks for every pull request and push, then perform a stricter release validation before publishing assets. Real Obsidian E2E should be a separate manual/nightly job initially because it requires an Electron desktop runtime and is slower and more platform-sensitive than unit tests.

### Pull request and push CI

- [x] Add a GitHub Actions workflow for `pull_request` and pushes to the default branch.
- [x] Test against the supported Node.js version, using the same pinned Node 24 runtime in CI and releases.
- [x] Use `npm ci` and enable dependency caching through `actions/setup-node`.
- [x] Run TypeScript checking and ESLint through `npm run lint`.
- [x] Add and run a formatting check, such as `prettier --check "src/**/*.ts"`.
- [x] Run the Vitest suite through `npm test`.
- [x] Run `npm run build` and verify that the production bundle is generated.
- [x] Run `git diff --check`.
- [x] Validate `manifest.json`, `versions.json`, `package.json`, and `package-lock.json` as parseable and internally consistent.
- [x] Validate the plugin bundle: `main.js`, `manifest.json`, and `styles.css` exist; `main.js` is production-built; and no source maps or development artifacts are included.
- [x] Run an Obsidian-plugin linter or equivalent manifest/API policy check, and review any warnings before release.
- [x] Upload useful failure artifacts such as test reports, bundle metadata, and screenshots when a UI job fails.
- [x] Make the core CI jobs required status checks for merging.

### Release CD

- [x] Run the same CI checks before publishing a release.
- [x] Trigger releases only from a valid semver tag and verify that the tag exactly matches `manifest.json`.
- [x] Build from the tagged commit, not from an uncommitted or different branch state.
- [x] Publish only `main.js`, `manifest.json`, and `styles.css` as plugin release assets; exclude `data.json`, source files, and development files.
- [x] Verify that the uploaded `manifest.json` version and release tag match.
- [x] Generate build-provenance attestations for the release artifacts.
- [x] Keep the release workflow permission scope minimal and prevent duplicate releases for the same tag.
- [x] Add dependency and GitHub Actions update automation through Dependabot or an equivalent service.

### Real Obsidian integration and E2E testing

- [x] Create a disposable test vault and install the built Kanbase bundle into it during the test job.
- [x] Launch a real Obsidian desktop build in CI under Linux `xvfb` with isolated user/config directories.
- [x] Enable community plugins, load Kanbase, and verify that the plugin registers successfully.
- [x] Test creation of a new board and confirm the generated view type is `kanbase` and the visible label is `Kanbase`.
- [x] Test Bases integration, filters, grouping, tag filtering, drag-and-drop, card opening, and card creation.
- [x] Test custom display settings and confirm they persist after closing and reopening the view.
- [x] Test coexistence with an existing Base Board installation and confirm the old view remains untouched when a Kanbase view is created.
- [x] Capture screenshots and Obsidian console/plugin errors as artifacts when E2E fails.
- [x] Run the real-Obsidian suite manually or nightly at first; promote stable smoke tests to required PR checks later.

### Runtime/tooling decision

- [x] Use the official [Obsidian CLI](https://obsidian.md/help/cli) for local automation and developer smoke tests where a running desktop Obsidian instance is available.
- [x] Do not treat [Obsidian Headless](https://obsidian.md/help/headless) as a plugin E2E runtime; it is a headless Sync/Publish client and does not load desktop plugins.
- [x] Evaluate a real-app harness such as `wdio-obsidian-service` or `obsidian-e2e` for CI-driven plugin tests.
- [x] Pin the Obsidian desktop version used by E2E, or explicitly test a small version matrix, so runtime changes are visible and reproducible.
- [x] Document the local commands for running the same E2E suite and cleaning up temporary Obsidian processes and vaults.

## Phase 6: Commit and release

- [ ] Review `git status` and ensure the local install script is not included in the commit.
- [ ] Commit the repository changes in logical commits.
- [ ] Push the default branch and confirm the root `manifest.json` is correct at `HEAD`.
- [ ] Create a GitHub release tagged exactly `1.0.0`.
- [ ] Attach `main.js`, `manifest.json`, and `styles.css` to the release.
- [ ] Do not attach development files or `data.json`.
- [ ] Verify that the release assets match the manifest version.

## Phase 7: Submit to the Obsidian community directory

- [ ] Sign in to the Obsidian community site using an Obsidian account.
- [ ] Connect GitHub for repository verification.
- [ ] Open the Plugins section and choose **New plugin**.
- [ ] Enter the new repository URL and GitHub owner.
- [ ] Review and accept the plugin policies and support expectations.
- [ ] Submit the plugin for review.
- [ ] Address review feedback through new commits and matching versioned releases.

## Release checklist for future versions

- [ ] Update the version in `manifest.json`, `package.json`, `package-lock.json`, and `versions.json`.
- [ ] Run lint, tests, build, and the test-vault installation script.
- [ ] Create a Git tag and GitHub release whose tag exactly matches the manifest version.
- [ ] Attach the current `main.js`, `manifest.json`, and `styles.css`.
- [ ] Keep release notes focused on user-visible changes and migration requirements.

## Reference material

- [Obsidian: Submit your plugin](https://raw.githubusercontent.com/obsidianmd/obsidian-developer-docs/master/en/Plugins/Releasing/Submit%20your%20plugin.md)
- [Obsidian: Set up and claim your plugin](https://raw.githubusercontent.com/obsidianmd/obsidian-developer-docs/master/en/Community%20directory/Set%20up%20and%20claim.md)
- [Obsidian releases repository](https://github.com/obsidianmd/obsidian-releases)
