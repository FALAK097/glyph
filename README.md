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
pnpm cask:generate --version <version> --artifact-path apps/desktop/release/Glyph-<version>-mac.dmg
```

## Pre-commit checks

Enable the repository pre-commit hook after install:

```bash
pnpm hooks:install
```

The hook runs `pnpm fmt:check`, `pnpm lint`, and `pnpm typecheck` before a commit is created.
