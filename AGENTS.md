# Instructions for coding agents

## Keep release notes useful

GitHub's auto-generated release notes (`gh release create --generate-notes`)
are categorized by PR label, per `.github/release.yml`. To keep them useful:

- Open one PR per logical change (don't bundle unrelated features/fixes into a
  single PR) so each shows up as its own changelog entry.
- Label every PR with exactly one of: `enhancement` (or `feature`), `bug` (or
  `fix`), `dependencies`, `chore` (also covers `refactor`/`documentation`), or
  `release`. Use `gh pr edit <number> --add-label <label>` right after opening
  the PR.
- Only the version-bump PR (see `RELEASING.md`) gets the `release` label; it's
  excluded from the notes since it has no user-facing change of its own.
- Write the PR title as a clear, user-facing summary — it becomes the
  changelog bullet verbatim.

See `RELEASING.md` for the full release process (versioning, tagging,
validation, publishing).
