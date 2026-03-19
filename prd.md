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
- recent files in sidebar
- single-pane TipTap editor surface
- save flow
- autosave
- file watching and safe refresh
- native command palette with `Cmd/Ctrl+P`
- new note / previous note / next note commands
- global search and file search through palette
- theme switching and theme preview through palette
- persisted settings for workspace path and theme mode
- desktop dev startup hardened with renderer retry + preload failure fallback
- standalone web landing page
- placeholder download buttons

In progress:

- [X] stronger markdown fidelity and richer inline shortcuts
- [X] better file and folder creation UX
- [X] better OS-level open-with integration

Not started:

- export
- drag-and-drop image import
- syntax highlighting
- mermaid
- math
- quick open / command palette
- packaging and installers

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
- [ ] New folder flow inside command palette
- [X] Stronger inline markdown shortcut behavior
- [X] Better insertion and selection behavior
- [ ] Drag-and-drop image support
- [X] Rich keyboard formatting shortcuts
- [ ] Provide copy icon for code blocks
- [ ] Provide copy icon for table
- [X] Provide delete icon for images
- [X] Open interlinked md files within editor
- [ ] Improve markdown task-list shortcut conversion (`- [ ]`, `- [x]`)

### Phase 3: Power Features

- [X] Global search
- [X] Themes
- [X] Quick open
- [X] Command palette
- [ ] Saved command history / smarter ranking
- [ ] Export markdown
- [ ] Export PDF

### Phase 4: Polish

- [ ] Typography refinement
- [ ] Better code block presentation
- [ ] Motion and interaction polish
- [ ] Settings UI
- [ ] Final desktop UX pass
- [ ] Reduce renderer bundle size with targeted code splitting

### Phase 5: Distribution

- [ ] Electron Builder setup
- [ ] macOS `.dmg`
- [ ] Windows `.exe`
- [ ] File associations
- [ ] Replace web placeholder download links with real artifacts
- [ ] Create landing page with all this information and make it ready for production release
