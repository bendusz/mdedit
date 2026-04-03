# mdedit Tier 1 MVP — Handover Document

**Date:** 2026-04-03
**Status:** Tier 1 MVP complete, ready for manual testing and first release build

---

## What Was Built

mdedit is a minimalist, single-file markdown editor for macOS with Obsidian-style live preview. The Tier 1 MVP delivers a fully functional editor that opens, edits, previews, and saves markdown files with a native desktop experience.

### Metrics

| Metric | Value |
|--------|-------|
| Source code | 2,777 lines across 27 source files |
| Test code | 1,359 lines across 12 test files |
| JS tests | 106 passing |
| Rust tests | 8 passing |
| Commits | 42 (4 spec/plan, 25 features, 13 Codex review fixes) |
| Codex reviews | 12 reviews performed, 22 issues found and fixed |

---

## Architecture

### Two-Package Monorepo

```
mdedit/
├── packages/core/     @mdedit/core — Standalone CM6 library (zero Tauri/Svelte deps)
├── apps/desktop/      @mdedit/desktop — Tauri 2 + SvelteKit 2 app shell
└── pnpm-workspace.yaml
```

**`@mdedit/core`** is a pure TypeScript library that wraps CodeMirror 6. It provides:
- `createEditor()` factory with live preview, markdown parsing, syntax highlighting
- 9 decoration plugins (headings, bold/italic/strikethrough, links, images, code blocks, blockquotes, horizontal rules, lists/checkboxes, tables)
- 11 toolbar commands (toggleBold, toggleItalic, setHeading, insertLink, insertTable, etc.)
- 5 keyboard shortcuts (Cmd+B/I/K, Cmd+Shift+X/C)
- Cursor info observer (line, col, word count)
- Light and dark themes with dynamic switching
- `isFileLoad` annotation to distinguish programmatic loads from user edits
- `detectLineSeparator()` for CRLF/LF preservation
- `isSafeImageSrc()` URI security policy

**`@mdedit/desktop`** is the Tauri 2 + SvelteKit app that wraps the core:
- Svelte 5 components: Editor, Toolbar, StatusBar
- Reactive stores: fileState (Svelte 5 runes), themeState
- Rust backend: file I/O commands, native dialogs, menu, recent files
- System integration: drag-and-drop, file association, window title, theme follow

### Security Boundary

The Rust backend owns **all** filesystem access and native dialogs. The webview has no ambient filesystem or dialog permissions. Communication flows through Tauri `invoke()`:

```
Frontend (Svelte)  →  invoke('open_file_dialog')  →  Rust: show dialog + read file  →  {content, path}
Frontend (Svelte)  →  invoke('save_file', {path, content})  →  Rust: validate path + atomic write  →  Ok
```

Tauri capabilities are minimal: `core:default`, `core:window:allow-set-title`, `core:window:allow-close`, `core:window:allow-destroy`, `opener:default`, `dialog:default`, `deep-link:default`. No `fs:*` permissions.

---

## Feature Inventory

### Live Preview (Obsidian-style)

| Element | Decoration Type | Behavior |
|---------|----------------|----------|
| Headings H1-H6 | Line decoration + replace | Styled large text, `#` hidden. Reveals on cursor. Supports ATX and setext. |
| Bold `**text**` | Mark + replace | Bold styling, `**` markers hidden. Handles nested emphasis. |
| Italic `*text*` | Mark + replace | Italic styling, `*` markers hidden. Guard against bold/italic confusion. |
| Strikethrough `~~text~~` | Mark + replace | Line-through styling, `~~` hidden. |
| Links `[text](url)` | Mark + replace | Blue underlined text, URL hidden. Display-only (no navigation). Only styled if URL present. |
| Images `![alt](src)` | Block widget (StateField) | Renders `<img>` below the line. URI security: blocks http/https/javascript/protocol-relative. Allows file://, data:image/, relative paths. Resolves relative paths via `imageBasePath` facet. |
| Code blocks | Line decoration + replace | Gray background, monospace font. Fence lines hidden when cursor outside. Language-aware syntax highlighting via `@codemirror/language-data`. |
| Blockquotes | Line decoration + replace | Left border, italic, gray. `>` markers hidden via Lezer QuoteMark nodes. |
| Horizontal rules | Widget (replace) | `---`/`***`/`___` replaced with styled `<hr>`. Reveals on cursor. |
| Lists | Line decoration | Standard list rendering. |
| Task checkboxes | Widget (replace) | `- [ ]`/`- [x]` replaced with interactive checkbox. **Clicking toggles the checkbox in the markdown source.** Supports ordered markers and uppercase X. Preserves indentation for nested items. |
| Tables | Line decoration | Monospace styling on table lines. |

### Toolbar

11 buttons grouped with separators: **B** | *I* | ~~S~~ | H (dropdown H1-H6) | Link | Img | Code | List | Task | Table | HR

Each button calls the corresponding `@mdedit/core` command and refocuses the editor. ARIA labels and shortcut hints included.

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+B | Toggle bold |
| Cmd+I | Toggle italic |
| Cmd+Shift+X | Toggle strikethrough |
| Cmd+K | Insert link |
| Cmd+Shift+C | Insert code block |
| Cmd+O | Open file |
| Cmd+S | Save |
| Cmd+Shift+S | Save As |
| Cmd+N | New file |
| Cmd+F | Search (CM6 built-in) |

### File Operations

- **Open:** Cmd+O shows native macOS dialog (Rust-side), filtered to .md/.markdown/.mdx
- **Save:** Cmd+S atomic write (temp file + rename) to known path
- **Save As:** Cmd+Shift+S shows native save dialog (Rust-side)
- **New:** Cmd+N creates empty document (guards unsaved changes)
- **Drag-and-drop:** Drop .md file from Finder onto window
- **File association:** .md files registered with mdedit via `fileAssociations` in tauri.conf.json + deep-link plugin
- **Recent files:** Last 10 files persisted in Tauri app data directory as JSON

### Status Bar

Bottom bar showing: `Ln X, Col Y | N words` (left) | `UTF-8 | Saved/Unsaved` (right)

Updates on both content changes and cursor movement (not just edits).

### Theme Support

- Follows macOS system appearance (light/dark) via `prefers-color-scheme` media query
- Manual toggle available via `themeState.toggle()`
- CSS variables for toolbar, status bar, editor chrome
- CM6 theme compartment for dynamic switching without editor recreation

### Auto-Save

2-second debounce after last edit. Uses revision tracking (`markSaved(atRevision)`) so a stale auto-save that completes after new edits doesn't clear the dirty flag. Errors are caught — failed saves keep the dirty indicator visible.

### Native Menu Bar

- **mdedit:** About, Services, Hide, Quit
- **File:** New, Open, Save, Save As, Close Window
- **Edit:** Undo, Redo, Cut, Copy, Paste, Select All

Menu events emitted to frontend via `app.emit('menu-event', id)`.

### Window Title

Reactive: `filename — mdedit` when saved, `● filename — mdedit` when dirty, `Untitled — mdedit` for new files.

### Spellcheck

Native macOS spellcheck enabled via `EditorView.contentAttributes.of({ spellcheck: 'true' })`. Red underlines on misspelled words, right-click suggestions — all from WebKit.

---

## Data Integrity & Stability

| Scenario | Behavior |
|----------|----------|
| Save | Atomic write: temp file (`.mdedit-save-{pid}`) in same directory, then rename. Temp cleaned up on failure. |
| Auto-save race | Revision counter prevents stale save from clearing dirty flag |
| Open while dirty | Auto-saves current file before opening new one |
| Drop while dirty | Same as above |
| Close while dirty (named file) | Auto-saves, then closes. If save fails, window stays open. |
| Close while dirty (untitled) | Shows Save As dialog. If user cancels, window stays open. |
| File load → dirty flag | `isFileLoad` annotation on CM6 transaction. `updateListener` skips `onDocChange` for annotated loads. No `suppressDirty` hack. |
| CRLF files | `detectLineSeparator()` detects on open. `contentForSave()` restores CRLF before writing. |
| Relative paths | Rejected by Rust `validate_and_read()` — must be absolute. |
| Non-UTF-8 files | Rust `read_to_string` returns error — handled gracefully. |

---

## Security Measures

| Area | Policy |
|------|--------|
| Filesystem access | Webview has no fs permissions. All I/O through explicit Rust commands. |
| Dialogs | Shown by Rust — webview doesn't import `@tauri-apps/plugin-dialog`. |
| Path validation | Rust rejects relative paths. |
| Image URIs | `isSafeImageSrc()` blocks http, https, javascript:, protocol-relative (`//`), non-image data: URIs. Allows file://, data:image/, relative paths. |
| Link rendering | Display-only (CSS styling). No `<a href>` elements — no navigation. |
| Tauri capabilities | Minimal: core, window title/close, opener, dialog, deep-link. No fs or shell permissions. |

---

## Test Coverage

### Core Library (Vitest, jsdom)

| Test File | Tests | Covers |
|-----------|-------|--------|
| `smoke.test.ts` | 1 | Module import |
| `editor.test.ts` | 3 | createEditor, content init, onDocChange |
| `decorations.test.ts` | 3 | Heading H1-H6 decorations |
| `inline-decoration.test.ts` | 10 | Bold, italic, strikethrough, marker hiding, nesting |
| `link-decoration.test.ts` | 6 | Link styling, syntax hiding, display-only |
| `image-widget.test.ts` | 15 | URI safety, widget rendering, blocking, data URIs |
| `code-block.test.ts` | 8 | Code block styling, fence hiding, cursor reveal |
| `block-elements.test.ts` | 11 | Blockquotes, HR, task lists, tables |
| `commands.test.ts` | 32 | All 11 toolbar commands (wrap, unwrap, headings, lists, tables) |
| `observers.test.ts` | 8 | Cursor position, word count, edge cases |
| `search.test.ts` | 1 | Search extension loaded |
| `security.test.ts` | 8 | URI scheme policy (8 scenarios) |

### Rust Backend (cargo test)

| Tests | Covers |
|-------|--------|
| 8 | File open, atomic save, temp cleanup, nonexistent files, relative path rejection, binary file handling |

---

## File Inventory

### Core Library (`packages/core/src/`)

| File | Purpose |
|------|---------|
| `index.ts` | Public API barrel export |
| `editor.ts` | `createEditor()`, `loadEditorContent()`, `setEditorTheme()`, `detectLineSeparator()`, `isFileLoad` annotation |
| `theme.ts` | Light and dark CM6 themes |
| `observers.ts` | `getCursorInfo()` — line, col, word count |
| `toolbar/commands.ts` | 11 formatting commands |
| `toolbar/keybindings.ts` | 5 keyboard shortcuts |
| `extensions/live-preview.ts` | Barrel: assembles all decorations + styles into `livePreview()` |
| `extensions/heading-decoration.ts` | ATX + setext heading decorations |
| `extensions/inline-decoration.ts` | Bold, italic, strikethrough with nested emphasis handling |
| `extensions/link-decoration.ts` | Link text styling, URL hiding |
| `extensions/image-widget.ts` | Image widget, URI security, `imageBasePath` facet |
| `extensions/code-block.ts` | Fenced code block decorations |
| `extensions/blockquote-decoration.ts` | Blockquote styling with Lezer QuoteMark nodes |
| `extensions/hr-decoration.ts` | Horizontal rule widget |
| `extensions/list-decoration.ts` | List decoration, interactive checkbox widget |
| `extensions/table-decoration.ts` | Table line decoration |

### Desktop App (`apps/desktop/src/`)

| File | Purpose |
|------|---------|
| `routes/+page.svelte` | Main page: wires editor, toolbar, status bar, file ops, keyboard shortcuts, auto-save, drag-drop, menu events, theme, window title, close guard |
| `routes/+layout.svelte` | Root layout with CSS import |
| `routes/+layout.ts` | `ssr = false` (SPA mode) |
| `lib/components/Editor.svelte` | CM6 wrapper with `loadFile()`, `getView()` |
| `lib/components/Toolbar.svelte` | 11-button formatting toolbar with heading dropdown |
| `lib/components/StatusBar.svelte` | Line/col, word count, save state display |
| `lib/stores/fileState.svelte.ts` | Reactive file state with revision tracking and line separator detection |
| `lib/stores/theme.svelte.ts` | System theme follow + manual toggle |
| `lib/tauri/fileOps.ts` | Thin invoke wrappers for Rust commands |
| `app.css` | Global styles with CSS variables for light/dark |

### Rust Backend (`apps/desktop/src-tauri/src/`)

| File | Purpose |
|------|---------|
| `main.rs` | Entry point |
| `lib.rs` | Tauri builder: plugins, commands, menu setup |
| `commands.rs` | 4 Tauri commands: `open_file`, `open_file_dialog`, `save_file`, `save_file_as_dialog` + tests |
| `menu.rs` | Native macOS menu bar (File + Edit) |
| `recent_files.rs` | JSON persistence of recent files in app data dir |

---

## Known Limitations (Tier 1 Scope)

These are intentional scope boundaries, not bugs. They are tracked for Tier 2/3:

1. **No YAML frontmatter rendering** — raw YAML is visible (Tier 2)
2. **No command palette** — Cmd+Shift+P not implemented (Tier 2)
3. **No outline/TOC sidebar** — heading navigation not available (Tier 2)
4. **No image paste handling** — can't paste images from clipboard (Tier 2)
5. **No reading mode** — always in edit mode (Tier 2)
6. **No visual table editor** — tables edited as raw markdown (Tier 2)
7. **No export** — no PDF or HTML export (Tier 2)
8. **No Mermaid/LaTeX** — diagrams and math not rendered (Tier 3)
9. **No zen/focus mode** — no distraction-free editing (Tier 3)
10. **No auto-updater** — manual updates only (Tier 3)
11. **macOS only** — Windows/Linux builds planned for Tier 3
12. **Confirm discard dialog** — currently auto-saves rather than showing a 3-way Save/Don't Save/Cancel dialog. Proper native dialog planned.
13. **Open Recent menu** — recent files are persisted but not yet surfaced as a submenu in the File menu
14. **Window state persistence** — window size/position not restored between sessions

---

## How to Run

```bash
# Install dependencies
pnpm install

# Development (Tauri + Vite hot reload)
pnpm dev

# Run core library tests
pnpm test

# Run Rust tests
cd apps/desktop/src-tauri && cargo test

# Type checking
cd apps/desktop && pnpm check

# Production build
pnpm build
```

---

## Design Documents

- **Spec:** `docs/superpowers/specs/2026-04-02-mdedit-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-02-mdedit-tier1-mvp.md`
- **Project conventions:** `CLAUDE.md`

---

## Codex Review Summary

12 Codex GPT-5.4 reviews were performed during development. 22 issues were found and fixed before merging:

| Task | Findings | Key Issues Fixed |
|------|----------|-----------------|
| 1 (Scaffold) | 2x P2 | Root scripts didn't invoke Tauri toolchain |
| 2 (Editor factory) | 1x P2 | CRLF normalization — added `detectLineSeparator` |
| 3 (Mount editor) | 0 | Clean pass |
| 4 (File I/O) | 2x P2 | Case-sensitive key matching, CRLF in save path |
| 5 (Headings) | 1x P2, 1x P3 | Missing setext headings, ATX spacing artifacts |
| 6 (Inline) | 2x P2 | Multiline spans, nested emphasis in Link nodes |
| 7 (Links) | 1x P1 | Links without URL destination got styled |
| 8 (Images) | 1x P1, 2x P2 | Protocol-relative URLs, regex vs Lezer, relative path resolution |
| 9 (Code blocks) | 1x P1, 1x P2 | Empty fence rows, indentation in preview |
| 10 (Block elements) | 3x P2 | Ordered markers, nested indentation, Lezer quote marks |
| 11 (Commands) | 1x P1, 2x P2 | Bold/italic marker confusion, checked task toggle |
| 15-19 (Batch) | 1x P1, 1x P2 | Drag-drop dirty guard, window title permission |
| 23-25 (Final) | 1x P1, 1x P2 | Untitled doc on close, save failure keeps window open |
