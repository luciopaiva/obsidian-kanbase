# Developing Kanbase

Kanbase uses Node.js 24, pinned in `.nvmrc` and used for both CI and releases.

## Setup

1. Clone this repository and select Node 24 (`nvm use` when using nvm).
2. Run `npm ci`.
3. Run `npm run dev` to start the build process in watch mode.

Run the same deterministic checks as CI with `npm run ci`. This checks types,
ESLint and Obsidian API policy rules, formatting, unit tests, metadata, and the
production release bundle.

## Real Obsidian smoke tests

`npm run test:e2e` builds and launches a disposable copy of the vault in
`e2e/vault` through `wdio-obsidian-service`. The harness downloads and caches
the public Obsidian app and installer selected by `OBSIDIAN_VERSIONS`, installs
the built Kanbase bundle, enables the plugin alongside a checksum-verified Base
Board 2.5.1 bundle, and terminates its temporary Obsidian process after the run.

Use the `<app-version>/<installer-version>` format and pin both components:

```sh
OBSIDIAN_VERSIONS=1.13.7/1.13.7 npm run test:e2e
```

On Linux, run the suite in a graphical session or under Xvfb. Delete
`.obsidian-cache` if a clean Obsidian download is needed. Public releases
require no Obsidian credentials.

The GitHub Actions workflow runs weekly and can also be started manually:

1. Open the repository's **Actions** tab.
2. Select **Obsidian E2E**.
3. Select **Run workflow** and choose the branch to test.

For quick local checks against an already-running desktop Obsidian instance,
the official CLI can reload and inspect Kanbase:

```sh
obsidian plugin:reload id=kanbase
obsidian eval code='Boolean(app.plugins.plugins["kanbase"])'
```

Obsidian Headless is not used because it is a Sync/Publish client and does not
load desktop community plugins. The real-app suite is intentionally separate
from required pull-request CI.
