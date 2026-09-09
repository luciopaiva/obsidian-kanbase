# Kanbase Plugin Promotion Plan

This plan turns the current Base Board fork into a separately published Obsidian plugin named **Kanbase**.

## Decisions to make before implementation

- [ ] Confirm the public author name to use in `manifest.json`, `package.json`, and the copyright notice.
- [ ] Confirm the new GitHub repository name, preferably `obsidian-kanbase`.
- [ ] Confirm the new plugin ID, preferably `kanbase`, and check that it is not already in use.
- [ ] Decide how existing `.base` files using `type: kanban` will be migrated to the new view type.
- [ ] Decide whether to preserve the existing `project/base-board` tag for compatibility, support both old and new tags, or introduce a migration.
- [ ] Decide whether global Base Board settings need to be migrated from the old plugin data directory.

## Phase 1: Create the new plugin identity

- [ ] Rename the GitHub repository to `obsidian-kanbase` or the chosen alternative.
- [ ] Update the local `origin` remote to the renamed repository.
- [ ] Change `manifest.json`:
  - [ ] Set `id` to `kanbase`.
  - [ ] Set `name` to `Kanbase`.
  - [ ] Set `version` to `1.0.0`.
  - [ ] Rewrite the description for Kanbase.
  - [ ] Set the chosen author name.
  - [ ] Add `authorUrl` and `fundingUrl` only if desired.
  - [ ] Keep `minAppVersion` at `1.13.0` unless compatibility testing justifies lowering it.
- [ ] Change `package.json` to the new package name, version, author, repository, and issue URLs.
- [ ] Synchronize the root metadata in `package-lock.json`.
- [ ] Reset `versions.json` to the new plugin history, beginning with the `1.0.0` compatibility entry.
- [ ] Search the repository for stale Base Board branding and old repository URLs.

## Phase 2: Prevent identity and styling collisions

- [ ] Change the custom Bases view type from `kanban` to a unique Kanbase type such as `kanbase`.
- [ ] Update `KanbanView.type`, `registerBasesView`, generated `.base` configurations, examples, and documentation.
- [ ] Decide and document how users migrate existing Base Board `.base` files.
- [ ] Rename `base-board-*` CSS classes and selectors to `kanbase-*`.
- [ ] Update corresponding class names in TypeScript and `styles.css`.
- [ ] Change hover-link source IDs and other plugin-specific string identifiers to Kanbase equivalents.
- [ ] Rename internal classes such as `BaseBoardPlugin` and `BaseBoardSettingTab` where appropriate.
- [ ] Update user-facing commands, notices, settings labels, and error messages.
- [ ] Keep persisted configuration keys and `kanban_order` unchanged unless a migration is intentionally implemented.

## Phase 3: Preserve or explicitly migrate user data

- [ ] Verify which settings are stored in `.base` files and which are stored in plugin data.
- [ ] Preserve existing configuration property names where possible.
- [ ] Decide whether the new plugin should read or migrate data from `.obsidian/plugins/base-board`.
- [ ] If migration is needed, implement it explicitly and safely without silently rewriting user files.

### Per-base Base Board view migration

When a `.base` file contains an old Base Board view and the user creates a new Kanbase view in the same file, automatically copy the old view's Kanbase-compatible settings into the new view.

- [ ] Detect when the active Kanbase view has no Kanbase-specific settings yet.
- [ ] Locate the containing `.base` file.
- [ ] Read and parse the file's `views` section.
- [ ] Find candidate old views with `type: kanban`.
- [ ] Match candidates by view name when possible.
- [ ] If there is only one candidate, use it as the default source.
- [ ] If multiple candidates remain, use the best name match and otherwise skip ambiguous migration safely.
- [ ] Copy only Kanbase-specific settings:
  - [ ] `cardOpenBehavior`
  - [ ] `cardCoverProperty`
  - [ ] `newCardsToTop`
  - [ ] `boardColumns`
  - [ ] `columnColors`
  - [ ] `wipLimits`
  - [ ] `collapsedColumns`
  - [ ] `tagFiltersVisible`
  - [ ] `tagColors`
- [ ] Do not copy the old view's type, name, filters, grouping, sorting, or visible-property configuration.
- [ ] Never overwrite settings that are already present in the Kanbase view.
- [ ] Record that the migration was completed, or otherwise make the detection idempotent.
- [ ] Leave the original Base Board view and its settings untouched.
- [ ] Do not prompt the user or add a separate migration command.
- [ ] Test the migration with one old view, multiple old views, renamed views, and no matching view.

### Per-base view-type migration

- [ ] Automatically migrate existing `type: kanban` views to `type: kanbase` when Kanbase takes over the view.
- [ ] Modify only the view type and preserve all other `.base` content.
- [ ] Report which files were changed and which could not be migrated.

- [ ] Test existing boards, filters, grouping, card ordering, and custom display settings.
- [ ] Add migration instructions or a migration command if the view type changes make it necessary.

## Phase 4: Documentation and attribution

- [ ] Rebrand `README.md` as Kanbase documentation.
- [ ] Replace old logo, repository, release, issue, and BRAT URLs.
- [ ] Update command names, screenshots, examples, and installation instructions.
- [ ] Add a migration section for Base Board users.
- [ ] Add an attribution section linking to Base Board and Michael DeRazon.
- [ ] Update `AI-INSTRUCTIONS-TEMPLATE.md` or clearly mark any remaining Base Board references.
- [ ] Review whether sample tags and examples should retain old names for compatibility.
- [ ] Update `LICENSE` while preserving the original copyright notice, for example:

  ```text
  Copyright (c) 2026 Michael DeRazon
  Copyright (c) 2026 <chosen author name>
  ```

## Phase 5: Validate the plugin

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Build the production bundle.
- [ ] Run `git diff --check`.
- [ ] Run `bash scripts/install-to-test-vault.sh`.
- [ ] In the test vault, verify plugin loading and the Kanbase view.
- [ ] Test creation of a new board.
- [ ] Test filters, grouping, drag-and-drop, card opening, and card creation.
- [ ] Test all custom display settings and confirm they persist after closing and reopening the view.
- [ ] Test behavior with an existing Base Board installation present, if coexistence is supported.
- [ ] Confirm the release bundle contains only the intended files.

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
