# Typist PRD

Source of truth for scope, architecture, and delivery status.

## Product

Typist is a markdown product with two apps:

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
- `react-markdown`
- `remark-gfm`
- `chokidar`

Web:

- React
- Vite
- TypeScript

Planned later:

- TipTap or ProseMirror
- Shiki
- KaTeX
- Mermaid
- FlexSearch

## Repo Shape

```text
typist/
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
- desktop file open and folder open
- recursive markdown sidebar
- markdown preview
- editable markdown source pane
- save flow
- autosave
- file watching and safe refresh
- unsaved-change protection
- native menu commands
- new file / new folder flows
- basic markdown formatting toolbar
- global workspace search with result snippets
- quick open with `Cmd/Ctrl+P`
- desktop dev startup hardened with renderer retry + preload failure fallback
- standalone web landing page
- placeholder download buttons

In progress:

- richer editor beyond textarea + toolbar
- better file and folder creation UX
- better OS-level open-with integration

Not started:

- global search
- themes
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
- [X] Open markdown file
- [X] Open markdown folder
- [X] Recursive sidebar explorer
- [X] File switching
- [X] Live markdown preview
- [X] Save file
- [X] Watch external file changes
- [ ] Finder / Explorer open-with integration
- [ ] Better empty and loading states

### Phase 2: Editor

- [X] Editable markdown source pane
- [X] Autosave
- [X] Basic formatting toolbar
- [X] New file flow
- [X] New folder flow
- [ ] Replace textarea with markdown-aware editor abstraction
- [ ] Inline WYSIWYG editing
- [ ] Better insertion and selection behavior
- [ ] Drag-and-drop image support
- [ ] Rich keyboard formatting shortcuts

### Phase 3: Power Features

- [X] Global search
- [ ] Themes
- [X] Quick open
- [ ] Command palette
- [ ] Export markdown
- [ ] Export PDF

### Phase 4: Polish

- [ ] Typography refinement
- [ ] Better code block presentation
- [ ] Motion and interaction polish
- [ ] Settings UI
- [ ] Final desktop UX pass

### Phase 5: Distribution

- [ ] Electron Builder setup
- [ ] macOS `.dmg`
- [ ] Windows `.exe`
- [ ] File associations
- [ ] Replace web placeholder download links with real artifacts

## Next Up

1. Replace the textarea editor with a markdown-aware editing layer.
2. Add a fuller command palette on top of quick open and search.
3. Improve creation flows with real dialogs instead of prompts.
4. Add packaging so the web app can ship real downloads.
