# Glyph

Glyph is a local-first markdown app with two surfaces:

- `apps/desktop`: the main Electron app for reading, editing, and organizing local markdown notes
- `apps/web`: the landing page and download surface for releases

## What Glyph Is

Glyph is designed to be a fast, focused markdown workspace for people who want plain files, beautiful reading, and a lightweight writing flow without turning their notes into a database.

It opens local markdown folders, lets you move quickly between notes, and keeps the experience local-first by default.

## Current Features

### Desktop app

- local workspace rooted at `Documents/Glyph` by default
- open markdown files and folders directly
- recursive sidebar with nested folders and recent files
- TipTap-based markdown editor with markdown-aware shortcuts
- autosave and safe file refresh when files change externally
- quick open and command palette with `Cmd/Ctrl+P`
- global search and file search
- theme switching and persisted settings
- Markdown link navigation between notes in the same workspace
- slash actions for inserting tables, links, and images
- local image picker flow
- markdown export and PDF export

### Web app

- landing page for Glyph
- release/download surface for desktop builds

## Why It Exists

Glyph aims to sit in the middle ground between plain-text tools and heavyweight note systems:

- your notes stay as markdown files on disk
- the UI is optimized for reading and fast navigation
- editing stays powerful without burying the app in configuration

## Install

### macOS with Homebrew

The Homebrew cask is kept in this repo and updated from the macOS release artifact:

```bash
brew install --cask FALAK097/glyph/glyph
```

### Direct downloads

Desktop release artifacts are published through [GitHub Releases](https://github.com/FALAK097/glyph/releases):

- macOS: `.dmg`
- Windows: `.exe`

## Project Layout

```text
glyph/
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   ├── public/
│   │   ├── scripts/
│   │   └── src/
│   └── web/
│       └── src/
├── .github/workflows/
├── Casks/
├── scripts/
├── CHANGELOG.md
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Repository Scripts

From the repo root:

```bash
pnpm dev:desktop
pnpm dev:web
pnpm build
pnpm build:desktop
pnpm build:web
pnpm dist:desktop
pnpm typecheck
pnpm lint
pnpm fmt:check
pnpm test:e2e:desktop
pnpm test:e2e:desktop:headed
pnpm test:e2e:desktop:run -- --grep "settings"
pnpm test:e2e:desktop:ui
pnpm cask:generate --version <version> --artifact-path apps/desktop/release/Glyph-<version>-mac.dmg
```

## Desktop E2E Testing

Glyph now includes a Playwright-based Electron smoke test.

From the repo root:

```bash
pnpm test:e2e:desktop
pnpm test:e2e:desktop:headed
pnpm test:e2e:desktop:debug
pnpm test:e2e:desktop:run -- --grep "settings"
pnpm test:e2e:desktop:run -- e2e/electron-smoke.spec.ts
pnpm test:e2e:desktop:ui
pnpm test:e2e:desktop:report
```

These commands build the desktop app, launch Electron against the built renderer, and run a smoke suite around startup, the command palette, settings, and opening a seeded markdown note from a disposable workspace.
`pnpm test:e2e:desktop` opens a real Electron window locally. In CI, the same test runs under `xvfb`, so it stays virtual to the runner while exercising the same app flow.
For desktop UI or Electron changes, `pnpm test:e2e:desktop` is the default sanity check to run before merge.
For faster iteration on a specific change, build once with `pnpm build:desktop`, then run only the relevant Playwright test or title with `pnpm test:e2e:desktop:run -- ...`.
Local Electron runs stay visible by design so the real app can be observed while debugging. CI remains virtualized under `xvfb`.
Use `pnpm test:e2e:desktop:ui` for Playwright's interactive runner, and `pnpm test:e2e:desktop:report` to inspect the latest HTML report after a failure.

## Pre-commit checks

Enable the repository pre-commit hook after install:

```bash
pnpm hooks:install
```

The hook runs `pnpm fmt:check`, `pnpm lint`, and `pnpm typecheck` before a commit is created.

## Release flow

`Release Please` runs on every push to `main` and opens or updates the release PR branch when it finds releasable Conventional Commits.

- If you squash merge PRs, the PR title becomes the commit title on `main`, so the PR title must use Conventional Commit format.
- Good PR titles: `fix(desktop): keep the sidebar scrollable` and `feat(web): improve the download experience`.
- Titles like `[codex] Fix desktop sidebar scroll and editor controls` or `Update release downloads and improve web install UX` will merge, but `release-please` will skip them.
- If the title is still being refined, add a `Release-Please: fix(desktop): keep the sidebar scrollable` line to the PR body so the workflow can suggest the exact rename to use before merge.
- The `release-please--branches--main--components--glyph` branch is only refreshed when a release PR is created or updated, so it can lag behind `main` between releases.
- If a non-conventional squash-merge title already landed on `main`, edit the merged PR body and add a commit override block with a Conventional Commit message, then rerun the `Release Please` workflow manually:

```text
BEGIN_COMMIT_OVERRIDE
fix(desktop): keep the sidebar scrollable
END_COMMIT_OVERRIDE
```

- If you truly need to force a specific version number, use the upstream `Release-As: x.y.z` commit-body flow on a commit to `main`; do not rely on the action's `release-as` input in manifest mode.
