# mdedit — Design Specification

A minimalist, single-file markdown editor for macOS (later Windows and Linux) with Obsidian-quality live preview rendering, built for users who don't know markdown syntax.

## Motivation

The growth of AI tooling (Claude Code skills, CLAUDE.md files, etc.) has created a surge of single-file markdown editing needs. VS Code renders markdown poorly. Obsidian is overkill (vaults, plugins, sync). There's a gap for a focused, beautiful, single-file markdown editor that "just works."

## Core Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Editing paradigm | Live Preview (Obsidian-style) | Single pane, renders inline, reveals raw markdown at cursor. Best UX for non-markdown users. |
| Application shell | Tauri 2 | Native webview, ~5-10MB app size, cross-platform from day one. CodeMirror 6 access without Electron's 300MB overhead. |
| Editor engine | CodeMirror 6 | Industry standard for live preview. Lezer parser + decoration API. Battle-tested in Obsidian, Zed, etc. |
| Frontend framework | Svelte | Small bundle, compiles away, Tauri's recommended pairing. Right fit for a single-view app. |
| Architecture | Core library + App shell | `@mdedit/core` (standalone CM6 library) + `apps/desktop` (Tauri+Svelte wrapper). Core is testable in a browser without Tauri. |
| Theming | System-follow + manual toggle | Light/dark follows OS, user can override. Extensible theme architecture for later tiers. |

## Project Structure

```
mdedit/
├── packages/
│   └── core/                    # @mdedit/core — standalone CM6 library
│       ├── src/
│       │   ├── extensions/      # CM6 extensions (live preview, syntax, etc.)
│       │   ├── toolbar/         # Toolbar action definitions (bold, italic, etc.)
│       │   ├── parser/          # Markdown parsing configuration
│       │   └── index.ts         # Public API
│       ├── test/
│       └── package.json
├── apps/
│   └── desktop/                 # Tauri + Svelte app shell
│       ├── src/                 # Svelte frontend
│       │   ├── lib/
│       │   │   ├── components/  # Toolbar, StatusBar, Editor, CommandPalette
│       │   │   ├── stores/      # Svelte stores (theme, file state, config)
│       │   │   └── tauri/       # Tauri API wrappers (file I/O, dialogs, menus)
│       │   ├── App.svelte
│       │   └── main.ts
│       ├── src-tauri/           # Rust backend
│       │   ├── src/
│       │   │   ├── main.rs
│       │   │   ├── commands.rs  # Tauri commands (file ops, recent files, etc.)
│       │   │   └── menu.rs      # Native menu setup
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
└── CLAUDE.md
```

Monorepo managed with pnpm workspaces. `@mdedit/core` is a workspace dependency of `apps/desktop`.

## Core Library Architecture (`@mdedit/core`)

### Data Flow

```
Raw .md file → CM6 EditorState → Lezer Markdown Parser → Syntax Tree (AST)
    → Decoration ViewPlugin → Rendered Output
```

Cursor position determines which decorations are active. When the cursor is away from a line, markdown syntax is hidden and content is rendered (e.g., `# Heading` becomes a styled heading). When the cursor moves onto that line, raw markdown is revealed for editing.

### CM6 Extension Stack

- **Live Preview** — Decorations that replace markdown syntax with rendered output. Uses three CM6 decoration types:
  - Mark decorations: style ranges (e.g., bold text)
  - Replace decorations: hide syntax characters (e.g., `#`, `**`)
  - Widget decorations: insert rendered DOM (e.g., images, checkboxes)
- **Syntax Highlighting** — Colors for markdown tokens when raw source is visible at cursor
- **Code Block Highlighting** — Language-aware syntax colors inside fenced code blocks
- **Toolbar Actions** — Commands: toggleBold, toggleItalic, toggleStrikethrough, setHeading, insertLink, insertImage, insertCodeBlock, toggleList, toggleTaskList, insertTable, insertHorizontalRule
- **Keybindings** — Cmd+B (bold), Cmd+I (italic), Cmd+K (link), etc.
- **Image Widgets** — Render images inline below the reference line

### Public API

```typescript
// Create a fully configured editor
createEditor(config: EditorConfig): EditorView

// Toolbar commands
toggleBold, toggleItalic, toggleStrikethrough, setHeading,
insertLink, insertImage, insertCodeBlock, toggleList,
toggleTaskList, insertTable, insertHorizontalRule

// State observers
onDocChange(callback): void
getCursorInfo(): { line, col, wordCount }

// Theme
setTheme(theme: 'light' | 'dark'): void
```

## App Shell Architecture (Tauri + Svelte)

### Svelte Component Tree

**Tier 1 (solid border):**
- `App.svelte` — Root, owns layout and global state
- `Toolbar.svelte` — Formatting buttons, calls core toolbar commands
- `Editor.svelte` — Mounts CM6 EditorView from @mdedit/core
- `StatusBar.svelte` — Line/col, word count, save state, encoding

**Later tiers (dashed border):**
- `CommandPalette.svelte` — Cmd+Shift+P searchable action list
- `OutlineSidebar.svelte` — Heading-based document navigation
- `Settings.svelte` — User preferences UI
- `TableEditor.svelte` — Visual table editing overlay

### Rust Backend Responsibilities

**File Operations:**
- `open_file` — Native dialog → read → return content + path
- `save_file` — Write content to path
- `save_file_as` — Native dialog → write
- `get_recent_files` — Persisted recent files list

**System Integration:**
- Native file open/save dialogs
- `.md` file type association
- Window title (filename + unsaved indicator)
- macOS native menu bar

**Preferences:**
- Theme preference (light/dark/system)
- Window size and position (restored on launch)
- Auto-save setting
- Recent files list

### Frontend ↔ Backend Communication

- **Frontend → Backend:** Tauri `invoke()` — async RPC calls (e.g., `invoke('open_file')`)
- **Backend → Frontend:** Tauri event system (e.g., `listen('file-dropped')`)
- The webview has no ambient filesystem access — all file operations go through explicitly exposed Rust commands (Tauri security model)

## File Handling

All standard mechanisms supported:
- **Cmd+O** — Native open dialog filtered to `.md` files
- **Drag-and-drop** — Drop a `.md` file onto the window
- **File association** — Register as system handler for `.md` files (double-click opens in mdedit)
- **File > Open Recent** — Recently opened files list

## UI Layout

Toolbar + Editor + Status Bar:
- **Toolbar** (top): Formatting buttons — Bold, Italic, Strikethrough, Heading levels, Link, Image, Code, Lists, Table, Horizontal Rule
- **Editor** (center): Full-width CM6 live preview surface
- **Status Bar** (bottom): Line/Col, word count, encoding (UTF-8), save state indicator

## Markdown Feature Tiers

### Tier 1 — CommonMark + GFM Basics
- Headings (H1-H6)
- Bold, italic, strikethrough
- Links (inline and reference)
- Images (inline rendering)
- Ordered and unordered lists
- Task checkboxes (interactive)
- Fenced code blocks with syntax highlighting
- Blockquotes
- Horizontal rules
- Tables (GFM)

### Tier 2 — Extended Features
- YAML frontmatter rendering
- Nested blockquotes
- Inline HTML rendering

### Tier 3 — Advanced
- Mermaid diagram rendering
- LaTeX/math equations
- Footnotes
- Emoji shortcodes (`:rocket:` → 🚀)
- Admonitions/callouts (Obsidian-style `> [!note]`)

## Feature Roadmap

### Tier 1 — Usable Editor (MVP)

**Core library:**
- CM6 editor with Lezer markdown parser
- Live preview decorations for all CommonMark + GFM elements
- Toolbar commands and keybindings
- Cursor info observer
- Light/dark theme support

**App shell:**
- Toolbar, Editor, StatusBar components
- File open/save/save-as
- Drag-and-drop, file association, recent files
- Native macOS menu bar
- System theme follow + manual toggle
- Auto-save with unsaved indicator
- Search & replace (Cmd+F / Cmd+H) — CM6 built-in
- Undo/redo — CM6 built-in
- Native spell checking — free from WebKit

**Build sequence:**
1. Project scaffolding (Tauri + Svelte + pnpm workspace + core package)
2. Basic CM6 editor in core (no live preview yet, just markdown editing)
3. Wire editor into Tauri shell (file open/save working)
4. Live preview decorations (headings, bold, italic, links)
5. Remaining CommonMark/GFM decorations (tables, code blocks, images, lists)
6. Toolbar + keybindings
7. Status bar
8. Auto-save, recent files, file association, drag-and-drop
9. Theme support
10. Polish and first release

### Tier 2 — Power Features
- YAML frontmatter rendering
- Nested blockquote support
- Inline HTML rendering
- Command palette (Cmd+Shift+P)
- Outline/TOC sidebar
- Image paste handling (clipboard → save alongside .md → insert reference)
- Reading mode toggle
- Visual table editor
- Export to HTML
- Export to PDF
- Configurable content width
- Additional themes
- Print support

### Tier 3 — Polish & Extended Markdown
- Mermaid diagram rendering
- LaTeX/math equation rendering
- Footnotes
- Emoji shortcodes
- Admonitions/callouts
- Zen/focus mode
- Typewriter scrolling
- Frontmatter structured editor
- Auto-updater (Tauri updater plugin)
- Windows + Linux release builds

## Development Rules

- Before implementing any feature, always check the latest online documentation for the relevant libraries (Tauri 2, CodeMirror 6, Svelte, Lezer, etc.). These libraries evolve actively — do not rely on cached knowledge.
- Each tier builds on the previous one. Do not start Tier 2 features until Tier 1 is stable and usable.
- Features within a tier can be tackled in any order, one at a time.
