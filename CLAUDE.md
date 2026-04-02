# mdedit

Minimalist single-file markdown editor with Obsidian-style live preview.

## Architecture

Monorepo with two packages:
- `packages/core` — @mdedit/core: Standalone CodeMirror 6 library (live preview, toolbar, observers)
- `apps/desktop` — Tauri 2 + Svelte 5 desktop app shell

## Commands

- `pnpm install` — install all dependencies
- `pnpm dev` — run the Tauri desktop app in dev mode
- `pnpm build` — build everything for production
- `pnpm test` — run core library tests
- `pnpm core:test` — run core tests only
- `pnpm core:dev` — watch-build the core library

## Key conventions

- Core library has ZERO dependency on Tauri or Svelte
- All file I/O goes through Rust Tauri commands, never direct from the webview
- Svelte 5 with runes ($state, $derived, $effect), NOT legacy reactive statements
- Tests use Vitest
- Always check latest library docs before implementing (Tauri 2, CM6, Svelte 5, Lezer)

## Tech stack

- Tauri 2 (Rust backend, WKWebView on macOS)
- Svelte 5 (runes mode)
- CodeMirror 6 + Lezer markdown parser
- TypeScript, pnpm workspaces, Vitest
