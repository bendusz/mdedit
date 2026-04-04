# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mdedit is a minimalist single-file markdown editor with Obsidian-style live preview, targeting macOS first (Windows/Linux later). It renders markdown inline in a single pane — headings get big, bold gets bold, code blocks get highlighted — while revealing raw markdown at the cursor position.

## Architecture

Monorepo with two packages connected via pnpm workspaces (`workspace:*` protocol):

- **`packages/core`** (`@mdedit/core`) — Standalone CodeMirror 6 editor library. No Tauri or Svelte dependency. Exports `createEditor()`, live preview decorations, toolbar commands, and observers. Testable in a browser without Tauri.
- **`apps/desktop`** (`@mdedit/desktop`) — Tauri 2 + SvelteKit 2 app shell. Uses `adapter-static` in SPA mode (`ssr = false`). Routes at `src/routes/`, components at `src/lib/components/`, stores at `src/lib/stores/`.

### Security Boundary

The Rust backend owns all filesystem access and native dialogs. The webview has no ambient filesystem or dialog permissions — it calls high-level Tauri commands (`open_file_dialog`, `save_file`, `save_file_as_dialog`) via `invoke()` and receives only content and metadata. File paths are validated as absolute in Rust. Saves use atomic write (temp file + rename).

### File State Model

`fileState.svelte.ts` tracks path, filename, content, dirty flag, revision counter, and original line separator. The `isFileLoad` CM6 annotation distinguishes programmatic loads from user edits — `loadEditorContent()` dispatches annotated transactions that skip `onDocChange`, preventing file opens from marking the document dirty. Revision-based `markSaved(atRevision)` prevents stale autosave from clearing the dirty flag.

## Commands

```bash
pnpm dev              # Run Tauri desktop app in dev mode (Vite + Rust backend)
pnpm build            # Build core lib, then Tauri desktop bundle (needs cargo in PATH)
pnpm test             # Run all tests: core (Vitest) + desktop (Vitest)
pnpm core:dev         # Watch-build core library

# Single test file
pnpm --filter @mdedit/core test -- test/commands.test.ts
pnpm --filter @mdedit/desktop test  # Run desktop tests only

# Watch mode (re-runs on changes)
pnpm --filter @mdedit/core test:watch

# Rust tests (cargo must be in PATH)
cd apps/desktop/src-tauri && PATH="$HOME/.cargo/bin:$PATH" cargo test

# SvelteKit type checking
cd apps/desktop && pnpm check

# Build with signing (for releases)
TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/mdedit.key) PATH="$HOME/.cargo/bin:$PATH" pnpm build
```

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Editor engine | CodeMirror 6 + Lezer | Live preview via ViewPlugin decorations |
| Frontend | Svelte 5 (runes) | `$state`, `$props`, `$effect` — no legacy reactive syntax |
| Framework | SvelteKit 2 | adapter-static, SPA mode, `$lib` alias for `src/lib` |
| Desktop shell | Tauri 2 | WKWebView on macOS, Rust backend for file I/O |
| Build | Vite 6 | Library mode for core, SvelteKit for desktop |
| Testing | Vitest (jsdom) + cargo test | Core: `packages/core/test/`, Desktop: `apps/desktop/test/`, Rust: inline in `commands.rs` |
| Package manager | pnpm workspaces | |

## Key Conventions

- **Core has no framework deps** — `@mdedit/core` imports from `@codemirror/*`, `@lezer/*`, standard lib, and rendering libraries (`marked`, `katex`, `mermaid`). Never import Tauri or Svelte APIs in core.
- **File I/O through Rust only** — The webview never touches the filesystem directly. All reads/writes go through Tauri commands with path validation and atomic writes.
- **Svelte 5 runes** — Use `$state()`, `$derived()`, `$effect()`, `$props()`. Never use legacy `let x; $: reactive` patterns. Stores use `.svelte.ts` extension.
- **SvelteKit routing** — Main page is `src/routes/+page.svelte`, not `App.svelte`. Layout at `+layout.svelte` uses Snippet pattern: `{@render children()}`.
- **Line ending preservation** — `detectLineSeparator()` detects CRLF/LF on open; `contentForSave()` restores original line endings before writing.
- **Check latest docs** — Before implementing any feature, search the web for current Tauri 2, CodeMirror 6, Svelte 5, and Lezer documentation. APIs evolve between versions.

## Core Public API (`@mdedit/core`)

Editor: `createEditor`, `loadEditorContent`, `setEditorTheme`, `setContentWidth`, `setReadOnly`, `setFocusHighlight`, `setTypewriterScrolling`, `isFileLoad`, `detectLineSeparator`
Decorations: `livePreview` (aggregates all decoration extensions)
Toolbar: `toggleBold`, `toggleItalic`, `toggleStrikethrough`, `insertLink`, `insertImage`, `setHeading`, `toggleList`, `toggleTaskList`, `insertCodeBlock`, `insertHorizontalRule`, `insertTable`
Command Palette: `commandPaletteExtension`, `showCommandPalette`, `registerPaletteCommands`, `defaultCommands`, `filterCommands`
Outline: `getOutline`
Export: `markdownToHtml`
Themes: `lightTheme`, `darkTheme`, `solarizedLight`, `solarizedDark`, `nordDark`, `sepiaLight`, `getTheme`, `isThemeDark`, `themeList`
Extensions: `focusHighlight`, `typewriterScrolling`, `mathWidget`, `mermaidWidget`, `emojiDecoration`, `emojiAutocomplete`
Other: `markdownKeybindings`, `getCursorInfo`, `parseTable`, `addColumn`, `removeColumn`, `addRow`, `removeRow`
Types: `EditorConfig`, `EditorView`, `CursorInfo`, `LineSeparator`, `ThemeId`, `ThemeInfo`, `OutlineEntry`, `PaletteCommand`, `TableInfo`

## CM6 Gotchas

- **Block decorations (widgets with `block: true`) require a `StateField`**, not a ViewPlugin. ViewPlugin throws `RangeError: Block decorations may not be specified via plugins`.
- **Decoration sort order** — line decorations must come before replace decorations at the same `from` position. Build separate arrays and merge, or use `Decoration.set(decos, true)` for auto-sort.
- **`isFileLoad` annotation** — always use `loadEditorContent()` for programmatic content changes. Never use raw `view.dispatch({ changes })` to load files — it triggers `onDocChange` and marks the document dirty.

## Lezer Markdown Node Names

Headings: `ATXHeading1`-`6`, `SetextHeading1`-`2`, `HeaderMark`
Inline: `StrongEmphasis`, `Emphasis`, `Strikethrough`, `EmphasisMark`, `StrikethroughMark`
Links/Images: `Link`, `Image`, `LinkMark`, `URL`
Blocks: `FencedCode`, `Blockquote`, `QuoteMark`, `HorizontalRule`, `ListItem`, `Table`
Frontmatter: `FrontmatterBlock`, `FrontmatterMarker`, `FrontmatterContent` (custom parser)

## Tauri 2 Notes

- Drag-and-drop: `getCurrentWebview().onDragDropEvent()` (NOT `getCurrentWindow()`)
- Menu: use `SubmenuBuilder` pattern from latest docs, not `Submenu::with_items`
- Dialogs are Rust-side only — never import `@tauri-apps/plugin-dialog` in JS
- `cargo test` must run from `apps/desktop/src-tauri/` directory
- `cargo` may not be in PATH — prefix commands with `PATH="$HOME/.cargo/bin:$PATH"`
- Signing keys configured via GitHub Actions secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_UPDATER_PUBKEY`)

## Error Logging

- Desktop errors logged to `~/.mdedit/error.log` via Rust `log_error` command
- Use `logError(category, message, details?)` from `$lib/logger.ts` — categories: `file-io`, `auto-save`, `export`, `update`, `paste`, `general`
- Log capped at 1MB with automatic truncation

## CI/Release

- CI: `.github/workflows/ci.yml` — runs on PR/push: pnpm test, cargo test, pnpm check
- Release: `.github/workflows/release.yml` — triggered by `v*` tags, builds signed macOS DMG
- Config validation: `scripts/validate-release-config.sh` — checks pubkey, signing key, endpoint
- Pubkey substitution: `scripts/substitute-release-config.sh` — injects pubkey from CI secret

## Design Spec & Implementation Plan

- Spec: `docs/superpowers/specs/2026-04-02-mdedit-design.md`
- Plan: `docs/superpowers/plans/2026-04-02-mdedit-tier1-mvp.md`
