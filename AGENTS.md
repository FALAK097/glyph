# Glyph — Agent Guidelines

## Repository Overview

pnpm monorepo with two apps:

- `apps/desktop` — Electron + React markdown editor (primary app)
- `apps/web` — Landing/download page

Package manager: **pnpm 10.26.0** (always use `pnpm`, never `npm` or `yarn`).

---

## Agent Skills

This repo ships local skills for various domains. **Load them before working on related tasks.**

| Skill                         | Path                                                  | When to load                                                                                |
| ----------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `electron`                    | `.agents/skills/electron/SKILL.md`                    | IPC, BrowserWindow, menus, tray, packaging, security, cross-platform Electron APIs          |
| `frontend-design`             | `.agents/skills/frontend-design/SKILL.md`             | When building frontend components/interfaces to ensure distinctive, production-grade design |
| `github-project-workflow`     | `.agents/skills/github-project-workflow/SKILL.md`     | When working on GitHub issues, PRs, roadmap execution, or project board status updates      |
| `remotion-best-practices`     | `.agents/skills/remotion-best-practices/SKILL.md`     | Best practices for Remotion - Video creation in React                                       |
| `vercel-react-best-practices` | `.agents/skills/vercel-react-best-practices/SKILL.md` | Performance and optimization guidelines for React/Next.js                                   |
| `web-design-guidelines`       | `.agents/skills/web-design-guidelines/SKILL.md`       | When reviewing UI, checking accessibility, UX audits, or verifying best practices           |

---

## UI/UX — Highest Priority

**UI/UX quality is the primary success criterion for this app.** Every interaction, animation, and visual detail matters. When in doubt between a faster implementation and a more polished one, choose polish.

### Interaction standards

- All interactive elements must respond within **1 frame (≤16 ms)**. If work takes longer, defer it off the critical path.
- Transitions and animations: use CSS transitions (`transition-*` Tailwind utilities or `@keyframes`) — never JS-driven `setInterval`/`requestAnimationFrame` loops for pure visual effects.
- No layout shifts. Reserve space for async content (skeleton states, fixed dimensions) so the UI never jumps.
- Keyboard-first: every action reachable via command palette or keyboard shortcut. Never ship a feature without keyboard access.
- Focus management is explicit and correct after every modal open/close, panel switch, and file navigation.
- Scroll positions are preserved when switching files or panels where the user would expect to return to their place.

### Visual quality

- Respect the OKLCH design token system — never hard-code hex/rgb color values.
- Pixel-perfect alignment: use Tailwind spacing scale (`gap-*`, `p-*`) consistently; avoid magic numbers.
- Dark mode must look intentional, not like an afterthought. Test every new component in both light and dark.
- Typography: use the defined font stack CSS variables (`--font-sans`, `--font-mono`, `--font-serif`). Never override with arbitrary font stacks.
- Icons must be consistent in size and optical weight throughout the app.

### Motion

- Prefer `will-change: transform` (not `will-change: all`) on animated elements.
- Default easing: `ease-out` for enter, `ease-in` for exit.
- Durations: micro-interactions 80–120 ms, panels/modals 150–200 ms. Nothing longer unless intentional.
- Respect `prefers-reduced-motion`: wrap non-essential animations in a media query check.

---

## Performance — Every Millisecond Counts

### React rendering

- **Never cause unnecessary re-renders.** Wrap stable callbacks in `useCallback`, expensive derived values in `useMemo`, with complete dependency arrays.
- Colocate state as low in the tree as possible; lift only when genuinely needed.
- Use `useDeferredValue` for any input that drives filtering/search — keeps the UI responsive while computation catches up.
- `React.memo` on pure leaf components that render frequently (sidebar file rows, editor decorations).
- Avoid anonymous object/array literals in JSX props — they create new references on every render.

### Zustand

- Select the smallest slice of state possible per component:

  ```ts
  // Good — only re-renders when activeFileId changes
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);

  // Bad — re-renders on any store update
  const store = useWorkspaceStore();
  ```

- Never call `getState()` inside render; only in event handlers and effects.

### Assets & bundles

- Lazy-load heavy components (`React.lazy` + `Suspense`) that are not needed on first paint (e.g., settings panel).
- Keep the renderer bundle lean — profile with `vite build --report` before adding large dependencies.
- Prefer tree-shakeable imports: `import { X } from 'lib'` over `import lib from 'lib'`.

### Electron / IPC

- IPC calls block the renderer's event loop while awaiting. Batch related reads into a single IPC call where possible.
- Heavy file-system or CPU work (directory traversal, search indexing) must run in the **main process** or a worker, never in the renderer.
- Use `invokeWithRetry` only for startup-sensitive calls — not as a general retry wrapper.
- Avoid synchronous IPC (`sendSync`) entirely.

---

## Cross-Platform (macOS & Windows)

Glyph targets **macOS and Windows**. Every feature must be tested mentally (and physically where possible) on both platforms.

### Path handling

- **Never concatenate paths with `/` or `\`** — always use Node's `path.join()` / `path.normalize()` in the main process.
- Normalize incoming paths from the renderer with `path.normalize()` before any file-system operation.
- Case sensitivity: Windows NTFS is case-insensitive; macOS HFS+ is case-insensitive by default. Write path comparisons case-insensitively: `a.toLowerCase() === b.toLowerCase()`.

### Window chrome & native menus

- On **macOS**: use the system menu bar (`Menu.setApplicationMenu`). The traffic-light buttons (close/minimize/zoom) must remain functional. `titleBarStyle: 'hiddenInset'` is acceptable for a custom look.
- On **Windows**: provide a custom title bar or use `titleBarStyle: 'hidden'` with explicit window controls rendered in the renderer. Ensure `frame: false` windows still expose close/minimize/maximize controls.
- Load the Electron skill (`electron` → `examples/api/menu.md`) before implementing or modifying menus.

### Keyboard shortcuts

- macOS uses `Cmd` (`Meta`); Windows uses `Ctrl`. Always register both via Electron's `globalShortcut` or `accelerator` using the `CommandOrControl` alias, never hard-code `Meta` or `Ctrl`.
- The `MODIFIER_TOKENS` constant in `shared/shortcuts.ts` is the single source of truth for shortcut definitions.

### File system differences

- Line endings: normalize to `\n` when reading; write with the OS default only if the file originally used it (preserve author intent).
- Watch paths with `chokidar` — already configured. Do not use `fs.watch` directly (inconsistent cross-platform behavior).
- `app.getPath('userData')` for settings storage — never hard-code `~/Library/...` or `%APPDATA%\...`.

### Native dialogs

- Always use `dialog.showOpenDialog` / `dialog.showSaveDialog` for file picking — they render native OS dialogs.
- Load the Electron skill (`electron` → `examples/api/dialog.md`) before adding any new dialog flow.

### Fonts & rendering

- ClearType vs. subpixel antialiasing behave differently. Test text rendering on Windows; prefer font weights 400 and 600 (avoid 300 on Windows — looks thin).
- Set `-webkit-font-smoothing: antialiased` in CSS only on macOS (use `@media` or platform detection if needed).

---

## Build, Dev & Lint Commands

Run all commands from the **repo root** unless noted otherwise.

### Development

```bash
pnpm dev:desktop          # Vite renderer + TSC watch + Electron (all at once)
pnpm dev:web              # Vite dev server for web app
```

### Build

```bash
pnpm build                # Build both apps
pnpm build:desktop        # Build desktop app only
pnpm build:web            # Build web app only
```

### Type Checking

```bash
pnpm typecheck            # Type-check both apps
pnpm typecheck:desktop    # Type-check desktop only
pnpm typecheck:web        # Type-check web only
```

### Linting

```bash
pnpm --filter @glyph/desktop lint   # runs: eslint . --ext ts,tsx
```

### Tests

There is currently **no test framework** set up. Update this section when tests are added.

---

## Project Structure

```
glyph/
├── .agents/skills/
│   └── electron/          # Local Electron skill (SKILL.md + api/ + examples/ + templates/)
├── apps/
│   ├── desktop/
│   │   ├── electron/
│   │   │   ├── main.ts        # Main process (IPC handlers, file system, settings)
│   │   │   └── preload.cts    # Context bridge — must stay .cts (CommonJS)
│   │   └── src/
│   │       ├── App.tsx        # Root React component + global state
│   │       ├── components/    # UI components (one file per component)
│   │       ├── shared/        # Types/constants shared between main & renderer
│   │       ├── store/         # Zustand store
│   │       ├── theme/         # Theme definitions
│   │       └── types/         # Third-party type augmentations (.d.ts)
│   └── web/
│       └── src/               # Landing page
└── pnpm-workspace.yaml
```

---

## TypeScript

- **Strict mode** is enabled — no `any`, no `@ts-ignore` without justification.
- Target: `ES2022`; renderer uses `ESNext` / `moduleResolution: Node`; Electron main/preload uses `NodeNext`.
- `noEmit: true` for renderer — Vite handles transpilation.
- Use `import type` for type-only imports:

  ```ts
  import type { AppSettings, DirectoryNode } from "./shared/workspace";
  ```

---

## Code Style

### Imports

- Group order: external → internal absolute → relative, separated by blank lines.
- Always `import type` for type-only imports. Named imports preferred; avoid `* as` namespace imports.

### Naming Conventions

| Entity             | Convention           | Example                                |
| ------------------ | -------------------- | -------------------------------------- |
| React components   | PascalCase           | `MarkdownEditor`, `CommandPalette`     |
| Functions / hooks  | camelCase            | `flattenFiles`, `useWorkspace`         |
| Types / interfaces | PascalCase           | `AppSettings`, `DirectoryNode`         |
| Constants          | SCREAMING_SNAKE_CASE | `DEFAULT_SHORTCUTS`, `MODIFIER_TOKENS` |
| CSS class names    | kebab-case           | `editor-canvas`, `sidebar-file`        |
| IPC channel names  | `domain:action`      | `workspace:open`, `settings:save`      |

### Exports

- **Named exports everywhere** in the desktop app — no default exports.
- Web `App.tsx` uses a default export for framework compatibility only.

### Components

```tsx
type EditorPaneProps = {
  file: FileDocument;
  onChange: (content: string) => void;
};

export function EditorPane({ file, onChange }: EditorPaneProps) {
  // 1. hooks
  // 2. derived values / memos
  // 3. event handlers (named arrow functions assigned to consts)
  // 4. return JSX
}
```

### State Management

- Zustand v5, plain `set()` only — no `immer`. Local UI state in `useState`.
- `useMemo` / `useCallback` with complete deps. `useDeferredValue` for search/filter inputs.

### Async Patterns

```ts
void boot(); // fire-and-forget — void-prefix, no floating promises

useEffect(() => {
  const boot = async () => { ... };
  void boot();
}, [deps]);

useEffect(() => {
  return glyph.onExternalFile(async (target) => { ... }); // cleanup returned
}, [deps]);
```

### Error Handling

```ts
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

try {
  const saved = await glyph.saveFile(path, content);
  markSaved(saved);
} catch (err) {
  setError(err instanceof Error ? err.message : "Unable to save file.");
}

try {
  await fs.access(filePath);
} catch {
  // File does not exist — skip
}
```

### IPC (Electron)

- Channels: `workspace:*`, `settings:*`, `dialog:*`, `app:*`, `sidebar:*`.
- Expose renderer API only via `contextBridge.exposeInMainWorld("glyph", api)`.
- Validate and sanitize all inputs in the main process. Never use `sendSync`.

---

## Styling

- **Tailwind v4** via `@tailwindcss/vite` — utility classes directly in JSX.
- Design tokens: OKLCH CSS custom properties in `apps/desktop/src/styles.css`. Never hard-code colors.
- Dark mode: class-based (`.dark`), `applyTheme()` at runtime. Use `dark:` variants.
- Semantic class names for complex layout elements. No `style={{}}` unless truly dynamic.

---

## Key Invariants

- `preload.cts` must remain CommonJS — Electron's sandbox requires it.
- `apps/desktop/src/shared/` is framework-agnostic — no React imports.
- `README.md` is the maintained product and workflow reference for this repo.
- Context isolation and sandbox are **enabled** — never disable them.
- The renderer has no Node.js/Electron access — all OS/file ops go through the `glyph` preload API.
- All Electron work must reference `.agents/skills/electron/` for patterns, API signatures, and security best practices.
