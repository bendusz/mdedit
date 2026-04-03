# AGENT.md

## Role

This agent acts as the project's senior software developer for QA, stability, and security.

Primary responsibilities:

- Review code for bugs, regressions, unsafe design, and missing tests.
- Make targeted fixes that improve stability and security.
- Keep an accurate, current understanding of the project as it evolves.
- Update this file after every run so it remains a reliable project snapshot.

## Update Rule

After every agent run, update this file to reflect:

- What the project currently does
- What changed in that run
- Current risks, gaps, and QA priorities
- Any important repo-level instructions or constraints

## Project Status

Current status: early product development, but substantially beyond the initial scaffold.

This is a minimalist single-file markdown editor with a meaningful Tier 1 MVP already implemented. It is not finished or release-ready from a QA perspective, but it now includes most of the intended MVP surface.

What exists now:

- A pnpm monorepo with `packages/core` and `apps/desktop`
- A CodeMirror 6 core package with live preview decorations
- Toolbar commands and markdown keyboard shortcuts
- Cursor observers and status bar support
- Light/dark editor theming with system-follow state
- Native open/save/save-as via Rust Tauri commands
- Auto-save, drag-and-drop open, recent-files persistence, and window-title updates
- Native menu wiring and file-association/deep-link handling paths
- JS unit coverage for the core package and Rust unit coverage for file commands

What is still incomplete or weak:

- Desktop integration and end-to-end coverage
- Verification integration at the repo root
- Release hardening and polish

## Architecture

### Monorepo

- Root scripts live in `package.json`
- `packages/core` is the shared editor library
- `apps/desktop` is the desktop application shell

### Core Editor

`packages/core` currently provides:

- `createEditor()`, `loadEditorContent()`, `setEditorTheme()`, `setImageBasePath()`, `detectLineSeparator()`
- Live preview for headings, emphasis, links, images, code blocks, blockquotes, horizontal rules, task lists, and tables
- Toolbar commands and markdown keyboard shortcuts
- Cursor observers for line, column, word count, and character count
- Light and dark CodeMirror themes

### Desktop App

`apps/desktop` currently provides:

- A main page that mounts editor, toolbar, and status bar
- A Svelte file-state store with path, filename, content, dirty state, revision, and line separator
- A Svelte theme-state store
- Tauri wrappers for file operations and recent-files persistence
- Shortcut handling, auto-save, drag-drop handling, menu-event listeners, close guards, and window-title updates

### Security Boundary

The Rust backend owns filesystem access and dialogs.

Current security-relevant properties:

- The webview does not directly access the filesystem
- File operations go through Tauri `invoke()` and Rust-owned events
- Rust validates that paths are absolute before read/write
- Saves use a temp-file-plus-rename atomic write strategy
- Rust tracks the current file path internally for save operations instead of trusting renderer-supplied paths
- Drag-drop and file-association opens are queued in Rust and emitted as file payloads instead of renderer-chosen path requests

## Current Knowledge

Key files:

- `packages/core/src/editor.ts`
- `apps/desktop/src/lib/components/Editor.svelte`
- `apps/desktop/src/lib/stores/fileState.svelte.ts`
- `apps/desktop/src/lib/tauri/fileOps.ts`
- `apps/desktop/src/routes/+page.svelte`
- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/tauri.conf.json`
- `docs/superpowers/specs/2026-04-02-mdedit-design.md`

Important project notes:

- The codebase is larger than the first project snapshot and now includes the core Tier 1 editor surface.
- The spec still describes some behavior that is only partially hardened in the implementation.
- The worktree may be dirty; do not overwrite unrelated user changes.
- Root `pnpm test` currently covers only the core Vitest suite.
- Rust tests exist inline in `apps/desktop/src-tauri/src/commands.rs`.
- `@lezer/common` is now a direct dependency of `packages/core`, and `pnpm check` is passing.
- Relative image previews now receive their base directory from the desktop app and can be updated dynamically after file switches.

## QA Focus

Primary review focus for the next iterations:

- Test coverage for desktop behavior and integration paths
- Manual verification of drag-drop and file-association behavior after the Rust-owned open flow refactor
- Cold-start file opening behavior and event ordering
- Recent-files UX surface and broader release hardening

## Session Snapshot

Last updated: 2026-04-03 08:53:44 BST

Latest session summary:

- Performed a full code review against the current checked-in project, not just the initial scaffold.
- Verified that `pnpm test` passes with 108 core tests, `cargo test` passes with 13 Rust tests, and `cd apps/desktop && pnpm check` passes.
- Fixed the open/new/drag-drop/file-association dirty-document guard so switching now stops on save cancellation or save failure instead of silently discarding changes.
- Fixed the Rust atomic-save collision issue by switching to unique same-directory temp files created with `tempfile`.
- Added Rust tests for unique temp-file paths and cleanup after a failed persist.
- Promoted `tempfile` to a runtime dependency in `apps/desktop/src-tauri/Cargo.toml`.
- Reduced renderer privilege scope by removing raw path-based open/save commands from the frontend API, moving current-file tracking into Rust state, and handling drag-drop/file-association opens as Rust-owned queued file payloads.
- Tightened the Rust pending-file acceptance path so the promoted current file must match the exact external file payload being opened.
- Added dynamic image-base-path wiring from the desktop app into the core editor and expanded image-widget tests to cover base-path resolution updates.
