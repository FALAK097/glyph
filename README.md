# Typist

Typist is a workspace repo with:

- `apps/desktop`: Electron markdown editor/viewer
- `apps/web`: landing page and download surface

The current source of truth for scope and progress is [prd.md](/Users/falakgala/projects/typist/prd.md).

## Requirements

- Node.js 20+ recommended
- `pnpm` 10+

## Setup

From the repo root:

```bash
pnpm install
```

If Electron is ever missing after install, run:

```bash
pnpm install
```

That workspace install also restores the Electron binary.

## Run

Desktop app:

```bash
pnpm dev:desktop
```

If the Electron window opens before the renderer is ready, restart once after pulling the latest changes. The desktop app now waits for the HTTP dev server and retries renderer boot in development.

Web landing page:

```bash
pnpm dev:web
```

## Build

Build everything:

```bash
pnpm build
```

Build only desktop:

```bash
pnpm build:desktop
```

Build only web:

```bash
pnpm build:web
```

## Typecheck

Typecheck everything:

```bash
pnpm typecheck
```

Typecheck desktop only:

```bash
pnpm typecheck:desktop
```

Typecheck web only:

```bash
pnpm typecheck:web
```

## Project Layout

```text
typist/
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   └── src/
│   └── web/
│       └── src/
├── package.json
├── pnpm-workspace.yaml
├── prd.md
└── README.md
```

## Current Desktop Capabilities

- open markdown files
- open markdown folders
- browse files in a sidebar
- edit markdown source
- live preview rendered markdown
- quick open with `Cmd/Ctrl+P`
- global workspace search with `Cmd/Ctrl+Shift+F`
- autosave
- create new files and folders
- basic formatting toolbar

## Current Web Capabilities

- landing page
- placeholder download buttons for macOS and Windows

## Notes

- Desktop packaging is not implemented yet, so the web download links are placeholders.
- The desktop editor is still textarea-based; richer inline editing is the next major step.
- I validated the repo with `pnpm typecheck`, `pnpm build`, and React Doctor, but I have not visually verified the running UI from this environment.
