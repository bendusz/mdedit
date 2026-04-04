# mdedit

A minimalist, native markdown editor with Obsidian-style live preview. Headings get big, bold gets bold, code gets highlighted -- all inline, all in real time. Raw markdown reveals itself only at the cursor.

<!-- screenshot here -->

## Features

### Editor
- **Live preview** -- markdown renders inline as you type (headings, bold, italic, code, links, images)
- **Cursor reveal** -- raw markdown syntax appears only at the cursor position
- **Syntax highlighting** -- fenced code blocks with language-aware highlighting

### Markdown
- GFM tables
- Frontmatter (YAML)
- Footnotes
- Math rendering (KaTeX)
- Mermaid diagrams
- Emoji shortcodes
- Admonitions / callouts

### Writing
- Command palette
- Zen mode (distraction-free)
- Typewriter scrolling
- Reading mode

### Files
- Auto-save
- Drag-and-drop file opening
- Recent files
- Image paste from clipboard

### Export
- HTML export
- PDF / Print

### UI
- 6 themes (light and dark)
- Outline sidebar
- Configurable editor width
- Toast notifications

### System
- Native macOS menu
- Markdown file associations (`.md`, `.markdown`, `.mdx`)
- Auto-updater

## Tech Stack

| Layer | Technology |
|-------|------------|
| Editor engine | [CodeMirror 6](https://codemirror.net/) + [Lezer](https://lezer.codemirror.net/) |
| Frontend | [Svelte 5](https://svelte.dev/) (runes) + [SvelteKit 2](https://kit.svelte.dev/) |
| Desktop shell | [Tauri 2](https://tauri.app/) (Rust backend, WKWebView on macOS) |
| Build | [Vite 6](https://vitejs.dev/) |
| Testing | [Vitest](https://vitest.dev/) + `cargo test` |
| Package manager | [pnpm](https://pnpm.io/) workspaces |

## Architecture

mdedit is a monorepo with two packages:

- **`packages/core`** (`@mdedit/core`) -- Standalone CodeMirror 6 editor library. Zero dependency on Tauri or Svelte. Exports `createEditor()`, live preview decorations, toolbar commands, and observers. Fully testable in a browser or jsdom.
- **`apps/desktop`** (`@mdedit/desktop`) -- Tauri 2 + SvelteKit app shell. The Rust backend owns all filesystem access and native dialogs; the webview has no ambient filesystem permissions.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- [Rust](https://rustup.rs/) (stable toolchain)
- Tauri 2 system dependencies ([macOS guide](https://v2.tauri.app/start/prerequisites/))

### Development

```bash
# Clone the repository
git clone https://github.com/bendusz/mdedit.git
cd mdedit

# Install dependencies
pnpm install

# Run the app in development mode
pnpm dev

# Run tests
pnpm test

# Watch-build the core library
pnpm core:dev
```

### Running Tests

```bash
# All tests (core + desktop)
pnpm test

# Core library tests only
pnpm --filter @mdedit/core test

# Single test file
pnpm --filter @mdedit/core test -- test/commands.test.ts

# Watch mode
pnpm --filter @mdedit/core test:watch

# Rust tests
cd apps/desktop/src-tauri && cargo test
```

## Building

```bash
# Build the full application (core library + Tauri desktop bundle)
pnpm build
```

The macOS DMG will be at `apps/desktop/src-tauri/target/release/bundle/dmg/`.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on setting up the development environment, running tests, and submitting pull requests.

## License

[MIT](LICENSE)
