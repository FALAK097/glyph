# Glyph PRD

Source of truth for scope, architecture, and delivery status.

## Product

Glyph is a markdown product with two apps:

- `apps/desktop`: Electron app for local markdown viewing and editing
- `apps/web`: landing/download site for distribution

Principles:

- simplicity over feature sprawl
- beauty over complexity
- speed over configurability
- local-first by default

## Goals

- best-in-class markdown rendering
- fast markdown editing with a path to inline WYSIWYG
- open files and folders directly
- excellent reading experience
- workspace search
- themes
- drag-and-drop media support

Non-goals for v1:

- cloud sync
- plugins
- collaboration
- graph view
- database-heavy note management

## Stack

Desktop:

- Electron
- React
- Vite
- TypeScript
- Zustand
- `chokidar`
- TipTap

Web:

- React
- Vite
- TypeScript

Planned later:

- Shiki
- KaTeX
- Mermaid
- FlexSearch

## Repo Shape

```text
glyph/
├── apps/
│   ├── desktop/
│   └── web/
├── README.md
├── package.json
├── pnpm-workspace.yaml
└── prd.md
```

## Current Status

Shipped now:

- desktop/web monorepo split
- Electron desktop shell with preload IPC
- default workspace rooted at `Documents/Glyph`
- desktop file open and folder open
- recursive notes sidebar
- collapsible sidebar with full-hide mode
- recent files in sidebar
- single-pane TipTap editor surface
- save flow
- autosave
- first edit in an empty window auto-creates a backing note
- file watching and safe refresh
- native command palette with `Cmd/Ctrl+P`
- new note / previous note / next note commands
- editor history navigation
- global search and file search through palette
- theme switching and theme preview through palette
- richer markdown editing for links, images, and tables
- slash actions for table, link, and image insertion
- local image picker flow inside the editor
- clickable inter-note markdown links inside the workspace
- image delete affordance for selected images
- markdown and PDF export
- persisted settings for workspace path and theme mode
- desktop dev startup hardened with renderer retry + preload failure fallback
- standalone web landing page
- placeholder download buttons

Release readiness now in progress:

- electron-builder packaging metadata and release scripts
- Electron auto-update plumbing for packaged builds
- app version surfaced from Electron runtime into the renderer
- GitHub Actions CI + tagged desktop release workflow
- automated root `CHANGELOG.md` via Release Please

## Phase Plan

### Phase 0: Foundation

- [X] Initialize git repo
- [X] Initial commit
- [X] Split repo into `apps/desktop` and `apps/web`
- [X] Set up pnpm workspace
- [X] Add root README
- [X] Make `prd.md` the source of truth

### Phase 1: Core Viewer

- [X] Electron shell and preload bridge
- [X] React desktop renderer
- [X] Default `Documents/Glyph` workspace
- [X] Open markdown file
- [X] Open markdown folder
- [X] Recursive sidebar explorer
- [X] Recent files in sidebar
- [X] File switching
- [X] Save file
- [X] Watch external file changes
- [X] Finder / Explorer open-with integration
- [ ] Better empty and loading states

### Phase 2: Editor

- [X] Single-pane markdown-aware editor
- [X] TipTap-based editor surface
- [X] Autosave
- [X] New file flow
- [X] Better new note flow without prompt
- [X] New folder flow inside command palette
- [X] Stronger inline markdown shortcut behavior
- [X] Better insertion and selection behavior
- [X] Table insertion with adjustable rows and columns
- [X] Table row/column management controls
- [X] Link and image slash insertion flows
- [X] Local image file picking
- [ ] Drag-and-drop image support
- [X] Rich keyboard formatting shortcuts
- [X] Provide copy icon for code blocks
- [ ] Provide copy icon for table
- [X] Provide delete icon for images
- [X] Open interlinked md files within editor
- [ ] Highlight text
- [X] Scroll and cursor reset polish when jumping between linked docs
- [ ] TOC
- [ ] Improve markdown task-list shortcut conversion (`- [ ]`, `- [x]`)

### Phase 3: Power Features

- [X] Global search
- [X] Themes
- [X] Quick open
- [X] Command palette
- [ ] Saved command history / smarter ranking
- [X] Export markdown
- [X] Export PDF

### Phase 4: Polish

- [ ] Typography refinement
- [ ] Motion and interaction polish
- [X] Settings UI
- [ ] Final desktop UX pass
- [ ] Reduce renderer bundle size with targeted code splitting

### Phase 5: Distribution

- [X] Electron Builder setup
- [ ] macOS `.dmg`
- [ ] Windows `.exe`
- [X] File associations
- [X] Replace web placeholder download links with real artifacts
- [ ] Create landing page with all this information and make it ready for production release

### Phase 6: Release Readiness

- [X] Wire `electron-updater` for packaged macOS and Windows builds
- [X] Surface app version in Settings from runtime metadata
- [X] Show update CTA in desktop header when a release is available
- [X] Automate versioning and root `CHANGELOG.md` from commits
- [X] Publish tagged releases from GitHub Actions
- [ ] Add Homebrew distribution flow for macOS
- [ ] Deploy landing page on Vercel for production subdomain
