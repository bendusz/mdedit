# Contributing to mdedit

Thanks for your interest in contributing! This guide will help you get set up and make your first contribution.

## Development Environment

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri 2 system dependencies ([macOS guide](https://v2.tauri.app/start/prerequisites/))

### Setup

```bash
git clone https://github.com/bendusz/mdedit.git
cd mdedit
pnpm install
pnpm dev
```

## Project Structure

```
mdedit/
  packages/core/       @mdedit/core -- CodeMirror 6 editor library (no framework deps)
  apps/desktop/        @mdedit/desktop -- Tauri 2 + SvelteKit app shell
    src/
      lib/components/  Svelte components
      lib/stores/      Svelte 5 rune stores (.svelte.ts)
      routes/          SvelteKit pages
    src-tauri/         Rust backend (file I/O, native dialogs)
```

**Key architectural rules:**

- `packages/core` has zero dependency on Tauri or Svelte. It only imports from `@codemirror/*`, `@lezer/*`, and standard lib.
- All filesystem access goes through the Rust backend. The webview never touches the filesystem directly.
- Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) only -- no legacy reactive syntax.

## Running Tests

```bash
# All tests
pnpm test

# Core library only
pnpm --filter @mdedit/core test

# Single test file
pnpm --filter @mdedit/core test -- test/commands.test.ts

# Watch mode
pnpm --filter @mdedit/core test:watch

# Rust tests (from apps/desktop/src-tauri/)
cargo test
```

## Pull Request Guidelines

1. **One feature or fix per PR.** Keep changes focused and reviewable.
2. **Include tests.** New features need tests. Bug fixes should include a regression test where practical.
3. **Follow existing code conventions.** See [CLAUDE.md](CLAUDE.md) for detailed conventions, CM6 gotchas, and the core public API surface.
4. **Write clear commit messages.** Summarize the "why", not just the "what".
5. **Keep the core pure.** Never add Tauri or Svelte imports to `packages/core`.

## Code Conventions

The project conventions, architecture notes, and common pitfalls are documented in [CLAUDE.md](CLAUDE.md). Please review it before submitting a PR.

## Finding Issues to Work On

Check the [Issues](https://github.com/bendusz/mdedit/issues) tab. Issues labeled `good first issue` are a great starting point. If you want to work on something not yet tracked, open an issue first to discuss the approach.

## Questions?

Open a [Discussion](https://github.com/bendusz/mdedit/discussions) or comment on a relevant issue. We're happy to help.
