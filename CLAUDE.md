# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

mdedit is a minimalist single-file markdown editor with Obsidian-style live preview, targeting macOS first (Windows/Linux later). It renders markdown inline in a single pane — headings get big, bold gets bold, code blocks get highlighted — while revealing raw markdown at the cursor position.

## Architecture

Monorepo with two packages connected via pnpm workspaces (`workspace:*` protocol):

- **`packages/core`** (`@mdedit/core`) — Standalone CodeMirror 6 library. Has ZERO dependency on Tauri or Svelte. Exports `createEditor()`, live preview decorations, toolbar commands, and observers. Testable in a browser without Tauri.
- **`apps/desktop`** (`@mdedit/desktop`) — Tauri 2 + SvelteKit 2 app shell. Uses `adapter-static` in SPA mode (`ssr = false`). Routes at `src/routes/`, components at `src/lib/components/`, stores at `src/lib/stores/`.

### Security Boundary

The Rust backend owns all filesystem access and native dialogs. The webview has no ambient filesystem or dialog permissions — it calls high-level Tauri commands (`open_file_dialog`, `save_file`, `save_file_as_dialog`) via `invoke()` and receives only content and metadata. File paths are validated as absolute in Rust. Saves use atomic write (temp file + rename).

### File State Model

`fileState.svelte.ts` tracks path, filename, content, dirty flag, revision counter, and original line separator. The `isFileLoad` CM6 annotation distinguishes programmatic loads from user edits — `loadEditorContent()` dispatches annotated transactions that skip `onDocChange`, preventing file opens from marking the document dirty. Revision-based `markSaved(atRevision)` prevents stale autosave from clearing the dirty flag.

## Commands

```bash
pnpm dev              # Run Tauri desktop app in dev mode (Vite + Rust backend)
pnpm build            # Build core lib, then Tauri desktop bundle
pnpm test             # Run core library tests (Vitest)
pnpm core:test        # Same as above
pnpm core:dev         # Watch-build core library

# Rust tests (from apps/desktop/src-tauri/)
cargo test            # Run Rust unit tests for file commands

# SvelteKit type checking
cd apps/desktop && pnpm check
```

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Editor engine | CodeMirror 6 + Lezer | Live preview via ViewPlugin decorations |
| Frontend | Svelte 5 (runes) | `$state`, `$props`, `$effect` — no legacy reactive syntax |
| Framework | SvelteKit 2 | adapter-static, SPA mode, `$lib` alias for `src/lib` |
| Desktop shell | Tauri 2 | WKWebView on macOS, Rust backend for file I/O |
| Build | Vite 6 | Library mode for core, SvelteKit for desktop |
| Testing | Vitest (jsdom) + cargo test | Core tests in `packages/core/test/`, Rust tests inline in `commands.rs` |
| Package manager | pnpm workspaces | |

## Key Conventions

- **Core has no framework deps** — `@mdedit/core` imports only from `@codemirror/*`, `@lezer/*`, and standard lib. Never import Tauri or Svelte APIs in core.
- **File I/O through Rust only** — The webview never touches the filesystem directly. All reads/writes go through Tauri commands with path validation and atomic writes.
- **Svelte 5 runes** — Use `$state()`, `$derived()`, `$effect()`, `$props()`. Never use legacy `let x; $: reactive` patterns. Stores use `.svelte.ts` extension.
- **SvelteKit routing** — Main page is `src/routes/+page.svelte`, not `App.svelte`. Layout at `+layout.svelte` uses Snippet pattern: `{@render children()}`.
- **Line ending preservation** — `detectLineSeparator()` detects CRLF/LF on open; `contentForSave()` restores original line endings before writing.
- **Check latest docs** — Before implementing any feature, search the web for current Tauri 2, CodeMirror 6, Svelte 5, and Lezer documentation. APIs evolve between versions.

## Design Spec & Implementation Plan

- Spec: `docs/superpowers/specs/2026-04-02-mdedit-design.md`
- Plan: `docs/superpowers/plans/2026-04-02-mdedit-tier1-mvp.md`
