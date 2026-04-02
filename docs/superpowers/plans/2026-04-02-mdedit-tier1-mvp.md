# mdedit Tier 1 MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable single-file markdown editor with Obsidian-style live preview, toolbar, status bar, and full file handling on macOS.

**Architecture:** Monorepo with two packages — `@mdedit/core` (standalone CodeMirror 6 library with live preview decorations, toolbar commands, and observers) and `apps/desktop` (Tauri 2 + Svelte 5 app shell handling file I/O, system integration, and UI chrome). The core is testable in a browser without Tauri.

**Tech Stack:** Tauri 2, Svelte 5 (runes), CodeMirror 6, Lezer markdown parser, TypeScript, Rust, Vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-04-02-mdedit-design.md`

**IMPORTANT:** Before implementing any task, check the latest online documentation for all libraries involved (Tauri 2, CodeMirror 6, Svelte 5, Lezer, etc.). APIs evolve — do not rely on cached knowledge.

---

## File Map

### Root
- `package.json` — root workspace scripts
- `pnpm-workspace.yaml` — workspace config
- `.gitignore`
- `CLAUDE.md` — project conventions for AI agents

### `packages/core/` — @mdedit/core
- `package.json`
- `tsconfig.json`
- `vite.config.ts` — library build config
- `src/index.ts` — public API barrel export
- `src/editor.ts` — `createEditor()` factory
- `src/extensions/live-preview.ts` — decoration barrel, styles, exports
- `src/extensions/heading-decoration.ts` — heading-specific decoration logic
- `src/extensions/inline-decoration.ts` — bold, italic, strikethrough decorations
- `src/extensions/link-decoration.ts` — link styling decorations
- `src/extensions/image-widget.ts` — widget decoration for inline images
- `src/extensions/code-block.ts` — fenced code block highlighting
- `src/extensions/list-decoration.ts` — lists, task checkboxes
- `src/extensions/blockquote-decoration.ts` — blockquote styling
- `src/extensions/table-decoration.ts` — GFM table rendering
- `src/extensions/hr-decoration.ts` — horizontal rule widget
- `src/toolbar/commands.ts` — all formatting commands (toggleBold, insertLink, etc.)
- `src/toolbar/keybindings.ts` — keyboard shortcut map
- `src/observers.ts` — cursor info, doc change, word count
- `src/theme.ts` — light and dark CM6 themes
- `test/commands.test.ts` — toolbar command unit tests
- `test/observers.test.ts` — observer unit tests
- `test/decorations.test.ts` — decoration computation tests
- `test/setup.ts` — test environment setup

### `apps/desktop/` — Tauri + Svelte app
- `package.json`
- `tsconfig.json`
- `svelte.config.js`
- `vite.config.ts`
- `src/main.ts` — app entry point
- `src/app.css` — global styles
- `src/App.svelte` — root layout (Toolbar + Editor + StatusBar)
- `src/lib/components/Editor.svelte` — mounts CM6 EditorView
- `src/lib/components/Toolbar.svelte` — formatting buttons
- `src/lib/components/StatusBar.svelte` — line/col, word count, save state
- `src/lib/stores/fileState.svelte.ts` — current file path, content, dirty flag (Svelte 5 runes)
- `src/lib/stores/theme.svelte.ts` — theme state (system/light/dark)
- `src/lib/tauri/fileOps.ts` — Tauri invoke wrappers for file operations
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json` — Tauri 2 permission capabilities
- `src-tauri/src/main.rs` — Tauri app bootstrap
- `src-tauri/src/lib.rs` — Tauri command registration
- `src-tauri/src/commands.rs` — file open/save/recent Tauri commands
- `src-tauri/src/menu.rs` — native macOS menu bar
- `src-tauri/src/recent_files.rs` — recent files persistence

---

## Task 1: Project Scaffolding — Monorepo + Tauri + Svelte + Core Package

**User Story:** As a developer, I can clone the repo, run `pnpm install`, and start the dev server so that I have a working development environment.

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vite.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `apps/desktop/*` (Tauri + Svelte scaffold)
- Create: `CLAUDE.md`
- Modify: `.gitignore`

- [ ] **Step 1: Initialize pnpm workspace**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Create root `package.json`:
```json
{
  "name": "mdedit",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @mdedit/desktop dev",
    "build": "pnpm --filter @mdedit/core build && pnpm --filter @mdedit/desktop build",
    "test": "pnpm --filter @mdedit/core test",
    "core:dev": "pnpm --filter @mdedit/core dev",
    "core:test": "pnpm --filter @mdedit/core test"
  }
}
```

- [ ] **Step 2: Scaffold the core package**

Create `packages/core/package.json`:
```json
{
  "name": "@mdedit/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@codemirror/commands": "^6",
    "@codemirror/lang-markdown": "^6",
    "@codemirror/language": "^6",
    "@codemirror/language-data": "^6",
    "@codemirror/search": "^6",
    "@codemirror/state": "^6",
    "@codemirror/view": "^6",
    "@lezer/markdown": "^1"
  },
  "devDependencies": {
    "jsdom": "^26",
    "typescript": "^5",
    "vite": "^6",
    "vitest": "^3"
  }
}
```

Create `packages/core/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

Create `packages/core/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [/^@codemirror\//, /^@lezer\//],
    },
  },
});
```

Create `packages/core/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
```

Create `packages/core/src/index.ts`:
```typescript
// @mdedit/core — public API
// Will be populated as features are built
export {};
```

Create `packages/core/test/setup.ts`:
```typescript
// Vitest test setup — empty for now
export {};
```

- [ ] **Step 3: Scaffold Tauri + Svelte app**

Check the latest Tauri 2 docs for the current `create-tauri-app` command, then scaffold:

```bash
cd apps
pnpm create tauri-app desktop --template svelte-ts --manager pnpm
cd ..
```

After scaffolding, update `apps/desktop/package.json` to add the core workspace dependency:
```json
{
  "name": "@mdedit/desktop",
  "dependencies": {
    "@mdedit/core": "workspace:*"
  }
}
```

- [ ] **Step 4: Update .gitignore**

Append to `.gitignore`:
```
node_modules/
dist/
target/
.superpowers/
.DS_Store
*.swp
```

- [ ] **Step 5: Create CLAUDE.md**

Create `CLAUDE.md`:
```markdown
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
```

- [ ] **Step 6: Install dependencies and verify**

```bash
pnpm install
```

Expected: Clean install, no errors.

- [ ] **Step 7: Verify Tauri dev server starts**

```bash
pnpm dev
```

Expected: Tauri window opens with the default Svelte template. Close it after verifying.

- [ ] **Step 8: Verify core tests run**

Create a placeholder test `packages/core/test/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('core', () => {
  it('should be importable', async () => {
    const core = await import('../src/index');
    expect(core).toBeDefined();
  });
});
```

Run:
```bash
pnpm core:test
```

Expected: 1 test passes.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: project scaffolding — monorepo with core package and Tauri+Svelte app"
```

---

## Task 2: Core — Editor Factory with Basic Markdown Support

**User Story:** As a developer, I can call `createEditor()` with a container element and content string to get a working CodeMirror 6 editor with markdown syntax highlighting.

**Files:**
- Create: `packages/core/src/editor.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/editor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/editor.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';

describe('createEditor', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should create an EditorView mounted in the container', () => {
    view = createEditor({ parent: container, content: '' });
    expect(view).toBeInstanceOf(EditorView);
    expect(container.querySelector('.cm-editor')).not.toBeNull();
  });

  it('should initialize with provided content', () => {
    const content = '# Hello World\n\nSome text.';
    view = createEditor({ parent: container, content });
    expect(view.state.doc.toString()).toBe(content);
  });

  it('should call onDocChange when content changes', () => {
    let changed = '';
    view = createEditor({
      parent: container,
      content: 'hello',
      onDocChange: (c) => { changed = c; },
    });
    view.dispatch({ changes: { from: 5, insert: ' world' } });
    expect(changed).toBe('hello world');
  });
});
```

Run:
```bash
pnpm core:test
```

Expected: FAIL — `createEditor` does not exist.

- [ ] **Step 2: Implement createEditor**

Create `packages/core/src/editor.ts`:
```typescript
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
} from '@codemirror/language';
import { search, searchKeymap } from '@codemirror/search';

export interface EditorConfig {
  parent: HTMLElement;
  content: string;
  onDocChange?: (content: string) => void;
}

export function createEditor(config: EditorConfig): EditorView {
  const { parent, content, onDocChange } = config;

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onDocChange) {
      onDocChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: content,
    extensions: [
      history(),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(defaultHighlightStyle),
      bracketMatching(),
      search(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      updateListener,
      EditorView.lineWrapping,
    ],
  });

  return new EditorView({ state, parent });
}
```

- [ ] **Step 3: Export from index.ts**

Update `packages/core/src/index.ts`:
```typescript
export { createEditor, type EditorConfig } from './editor';
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm install && pnpm core:test
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): createEditor factory with markdown language support"
```

---

## Task 3: App — Mount Editor in Tauri Shell

**User Story:** As a user, when I open mdedit I see a full-screen markdown editor where I can type.

**Files:**
- Modify: `apps/desktop/src/App.svelte`
- Create: `apps/desktop/src/lib/components/Editor.svelte`
- Modify: `apps/desktop/src/app.css`

- [ ] **Step 1: Create the Editor component**

Create `apps/desktop/src/lib/components/Editor.svelte`:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEditor } from '@mdedit/core';
  import type { EditorView } from '@codemirror/view';

  let container: HTMLElement;
  let view: EditorView;

  onMount(() => {
    view = createEditor({
      parent: container,
      content: '# Welcome to mdedit\n\nStart typing your markdown here.',
    });
    view.focus();
  });

  onDestroy(() => {
    view?.destroy();
  });
</script>

<div class="editor-container" bind:this={container}></div>

<style>
  .editor-container {
    flex: 1;
    overflow: auto;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }

  .editor-container :global(.cm-scroller) {
    overflow: auto;
  }
</style>
```

- [ ] **Step 2: Set up the root App layout**

Replace `apps/desktop/src/App.svelte`:
```svelte
<script lang="ts">
  import Editor from './lib/components/Editor.svelte';
</script>

<main class="app">
  <Editor />
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
</style>
```

- [ ] **Step 3: Set global styles**

Replace `apps/desktop/src/app.css`:
```css
:root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: #1a1a1a;
  background-color: #ffffff;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 4: Verify the app starts with the editor**

```bash
pnpm dev
```

Expected: Tauri window opens showing a CodeMirror editor with "# Welcome to mdedit" and markdown syntax highlighting. You can type, undo/redo, and use Cmd+F for search.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(app): mount CodeMirror editor in Tauri shell"
```

---

## Task 4: Rust Backend — File Open and Save Commands

**User Story:** As a user, I can open a `.md` file with Cmd+O and save it with Cmd+S so that I can work with real files.

**Files:**
- Create: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Create: `apps/desktop/src/lib/tauri/fileOps.ts`
- Create: `apps/desktop/src/lib/stores/fileState.svelte.ts`
- Modify: `apps/desktop/src/lib/components/Editor.svelte`
- Modify: `apps/desktop/src/App.svelte`
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/capabilities/default.json`

- [ ] **Step 1: Add Tauri dialog and fs plugins to Cargo.toml**

Check latest Tauri 2 docs for the current plugin crate names and add them to `apps/desktop/src-tauri/Cargo.toml` dependencies:
```toml
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
```

- [ ] **Step 2: Implement Rust file commands**

Create `apps/desktop/src-tauri/src/commands.rs`:
```rust
use std::fs;
use std::path::PathBuf;

#[derive(serde::Serialize)]
pub struct FileData {
    pub path: String,
    pub content: String,
    pub filename: String,
}

#[tauri::command]
pub async fn open_file(path: String) -> Result<FileData, String> {
    let path_buf = PathBuf::from(&path);
    let content = fs::read_to_string(&path_buf)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    let filename = path_buf
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    Ok(FileData {
        path,
        content,
        filename,
    })
}

#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to save file: {}", e))?;
    Ok(())
}
```

- [ ] **Step 3: Register commands and plugins in lib.rs**

Update `apps/desktop/src-tauri/src/lib.rs`:
```rust
mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::open_file,
            commands::save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running mdedit");
}
```

Ensure `main.rs` calls the run function from lib. Check the Tauri 2 scaffolded code for the exact lib crate name and adjust accordingly.

- [ ] **Step 4: Update Tauri capabilities for dialog and fs**

Update `apps/desktop/src-tauri/capabilities/default.json` to include dialog and fs permissions. Check latest Tauri 2 docs for the exact capability format:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for mdedit",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:default",
    "fs:allow-read",
    "fs:allow-write"
  ]
}
```

- [ ] **Step 5: Create TypeScript file operation wrappers**

Install the Tauri JS plugins:
```bash
cd apps/desktop
pnpm add @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
cd ../..
```

Create `apps/desktop/src/lib/tauri/fileOps.ts`:
```typescript
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

interface FileData {
  path: string;
  content: string;
  filename: string;
}

export async function openFileDialog(): Promise<FileData | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdx'] }],
  });

  if (!selected) return null;

  const path = typeof selected === 'string' ? selected : selected.path;
  return invoke<FileData>('open_file', { path });
}

export async function saveFile(path: string, content: string): Promise<void> {
  return invoke('save_file', { path, content });
}

export async function saveFileAsDialog(content: string): Promise<string | null> {
  const path = await save({
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  });

  if (!path) return null;

  await invoke('save_file', { path, content });
  return path;
}
```

- [ ] **Step 6: Create file state store**

Create `apps/desktop/src/lib/stores/fileState.svelte.ts`:
```typescript
let currentPath = $state<string | null>(null);
let currentFilename = $state<string>('Untitled');
let isDirty = $state(false);
let content = $state('');

export function getFileState() {
  return {
    get path() { return currentPath; },
    get filename() { return currentFilename; },
    get isDirty() { return isDirty; },
    get content() { return content; },

    setFile(path: string, filename: string, fileContent: string) {
      currentPath = path;
      currentFilename = filename;
      content = fileContent;
      isDirty = false;
    },

    setContent(newContent: string) {
      content = newContent;
      isDirty = true;
    },

    markSaved() {
      isDirty = false;
    },

    reset() {
      currentPath = null;
      currentFilename = 'Untitled';
      content = '';
      isDirty = false;
    },
  };
}

export const fileState = getFileState();
```

- [ ] **Step 7: Wire file operations into Editor and App**

Update `apps/desktop/src/lib/components/Editor.svelte` to accept content as a prop and emit changes:
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEditor } from '@mdedit/core';
  import type { EditorView } from '@codemirror/view';

  interface Props {
    content: string;
    onchange?: (content: string) => void;
  }

  let { content, onchange }: Props = $props();

  let container: HTMLElement;
  let view: EditorView;

  onMount(() => {
    view = createEditor({
      parent: container,
      content,
      onDocChange: (newContent) => {
        onchange?.(newContent);
      },
    });
    view.focus();
  });

  onDestroy(() => {
    view?.destroy();
  });

  export function setContent(newContent: string) {
    if (view) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newContent,
        },
      });
    }
  }

  export function getView(): EditorView | undefined {
    return view;
  }
</script>

<div class="editor-container" bind:this={container}></div>

<style>
  .editor-container {
    flex: 1;
    overflow: auto;
  }

  .editor-container :global(.cm-editor) {
    height: 100%;
  }

  .editor-container :global(.cm-scroller) {
    overflow: auto;
  }
</style>
```

Update `apps/desktop/src/App.svelte`:
```svelte
<script lang="ts">
  import Editor from './lib/components/Editor.svelte';
  import { fileState } from './lib/stores/fileState.svelte';
  import { openFileDialog, saveFile, saveFileAsDialog } from './lib/tauri/fileOps';

  let editor: Editor;

  async function handleOpen() {
    const result = await openFileDialog();
    if (result) {
      fileState.setFile(result.path, result.filename, result.content);
      editor.setContent(result.content);
    }
  }

  async function handleSave() {
    if (fileState.path) {
      await saveFile(fileState.path, fileState.content);
      fileState.markSaved();
    } else {
      await handleSaveAs();
    }
  }

  async function handleSaveAs() {
    const path = await saveFileAsDialog(fileState.content);
    if (path) {
      const filename = path.split('/').pop() ?? 'Untitled';
      fileState.setFile(path, filename, fileState.content);
    }
  }

  function handleContentChange(content: string) {
    fileState.setContent(content);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.metaKey && e.key === 'o') {
      e.preventDefault();
      handleOpen();
    }
    if (e.metaKey && e.key === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        handleSaveAs();
      } else {
        handleSave();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<main class="app">
  <Editor
    bind:this={editor}
    content={fileState.content}
    onchange={handleContentChange}
  />
</main>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }
</style>
```

- [ ] **Step 8: Test file open/save manually**

```bash
pnpm dev
```

Test:
1. Press Cmd+O — native file dialog should appear, filtered to `.md` files
2. Select a `.md` file — its content should load into the editor
3. Edit the content
4. Press Cmd+S — file should be saved (verify by opening the file externally)
5. Press Cmd+Shift+S — Save As dialog should appear

Expected: All file operations work. No errors in console.

- [ ] **Step 9: Write Rust unit tests**

Add to `apps/desktop/src-tauri/src/commands.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_open_file_reads_content() {
        let mut tmp = NamedTempFile::new().unwrap();
        write!(tmp, "# Test\nHello").unwrap();
        let path = tmp.path().to_string_lossy().to_string();

        let result = open_file(path.clone()).await.unwrap();
        assert_eq!(result.content, "# Test\nHello");
        assert_eq!(result.path, path);
    }

    #[tokio::test]
    async fn test_save_file_writes_content() {
        let tmp = NamedTempFile::new().unwrap();
        let path = tmp.path().to_string_lossy().to_string();

        save_file(path.clone(), "# Saved".to_string()).await.unwrap();
        let content = fs::read_to_string(&path).unwrap();
        assert_eq!(content, "# Saved");
    }

    #[tokio::test]
    async fn test_open_nonexistent_file_returns_error() {
        let result = open_file("/nonexistent/path.md".to_string()).await;
        assert!(result.is_err());
    }
}
```

Add `tempfile` and `tokio` to dev-dependencies in `Cargo.toml`:
```toml
[dev-dependencies]
tempfile = "3"
tokio = { version = "1", features = ["macros", "rt"] }
```

Run:
```bash
cd apps/desktop/src-tauri && cargo test
```

Expected: All 3 tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/ packages/core/
git commit -m "feat(app): file open/save with native dialogs and Rust backend"
```

---

## Task 5: Core — Live Preview Decorations: Headings

**User Story:** As a user, I see headings rendered large and styled when my cursor is away from them, and raw `#` syntax when my cursor is on the line.

**Files:**
- Create: `packages/core/src/extensions/live-preview.ts`
- Create: `packages/core/src/extensions/heading-decoration.ts`
- Create: `packages/core/test/decorations.test.ts`
- Modify: `packages/core/src/editor.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/decorations.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';

describe('heading decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should apply heading class to heading lines', () => {
    view = createEditor({
      parent: container,
      content: '# Heading 1\n\nSome text',
    });
    view.requestMeasure();

    const headingElements = container.querySelectorAll('.cm-heading-1');
    expect(headingElements.length).toBeGreaterThan(0);
  });

  it('should render different sizes for H1-H6', () => {
    view = createEditor({
      parent: container,
      content: '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6',
    });
    view.requestMeasure();

    for (let i = 1; i <= 6; i++) {
      const elements = container.querySelectorAll(`.cm-heading-${i}`);
      expect(elements.length).toBeGreaterThan(0);
    }
  });
});
```

Run:
```bash
pnpm core:test
```

Expected: FAIL — no `.cm-heading-1` class found.

- [ ] **Step 2: Implement heading decoration logic**

Create `packages/core/src/extensions/heading-decoration.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

const headingClasses: Record<string, string> = {
  'ATXHeading1': 'cm-heading-1',
  'ATXHeading2': 'cm-heading-2',
  'ATXHeading3': 'cm-heading-3',
  'ATXHeading4': 'cm-heading-4',
  'ATXHeading5': 'cm-heading-5',
  'ATXHeading6': 'cm-heading-6',
};

function getHeadingDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      const className = headingClasses[node.name];
      if (!className) return;

      const line = state.doc.lineAt(node.from);

      // Don't decorate the line where the cursor is — reveal raw markdown
      if (line.number === cursorLine) return;

      // Apply line decoration for heading styling
      decorations.push(
        Decoration.line({ class: className }).range(line.from)
      );

      // Find and hide the heading markers (# symbols and space)
      const headingMark = node.node.getChild('HeaderMark');
      if (headingMark) {
        const hideEnd = Math.min(headingMark.to + 1, line.to);
        decorations.push(
          Decoration.replace({}).range(headingMark.from, hideEnd)
        );
      }
    },
  });

  return Decoration.set(decorations, true);
}

export const headingDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getHeadingDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getHeadingDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

- [ ] **Step 3: Create the live preview extension barrel and heading styles**

Create `packages/core/src/extensions/live-preview.ts`:
```typescript
import { EditorView } from '@codemirror/view';
import { headingDecoration } from './heading-decoration';

const headingStyles = EditorView.baseTheme({
  '.cm-heading-1': { fontSize: '2em', fontWeight: '700', lineHeight: '1.2' },
  '.cm-heading-2': { fontSize: '1.6em', fontWeight: '700', lineHeight: '1.25' },
  '.cm-heading-3': { fontSize: '1.35em', fontWeight: '600', lineHeight: '1.3' },
  '.cm-heading-4': { fontSize: '1.15em', fontWeight: '600', lineHeight: '1.35' },
  '.cm-heading-5': { fontSize: '1.05em', fontWeight: '600', lineHeight: '1.4' },
  '.cm-heading-6': { fontSize: '1em', fontWeight: '600', lineHeight: '1.4', color: '#6b7280' },
});

export function livePreview() {
  return [
    headingDecoration,
    headingStyles,
  ];
}
```

- [ ] **Step 4: Add live preview to createEditor**

Update `packages/core/src/editor.ts` — add import and extension:
```typescript
import { livePreview } from './extensions/live-preview';
```

Add `...livePreview()` to the extensions array in `createEditor`, after `syntaxHighlighting(defaultHighlightStyle)`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm core:test
```

Expected: All heading decoration tests pass.

- [ ] **Step 6: Verify visually in the app**

```bash
pnpm dev
```

Open a `.md` file with headings. Verify:
- H1-H6 are rendered at different sizes when cursor is elsewhere
- Moving cursor onto a heading line reveals the `#` markers
- Moving cursor away hides them again

- [ ] **Step 7: Commit**

```bash
git add packages/core/
git commit -m "feat(core): live preview decorations for headings H1-H6"
```

---

## Task 6: Core — Live Preview: Inline Formatting (Bold, Italic, Strikethrough)

**User Story:** As a user, I see `**bold**` as **bold**, `*italic*` as *italic*, and `~~strike~~` as ~~strike~~ when my cursor is away from the text.

**Files:**
- Create: `packages/core/src/extensions/inline-decoration.ts`
- Create: `packages/core/test/inline-decoration.test.ts`
- Modify: `packages/core/src/extensions/live-preview.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/inline-decoration.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';

describe('inline formatting decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should apply bold styling to **text**', () => {
    view = createEditor({
      parent: container,
      content: 'normal **bold** normal\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(3).from } });
    view.requestMeasure();

    const boldElements = container.querySelectorAll('.cm-bold');
    expect(boldElements.length).toBeGreaterThan(0);
  });

  it('should apply italic styling to *text*', () => {
    view = createEditor({
      parent: container,
      content: 'normal *italic* normal\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(3).from } });
    view.requestMeasure();

    const italicElements = container.querySelectorAll('.cm-italic');
    expect(italicElements.length).toBeGreaterThan(0);
  });

  it('should apply strikethrough styling to ~~text~~', () => {
    view = createEditor({
      parent: container,
      content: 'normal ~~strike~~ normal\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(3).from } });
    view.requestMeasure();

    const strikeElements = container.querySelectorAll('.cm-strikethrough');
    expect(strikeElements.length).toBeGreaterThan(0);
  });
});
```

Expected: FAIL.

- [ ] **Step 2: Implement inline decoration logic**

Create `packages/core/src/extensions/inline-decoration.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

interface InlineRule {
  nodeNames: string[];
  markName: string;
  className: string;
}

const inlineRules: InlineRule[] = [
  { nodeNames: ['StrongEmphasis'], markName: 'EmphasisMark', className: 'cm-bold' },
  { nodeNames: ['Emphasis'], markName: 'EmphasisMark', className: 'cm-italic' },
  { nodeNames: ['Strikethrough'], markName: 'StrikethroughMark', className: 'cm-strikethrough' },
];

function getInlineDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      for (const rule of inlineRules) {
        if (!rule.nodeNames.includes(node.name)) continue;

        const line = state.doc.lineAt(node.from);
        if (line.number === cursorLine) return;

        // Style the content
        decorations.push(
          Decoration.mark({ class: rule.className }).range(node.from, node.to)
        );

        // Hide the markers (**, *, ~~)
        const cursor = node.node.cursor();
        cursor.firstChild();
        do {
          if (cursor.name === rule.markName) {
            decorations.push(
              Decoration.replace({}).range(cursor.from, cursor.to)
            );
          }
        } while (cursor.nextSibling());

        return false;
      }
    },
  });

  return Decoration.set(decorations, true);
}

export const inlineDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getInlineDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getInlineDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

- [ ] **Step 3: Add inline styles and register in live preview**

Update `packages/core/src/extensions/live-preview.ts` — add import and styles:
```typescript
import { inlineDecoration } from './inline-decoration';

const inlineStyles = EditorView.baseTheme({
  '.cm-bold': { fontWeight: '700' },
  '.cm-italic': { fontStyle: 'italic' },
  '.cm-strikethrough': { textDecoration: 'line-through', color: '#9ca3af' },
});
```

Add `inlineDecoration` and `inlineStyles` to the `livePreview()` return array.

- [ ] **Step 4: Run tests**

```bash
pnpm core:test
```

Expected: All inline formatting tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): live preview decorations for bold, italic, strikethrough"
```

---

## Task 7: Core — Live Preview: Links

**User Story:** As a user, I see `[text](url)` rendered as styled link text with the URL hidden, and the full markdown revealed when I move my cursor onto it.

**Files:**
- Create: `packages/core/src/extensions/link-decoration.ts`
- Create: `packages/core/test/link-decoration.test.ts`
- Modify: `packages/core/src/extensions/live-preview.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/link-decoration.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';

describe('link decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should style link text with cm-link class', () => {
    view = createEditor({
      parent: container,
      content: 'Click [here](https://example.com) now\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(3).from } });
    view.requestMeasure();

    const linkElements = container.querySelectorAll('.cm-link');
    expect(linkElements.length).toBeGreaterThan(0);
  });
});
```

Expected: FAIL.

- [ ] **Step 2: Implement link decoration**

Create `packages/core/src/extensions/link-decoration.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

function getLinkDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Link') return;

      const line = state.doc.lineAt(node.from);
      if (line.number === cursorLine) return;

      const text = state.doc.sliceString(node.from, node.to);
      const closeBracket = text.indexOf(']');

      if (closeBracket >= 0) {
        // Style the link text (between [ and ])
        const textStart = node.from + 1;
        const textEnd = node.from + closeBracket;

        if (textEnd > textStart) {
          decorations.push(
            Decoration.mark({ class: 'cm-link' }).range(textStart, textEnd)
          );
        }

        // Hide opening [
        decorations.push(Decoration.replace({}).range(node.from, node.from + 1));
        // Hide ](url)
        decorations.push(
          Decoration.replace({}).range(node.from + closeBracket, node.to)
        );
      }

      return false;
    },
  });

  return Decoration.set(decorations, true);
}

export const linkDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getLinkDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getLinkDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

- [ ] **Step 3: Register in live preview and add styles**

Update `packages/core/src/extensions/live-preview.ts`:
```typescript
import { linkDecoration } from './link-decoration';

const linkStyles = EditorView.baseTheme({
  '.cm-link': { color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' },
});
```

Add `linkDecoration` and `linkStyles` to the `livePreview()` return array.

- [ ] **Step 4: Run tests**

```bash
pnpm core:test
```

Expected: Link tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): live preview decorations for links"
```

---

## Task 8: Core — Live Preview: Images

**User Story:** As a user, I see `![alt](path)` rendered as an actual image displayed below the line when my cursor is away from it.

**Files:**
- Create: `packages/core/src/extensions/image-widget.ts`
- Create: `packages/core/test/image-widget.test.ts`
- Modify: `packages/core/src/extensions/live-preview.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/image-widget.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';

describe('image widget decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should insert an img widget for image syntax', () => {
    view = createEditor({
      parent: container,
      content: '![Alt text](https://example.com/img.png)\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(3).from } });
    view.requestMeasure();

    const images = container.querySelectorAll('.cm-image-widget img');
    expect(images.length).toBeGreaterThan(0);
  });
});
```

Expected: FAIL.

- [ ] **Step 2: Implement image widget decoration**

Create `packages/core/src/extensions/image-widget.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import {
  Decoration, type DecorationSet, EditorView,
  ViewPlugin, type ViewUpdate, WidgetType,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

class ImageWidget extends WidgetType {
  constructor(private src: string, private alt: string) {
    super();
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-image-widget';

    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.style.maxWidth = '100%';
    img.style.borderRadius = '4px';
    img.style.marginTop = '4px';
    img.style.display = 'block';

    img.onerror = () => {
      wrapper.textContent = `[Image not found: ${this.alt}]`;
      wrapper.style.color = '#ef4444';
      wrapper.style.fontStyle = 'italic';
    };

    wrapper.appendChild(img);
    return wrapper;
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src && this.alt === other.alt;
  }
}

function getImageDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Image') return;

      const line = state.doc.lineAt(node.from);
      if (line.number === cursorLine) return;

      const text = state.doc.sliceString(node.from, node.to);
      const altMatch = text.match(/!\[([^\]]*)\]/);
      const srcMatch = text.match(/\]\(([^)]+)\)/);

      if (srcMatch) {
        const alt = altMatch?.[1] ?? '';
        const src = srcMatch[1];

        decorations.push(
          Decoration.widget({
            widget: new ImageWidget(src, alt),
            block: true,
          }).range(line.to)
        );
      }

      return false;
    },
  });

  return Decoration.set(decorations, true);
}

export const imageDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getImageDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getImageDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

- [ ] **Step 3: Register in live preview**

Add `imageDecoration` import and add to the `livePreview()` return array in `packages/core/src/extensions/live-preview.ts`.

- [ ] **Step 4: Run tests and verify**

```bash
pnpm core:test
```

Expected: Image widget test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): live preview image widget decorations"
```

---

## Task 9: Core — Live Preview: Code Blocks with Syntax Highlighting

**User Story:** As a user, I see fenced code blocks rendered with a distinct background and language-aware syntax highlighting.

**Files:**
- Create: `packages/core/src/extensions/code-block.ts`
- Create: `packages/core/test/code-block.test.ts`
- Modify: `packages/core/src/extensions/live-preview.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/code-block.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';

describe('code block decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should apply code block styling to fenced code', () => {
    view = createEditor({
      parent: container,
      content: '```javascript\nconst x = 1;\n```\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(5).from } });
    view.requestMeasure();

    const codeBlocks = container.querySelectorAll('.cm-code-block');
    expect(codeBlocks.length).toBeGreaterThan(0);
  });
});
```

Expected: FAIL.

- [ ] **Step 2: Implement code block decoration**

Create `packages/core/src/extensions/code-block.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

function getCodeBlockDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'FencedCode') return;

      const startLine = state.doc.lineAt(node.from);
      const endLine = state.doc.lineAt(node.to);

      for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
        const line = state.doc.line(lineNum);
        decorations.push(
          Decoration.line({ class: 'cm-code-block' }).range(line.from)
        );
      }

      // If cursor is not inside the block, hide the fence markers
      if (cursorLine < startLine.number || cursorLine > endLine.number) {
        decorations.push(
          Decoration.replace({}).range(startLine.from, startLine.to)
        );
        decorations.push(
          Decoration.replace({}).range(endLine.from, endLine.to)
        );
      }

      return false;
    },
  });

  return Decoration.set(decorations, true);
}

export const codeBlockDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = getCodeBlockDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getCodeBlockDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

- [ ] **Step 3: Add styles and register in live preview**

Add to `packages/core/src/extensions/live-preview.ts`:
```typescript
import { codeBlockDecoration } from './code-block';

const codeBlockStyles = EditorView.baseTheme({
  '.cm-code-block': {
    backgroundColor: '#f3f4f6',
    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: '0.9em',
    borderRadius: '0',
    padding: '0 8px',
  },
});
```

Add `codeBlockDecoration` and `codeBlockStyles` to the `livePreview()` return array.

- [ ] **Step 4: Run tests and verify**

```bash
pnpm core:test
```

Expected: Code block tests pass. Verify visually with `pnpm dev`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): live preview code block decorations with syntax highlighting"
```

---

## Task 10: Core — Live Preview: Lists, Checkboxes, Blockquotes, HR, Tables

**User Story:** As a user, I see lists with proper indentation, interactive task checkboxes, styled blockquotes, rendered horizontal rules, and formatted tables.

**Files:**
- Create: `packages/core/src/extensions/list-decoration.ts`
- Create: `packages/core/src/extensions/blockquote-decoration.ts`
- Create: `packages/core/src/extensions/hr-decoration.ts`
- Create: `packages/core/src/extensions/table-decoration.ts`
- Create: `packages/core/test/block-elements.test.ts`
- Modify: `packages/core/src/extensions/live-preview.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/block-elements.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';

describe('block element decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should style blockquote lines', () => {
    view = createEditor({
      parent: container,
      content: '> This is a quote\n> Second line\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(4).from } });
    view.requestMeasure();

    const quotes = container.querySelectorAll('.cm-blockquote');
    expect(quotes.length).toBeGreaterThan(0);
  });

  it('should render horizontal rules', () => {
    view = createEditor({
      parent: container,
      content: 'Above\n\n---\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(5).from } });
    view.requestMeasure();

    const hrs = container.querySelectorAll('.cm-hr');
    expect(hrs.length).toBeGreaterThan(0);
  });

  it('should style task list checkboxes', () => {
    view = createEditor({
      parent: container,
      content: '- [ ] Unchecked\n- [x] Checked\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(4).from } });
    view.requestMeasure();

    const tasks = container.querySelectorAll('.cm-task-list');
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('should style table lines', () => {
    view = createEditor({
      parent: container,
      content: '| A | B |\n|---|---|\n| 1 | 2 |\n\ncursor here',
    });
    view.dispatch({ selection: { anchor: view.state.doc.line(5).from } });
    view.requestMeasure();

    const tables = container.querySelectorAll('.cm-table');
    expect(tables.length).toBeGreaterThan(0);
  });
});
```

Expected: FAIL for all.

- [ ] **Step 2: Implement blockquote decoration**

Create `packages/core/src/extensions/blockquote-decoration.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

function getBlockquoteDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Blockquote') return;

      const startLine = state.doc.lineAt(node.from);
      const endLine = state.doc.lineAt(node.to);

      for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
        const line = state.doc.line(lineNum);
        decorations.push(
          Decoration.line({ class: 'cm-blockquote' }).range(line.from)
        );

        if (lineNum !== cursorLine) {
          const text = line.text;
          const markerMatch = text.match(/^(\s*>+\s?)/);
          if (markerMatch) {
            decorations.push(
              Decoration.replace({}).range(line.from, line.from + markerMatch[1].length)
            );
          }
        }
      }

      return false;
    },
  });

  return Decoration.set(decorations, true);
}

export const blockquoteDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = getBlockquoteDecorations(view.state); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getBlockquoteDecorations(update.state);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
```

- [ ] **Step 3: Implement horizontal rule decoration**

Create `packages/core/src/extensions/hr-decoration.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

class HRWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('hr');
    hr.className = 'cm-hr-widget';
    return hr;
  }
}

function getHRDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'HorizontalRule') return;

      const line = state.doc.lineAt(node.from);
      if (line.number === cursorLine) return;

      decorations.push(
        Decoration.line({ class: 'cm-hr' }).range(line.from)
      );
      decorations.push(
        Decoration.replace({ widget: new HRWidget() }).range(line.from, line.to)
      );

      return false;
    },
  });

  return Decoration.set(decorations, true);
}

export const hrDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = getHRDecorations(view.state); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getHRDecorations(update.state);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
```

- [ ] **Step 4: Implement list and task checkbox decoration**

Create `packages/core/src/extensions/list-decoration.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate, WidgetType } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean) { super(); }

  toDOM(): HTMLElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.checked;
    input.className = 'cm-task-checkbox';
    input.style.marginRight = '4px';
    input.style.cursor = 'pointer';
    return input;
  }

  eq(other: CheckboxWidget): boolean {
    return this.checked === other.checked;
  }
}

function getListDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'ListItem') return;

      const line = state.doc.lineAt(node.from);
      if (line.number === cursorLine) return;

      const text = line.text;
      const taskMatch = text.match(/^(\s*[-*+]\s+)\[([ xX])\]/);

      if (taskMatch) {
        decorations.push(
          Decoration.line({ class: 'cm-task-list' }).range(line.from)
        );

        const checked = taskMatch[2].toLowerCase() === 'x';
        const markerStart = line.from;
        const markerEnd = line.from + taskMatch[0].length;

        decorations.push(
          Decoration.replace({
            widget: new CheckboxWidget(checked),
          }).range(markerStart, markerEnd)
        );
      }
    },
  });

  return Decoration.set(decorations, true);
}

export const listDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = getListDecorations(view.state); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getListDecorations(update.state);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
```

- [ ] **Step 5: Implement table decoration**

Create `packages/core/src/extensions/table-decoration.ts`:
```typescript
import { syntaxTree } from '@codemirror/language';
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';

function getTableDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'Table') return;

      const startLine = state.doc.lineAt(node.from);
      const endLine = state.doc.lineAt(node.to);

      for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
        const line = state.doc.line(lineNum);
        decorations.push(
          Decoration.line({ class: 'cm-table' }).range(line.from)
        );
      }

      return false;
    },
  });

  return Decoration.set(decorations, true);
}

export const tableDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = getTableDecorations(view.state); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = getTableDecorations(update.state);
      }
    }
  },
  { decorations: (v) => v.decorations }
);
```

- [ ] **Step 6: Register all new decorations and styles in live preview**

Update `packages/core/src/extensions/live-preview.ts` — add all imports and styles:
```typescript
import { blockquoteDecoration } from './blockquote-decoration';
import { hrDecoration } from './hr-decoration';
import { listDecoration } from './list-decoration';
import { tableDecoration } from './table-decoration';

const blockStyles = EditorView.baseTheme({
  '.cm-blockquote': {
    borderLeft: '3px solid #d1d5db',
    paddingLeft: '12px',
    color: '#6b7280',
    fontStyle: 'italic',
  },
  '.cm-hr': { },
  '.cm-hr-widget': {
    border: 'none',
    borderTop: '2px solid #d1d5db',
    margin: '8px 0',
  },
  '.cm-task-list': { listStyle: 'none' },
  '.cm-table': {
    fontFamily: "'SF Mono', monospace",
    fontSize: '0.9em',
  },
});
```

Add all new decorations and `blockStyles` to the `livePreview()` return array.

- [ ] **Step 7: Run tests**

```bash
pnpm core:test
```

Expected: All block element tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/core/
git commit -m "feat(core): live preview for blockquotes, horizontal rules, lists, checkboxes, and tables"
```

---

## Task 11: Core — Toolbar Commands

**User Story:** As a developer, I can call `toggleBold(view)` and similar commands to programmatically insert or toggle markdown formatting.

**Files:**
- Create: `packages/core/src/toolbar/commands.ts`
- Create: `packages/core/test/commands.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/commands.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { createEditor } from '../src/editor';
import {
  toggleBold, toggleItalic, toggleStrikethrough,
  insertLink, insertImage, setHeading,
  toggleList, toggleTaskList, insertCodeBlock,
  insertHorizontalRule, insertTable,
} from '../src/toolbar/commands';

describe('toolbar commands', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  function createWithContent(content: string, cursorPos: number): EditorView {
    view = createEditor({ parent: container, content });
    view.dispatch({ selection: { anchor: cursorPos } });
    return view;
  }

  function selectRange(from: number, to: number) {
    view.dispatch({ selection: EditorSelection.range(from, to) });
  }

  describe('toggleBold', () => {
    it('should wrap selected text in **', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      toggleBold(view);
      expect(view.state.doc.toString()).toBe('**hello** world');
    });

    it('should remove ** from already bold text', () => {
      createWithContent('**hello** world', 0);
      selectRange(2, 7);
      toggleBold(view);
      expect(view.state.doc.toString()).toBe('hello world');
    });

    it('should insert **bold** placeholder when no selection', () => {
      createWithContent('hello ', 6);
      toggleBold(view);
      expect(view.state.doc.toString()).toBe('hello **bold**');
    });
  });

  describe('toggleItalic', () => {
    it('should wrap selected text in *', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      toggleItalic(view);
      expect(view.state.doc.toString()).toBe('*hello* world');
    });
  });

  describe('toggleStrikethrough', () => {
    it('should wrap selected text in ~~', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      toggleStrikethrough(view);
      expect(view.state.doc.toString()).toBe('~~hello~~ world');
    });
  });

  describe('insertLink', () => {
    it('should insert link syntax with selected text as label', () => {
      createWithContent('hello world', 0);
      selectRange(0, 5);
      insertLink(view);
      expect(view.state.doc.toString()).toBe('[hello](url) world');
    });
  });

  describe('setHeading', () => {
    it('should prepend # to the current line', () => {
      createWithContent('Hello', 0);
      setHeading(view, 1);
      expect(view.state.doc.toString()).toBe('# Hello');
    });

    it('should replace existing heading level', () => {
      createWithContent('## Hello', 3);
      setHeading(view, 3);
      expect(view.state.doc.toString()).toBe('### Hello');
    });
  });

  describe('insertTable', () => {
    it('should insert a 3x3 table template', () => {
      createWithContent('', 0);
      insertTable(view);
      const doc = view.state.doc.toString();
      expect(doc).toContain('| Header |');
      expect(doc).toContain('| --- |');
    });
  });
});
```

Expected: FAIL — commands don't exist.

- [ ] **Step 2: Implement toolbar commands**

Create `packages/core/src/toolbar/commands.ts`:
```typescript
import type { EditorView } from '@codemirror/view';

function wrapSelection(view: EditorView, before: string, after: string, placeholder: string) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    const docText = view.state.doc.toString();
    const precedingText = docText.slice(Math.max(0, from - before.length), from);
    const followingText = docText.slice(to, to + after.length);

    if (precedingText === before && followingText === after) {
      view.dispatch({
        changes: [
          { from: from - before.length, to: from, insert: '' },
          { from: to, to: to + after.length, insert: '' },
        ],
      });
      return;
    }

    view.dispatch({
      changes: { from, to, insert: `${before}${selected}${after}` },
      selection: { anchor: from + before.length, head: to + before.length },
    });
  } else {
    const insert = `${before}${placeholder}${after}`;
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + before.length, head: from + before.length + placeholder.length },
    });
  }
}

export function toggleBold(view: EditorView) {
  wrapSelection(view, '**', '**', 'bold');
}

export function toggleItalic(view: EditorView) {
  wrapSelection(view, '*', '*', 'italic');
}

export function toggleStrikethrough(view: EditorView) {
  wrapSelection(view, '~~', '~~', 'strikethrough');
}

export function insertLink(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const label = selected || 'link text';
  const insert = `[${label}](url)`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + label.length + 3, head: from + label.length + 6 },
  });
}

export function insertImage(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const alt = selected || 'alt text';
  const insert = `![${alt}](image-url)`;
  view.dispatch({ changes: { from, to, insert } });
}

export function setHeading(view: EditorView, level: number) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const stripped = line.text.replace(/^#{1,6}\s*/, '');
  const prefix = '#'.repeat(level) + ' ';
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: prefix + stripped },
  });
}

export function toggleList(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  if (line.text.match(/^\s*[-*+]\s/)) {
    view.dispatch({ changes: { from: line.from, to: line.to, insert: line.text.replace(/^\s*[-*+]\s/, '') } });
  } else {
    view.dispatch({ changes: { from: line.from, to: line.from, insert: '- ' } });
  }
}

export function toggleTaskList(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  if (line.text.match(/^\s*[-*+]\s\[[ xX]\]\s/)) {
    view.dispatch({ changes: { from: line.from, to: line.to, insert: line.text.replace(/^\s*[-*+]\s\[[ xX]\]\s/, '') } });
  } else if (line.text.match(/^\s*[-*+]\s/)) {
    view.dispatch({ changes: { from: line.from, to: line.to, insert: line.text.replace(/^(\s*[-*+]\s)/, '$1[ ] ') } });
  } else {
    view.dispatch({ changes: { from: line.from, to: line.from, insert: '- [ ] ' } });
  }
}

export function insertCodeBlock(view: EditorView) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({ changes: { from, to, insert: `\`\`\`\n${selected || 'code'}\n\`\`\`` } });
}

export function insertHorizontalRule(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  view.dispatch({ changes: { from: line.to, insert: '\n\n---\n' } });
}

export function insertTable(view: EditorView) {
  const { from } = view.state.selection.main;
  const table = `| Header | Header | Header |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n| Cell | Cell | Cell |`;
  view.dispatch({ changes: { from, insert: table } });
}
```

- [ ] **Step 3: Export commands from index.ts**

Update `packages/core/src/index.ts`:
```typescript
export { createEditor, type EditorConfig } from './editor';
export {
  toggleBold, toggleItalic, toggleStrikethrough,
  insertLink, insertImage, setHeading,
  toggleList, toggleTaskList,
  insertCodeBlock, insertHorizontalRule, insertTable,
} from './toolbar/commands';
```

- [ ] **Step 4: Run tests**

```bash
pnpm core:test
```

Expected: All command tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): toolbar commands — bold, italic, strikethrough, links, headings, lists, code, tables"
```

---

## Task 12: Core — Keybindings

**User Story:** As a user, I can press Cmd+B for bold, Cmd+I for italic, Cmd+K for link, and other shortcuts.

**Files:**
- Create: `packages/core/src/toolbar/keybindings.ts`
- Modify: `packages/core/src/editor.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create keybinding map**

Create `packages/core/src/toolbar/keybindings.ts`:
```typescript
import type { KeyBinding } from '@codemirror/view';
import {
  toggleBold, toggleItalic, toggleStrikethrough,
  insertLink, insertCodeBlock,
} from './commands';

export const markdownKeybindings: KeyBinding[] = [
  { key: 'Mod-b', run: (view) => { toggleBold(view); return true; } },
  { key: 'Mod-i', run: (view) => { toggleItalic(view); return true; } },
  { key: 'Mod-Shift-x', run: (view) => { toggleStrikethrough(view); return true; } },
  { key: 'Mod-k', run: (view) => { insertLink(view); return true; } },
  { key: 'Mod-Shift-c', run: (view) => { insertCodeBlock(view); return true; } },
];
```

- [ ] **Step 2: Add keybindings to createEditor**

Update `packages/core/src/editor.ts` — add import:
```typescript
import { markdownKeybindings } from './toolbar/keybindings';
```

Add `keymap.of(markdownKeybindings)` to the extensions array, before the other keymaps.

- [ ] **Step 3: Export keybindings**

Add to `packages/core/src/index.ts`:
```typescript
export { markdownKeybindings } from './toolbar/keybindings';
```

- [ ] **Step 4: Test manually**

```bash
pnpm dev
```

Select text, press Cmd+B — should wrap in `**`. Cmd+I — `*`. Cmd+K — link syntax.

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): keyboard shortcuts — Cmd+B bold, Cmd+I italic, Cmd+K link"
```

---

## Task 13: App — Toolbar Component

**User Story:** As a user, I see a formatting toolbar with buttons for Bold, Italic, Strikethrough, Headings, Link, Image, Code, Lists, Table, and HR.

**Files:**
- Create: `apps/desktop/src/lib/components/Toolbar.svelte`
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Create the Toolbar component**

Create `apps/desktop/src/lib/components/Toolbar.svelte`:
```svelte
<script lang="ts">
  import type { EditorView } from '@codemirror/view';
  import {
    toggleBold, toggleItalic, toggleStrikethrough,
    setHeading, insertLink, insertImage,
    toggleList, toggleTaskList, insertCodeBlock,
    insertHorizontalRule, insertTable,
  } from '@mdedit/core';

  interface Props {
    getEditorView: () => EditorView | undefined;
  }

  let { getEditorView }: Props = $props();

  function exec(fn: (view: EditorView, ...args: any[]) => void, ...args: any[]) {
    const view = getEditorView();
    if (view) {
      fn(view, ...args);
      view.focus();
    }
  }

  let showHeadingMenu = $state(false);

  function selectHeading(level: number) {
    exec(setHeading, level);
    showHeadingMenu = false;
  }
</script>

<div class="toolbar" role="toolbar" aria-label="Formatting toolbar">
  <div class="toolbar-group">
    <button onclick={() => exec(toggleBold)} title="Bold (Cmd+B)" aria-label="Bold">
      <strong>B</strong>
    </button>
    <button onclick={() => exec(toggleItalic)} title="Italic (Cmd+I)" aria-label="Italic">
      <em>I</em>
    </button>
    <button onclick={() => exec(toggleStrikethrough)} title="Strikethrough (Cmd+Shift+X)" aria-label="Strikethrough">
      <s>S</s>
    </button>
  </div>

  <div class="toolbar-separator"></div>

  <div class="toolbar-group">
    <div class="heading-dropdown">
      <button onclick={() => showHeadingMenu = !showHeadingMenu} title="Heading" aria-label="Heading">
        H
      </button>
      {#if showHeadingMenu}
        <div class="heading-menu">
          {#each [1, 2, 3, 4, 5, 6] as level}
            <button onclick={() => selectHeading(level)}>H{level}</button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="toolbar-separator"></div>

  <div class="toolbar-group">
    <button onclick={() => exec(insertLink)} title="Insert Link (Cmd+K)" aria-label="Insert Link">
      Link
    </button>
    <button onclick={() => exec(insertImage)} title="Insert Image" aria-label="Insert Image">
      Img
    </button>
    <button onclick={() => exec(insertCodeBlock)} title="Code Block" aria-label="Code Block">
      Code
    </button>
  </div>

  <div class="toolbar-separator"></div>

  <div class="toolbar-group">
    <button onclick={() => exec(toggleList)} title="Bullet List" aria-label="Bullet List">
      List
    </button>
    <button onclick={() => exec(toggleTaskList)} title="Task List" aria-label="Task List">
      Task
    </button>
    <button onclick={() => exec(insertTable)} title="Insert Table" aria-label="Insert Table">
      Table
    </button>
    <button onclick={() => exec(insertHorizontalRule)} title="Horizontal Rule" aria-label="Horizontal Rule">
      HR
    </button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--toolbar-border, #e5e7eb);
    background: var(--toolbar-bg, #f9fafb);
    flex-shrink: 0;
  }

  .toolbar-group { display: flex; gap: 2px; }

  .toolbar-separator {
    width: 1px;
    height: 20px;
    background: var(--toolbar-border, #d1d5db);
    margin: 0 4px;
  }

  button {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 28px;
    padding: 0 6px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    color: var(--fg, #374151);
  }

  button:hover { background: color-mix(in srgb, var(--fg, #374151) 10%, transparent); }

  .heading-dropdown { position: relative; }

  .heading-menu {
    position: absolute;
    top: 100%;
    left: 0;
    background: var(--toolbar-bg, white);
    border: 1px solid var(--toolbar-border, #e5e7eb);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 100;
    display: flex;
    flex-direction: column;
    padding: 4px;
  }

  .heading-menu button { width: auto; padding: 4px 12px; justify-content: flex-start; }
</style>
```

- [ ] **Step 2: Wire toolbar into App.svelte**

Update `apps/desktop/src/App.svelte` to import Toolbar and add it above Editor:
```svelte
<script lang="ts">
  import Toolbar from './lib/components/Toolbar.svelte';
  // ... existing imports

  function getEditorView() {
    return editor?.getView();
  }
</script>

<main class="app">
  <Toolbar {getEditorView} />
  <Editor ... />
</main>
```

- [ ] **Step 3: Test manually**

```bash
pnpm dev
```

Verify: Toolbar visible. Click Bold — inserts bold. Heading dropdown works. All buttons function.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(app): formatting toolbar with all Tier 1 actions"
```

---

## Task 14: App — Status Bar + Observers

**User Story:** As a user, I see cursor position, word count, and save state in a status bar at the bottom.

**Files:**
- Create: `packages/core/src/observers.ts`
- Create: `packages/core/test/observers.test.ts`
- Create: `apps/desktop/src/lib/components/StatusBar.svelte`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Write failing test for observers**

Create `packages/core/test/observers.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createEditor } from '../src/editor';
import { getCursorInfo } from '../src/observers';

describe('getCursorInfo', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should return correct line and column', () => {
    view = createEditor({ parent: container, content: 'Hello\nWorld' });
    view.dispatch({ selection: { anchor: 8 } });
    const info = getCursorInfo(view.state);
    expect(info.line).toBe(2);
    expect(info.col).toBe(3);
  });

  it('should return correct word count', () => {
    view = createEditor({ parent: container, content: 'Hello world foo bar' });
    const info = getCursorInfo(view.state);
    expect(info.wordCount).toBe(4);
  });

  it('should return 0 words for empty document', () => {
    view = createEditor({ parent: container, content: '' });
    const info = getCursorInfo(view.state);
    expect(info.wordCount).toBe(0);
  });
});
```

Expected: FAIL.

- [ ] **Step 2: Implement observers**

Create `packages/core/src/observers.ts`:
```typescript
import type { EditorState } from '@codemirror/state';

export interface CursorInfo {
  line: number;
  col: number;
  wordCount: number;
  charCount: number;
}

export function getCursorInfo(state: EditorState): CursorInfo {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const col = pos - line.from + 1;

  const text = state.doc.toString();
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  return {
    line: line.number,
    col,
    wordCount: words,
    charCount: text.length,
  };
}
```

Export from `packages/core/src/index.ts`:
```typescript
export { getCursorInfo, type CursorInfo } from './observers';
```

- [ ] **Step 3: Run tests**

```bash
pnpm core:test
```

Expected: Observer tests pass.

- [ ] **Step 4: Create StatusBar component**

Create `apps/desktop/src/lib/components/StatusBar.svelte`:
```svelte
<script lang="ts">
  interface Props {
    line: number;
    col: number;
    wordCount: number;
    isDirty: boolean;
  }

  let { line, col, wordCount, isDirty }: Props = $props();
</script>

<div class="status-bar">
  <div class="status-left">
    <span>Ln {line}, Col {col}</span>
    <span class="sep">|</span>
    <span>{wordCount} words</span>
  </div>
  <div class="status-right">
    <span>UTF-8</span>
    <span class="sep">|</span>
    <span class:unsaved={isDirty}>{isDirty ? 'Unsaved' : 'Saved'}</span>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    padding: 2px 12px;
    border-top: 1px solid var(--status-border, #e5e7eb);
    background: var(--status-bg, #f9fafb);
    font-size: 12px;
    color: var(--status-fg, #6b7280);
    flex-shrink: 0;
    height: 24px;
    align-items: center;
  }

  .status-left, .status-right { display: flex; gap: 8px; }
  .sep { color: color-mix(in srgb, var(--status-fg, #6b7280) 40%, transparent); }
  .unsaved { color: #f59e0b; }
</style>
```

- [ ] **Step 5: Wire StatusBar into App.svelte**

Add StatusBar below Editor in `App.svelte`, with cursor tracking via `getCursorInfo` called from `handleContentChange`. Add `$state` variables for `cursorLine`, `cursorCol`, `wordCount` and update them on every content change.

- [ ] **Step 6: Commit**

```bash
git add packages/core/ apps/desktop/src/
git commit -m "feat: status bar with cursor position, word count, and save state"
```

---

## Task 15: App — Auto-Save

**User Story:** As a user, my changes are automatically saved 2 seconds after I stop typing.

**Files:**
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Add debounced auto-save**

In `App.svelte`, add auto-save logic:
```typescript
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    if (fileState.isDirty && fileState.path) {
      await saveFile(fileState.path, fileState.content);
      fileState.markSaved();
    }
  }, 2000);
}
```

Call `scheduleAutoSave()` at the end of `handleContentChange`.

- [ ] **Step 2: Test manually**

Edit a file, wait 2 seconds. Status bar should change from "Unsaved" to "Saved".

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/App.svelte
git commit -m "feat(app): auto-save with 2-second debounce"
```

---

## Task 16: App — Recent Files

**User Story:** As a user, I can access recently opened files.

**Files:**
- Create: `apps/desktop/src-tauri/src/recent_files.rs`
- Modify: `apps/desktop/src-tauri/src/commands.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/lib/tauri/fileOps.ts`

- [ ] **Step 1: Implement recent files in Rust**

Create `apps/desktop/src-tauri/src/recent_files.rs`:
```rust
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const MAX_RECENT: usize = 10;
const RECENT_FILE: &str = "recent_files.json";

fn get_recent_path(app: &AppHandle) -> PathBuf {
    let data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    fs::create_dir_all(&data_dir).ok();
    data_dir.join(RECENT_FILE)
}

pub fn load_recent(app: &AppHandle) -> Vec<String> {
    let path = get_recent_path(app);
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Vec::new()
    }
}

pub fn add_recent(app: &AppHandle, file_path: &str) {
    let mut recent = load_recent(app);
    recent.retain(|p| p != file_path);
    recent.insert(0, file_path.to_string());
    recent.truncate(MAX_RECENT);

    let path = get_recent_path(app);
    let data = serde_json::to_string(&recent).unwrap_or_default();
    fs::write(path, data).ok();
}
```

- [ ] **Step 2: Add Tauri commands**

Add to `commands.rs`:
```rust
use crate::recent_files;

#[tauri::command]
pub async fn get_recent_files(app: tauri::AppHandle) -> Vec<String> {
    recent_files::load_recent(&app)
}

#[tauri::command]
pub async fn add_to_recent(app: tauri::AppHandle, path: String) {
    recent_files::add_recent(&app, &path);
}
```

Register in `lib.rs` invoke_handler.

- [ ] **Step 3: Add frontend wrappers**

Add to `fileOps.ts`:
```typescript
export async function getRecentFiles(): Promise<string[]> {
  return invoke<string[]>('get_recent_files');
}

export async function addToRecent(path: string): Promise<void> {
  return invoke('add_to_recent', { path });
}
```

Call `addToRecent(result.path)` after opening a file in `App.svelte`.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/
git commit -m "feat(app): recent files persistence"
```

---

## Task 17: App — Drag and Drop

**User Story:** As a user, I can drag a `.md` file from Finder onto mdedit to open it.

**Files:**
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Add drag-and-drop handling**

Check latest Tauri 2 drag-drop event API. Add to `App.svelte` in `onMount`:
```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const currentWindow = getCurrentWindow();
await currentWindow.onDragDropEvent(async (event) => {
  if (event.payload.type === 'drop') {
    const paths = event.payload.paths;
    if (paths.length > 0 && paths[0].match(/\.(md|markdown|mdx)$/)) {
      const result = await invoke<FileData>('open_file', { path: paths[0] });
      fileState.setFile(result.path, result.filename, result.content);
      editor.setContent(result.content);
      addToRecent(result.path);
    }
  }
});
```

- [ ] **Step 2: Test — drag a .md file onto the window**

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/
git commit -m "feat(app): drag-and-drop file opening"
```

---

## Task 18: App — Native macOS Menu Bar

**User Story:** As a user, I see a proper macOS menu bar with File and Edit menus.

**Files:**
- Create: `apps/desktop/src-tauri/src/menu.rs`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Implement native menu**

Check latest Tauri 2 menu API docs. Create `apps/desktop/src-tauri/src/menu.rs`:
```rust
use tauri::menu::{Menu, MenuItem, Submenu, PredefinedMenuItem};
use tauri::{AppHandle, Wry};

pub fn create_menu(app: &AppHandle) -> Result<Menu<Wry>, tauri::Error> {
    let app_menu = Submenu::with_items(app, "mdedit", true, &[
        &PredefinedMenuItem::about(app, Some("About mdedit"), None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::services(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::hide(app, None)?,
        &PredefinedMenuItem::hide_others(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::quit(app, None)?,
    ])?;

    let file_menu = Submenu::with_items(app, "File", true, &[
        &MenuItem::with_id(app, "new", "New", true, Some("CmdOrCtrl+N"))?,
        &MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?,
        &PredefinedMenuItem::separator(app)?,
        &MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?,
        &MenuItem::with_id(app, "save_as", "Save As...", true, Some("CmdOrCtrl+Shift+S"))?,
    ])?;

    let edit_menu = Submenu::with_items(app, "Edit", true, &[
        &PredefinedMenuItem::undo(app, None)?,
        &PredefinedMenuItem::redo(app, None)?,
        &PredefinedMenuItem::separator(app)?,
        &PredefinedMenuItem::cut(app, None)?,
        &PredefinedMenuItem::copy(app, None)?,
        &PredefinedMenuItem::paste(app, None)?,
        &PredefinedMenuItem::select_all(app, None)?,
    ])?;

    Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu])
}
```

- [ ] **Step 2: Register menu and emit events to frontend**

Update `lib.rs` to call `menu::create_menu` in setup, and emit menu-event to the frontend via `on_menu_event`.

- [ ] **Step 3: Listen for menu events in App.svelte**

```typescript
import { listen } from '@tauri-apps/api/event';

await listen<string>('menu-event', (event) => {
  switch (event.payload) {
    case 'new': fileState.reset(); editor.setContent(''); break;
    case 'open': handleOpen(); break;
    case 'save': handleSave(); break;
    case 'save_as': handleSaveAs(); break;
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/
git commit -m "feat(app): native macOS menu bar with File and Edit menus"
```

---

## Task 19: App — Window Title

**User Story:** As a user, the window title shows the filename and a dot when there are unsaved changes.

**Files:**
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Add reactive window title**

```svelte
<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';

  $effect(() => {
    const title = fileState.isDirty
      ? `\u25CF ${fileState.filename} \u2014 mdedit`
      : `${fileState.filename} \u2014 mdedit`;
    getCurrentWindow().setTitle(title);
  });
</script>
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/App.svelte
git commit -m "feat(app): window title with filename and unsaved indicator"
```

---

## Task 20: App — Theme Support

**User Story:** As a user, the editor follows my macOS dark/light preference and I can toggle it manually.

**Files:**
- Create: `packages/core/src/theme.ts`
- Create: `apps/desktop/src/lib/stores/theme.svelte.ts`
- Modify: `packages/core/src/editor.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/desktop/src/app.css`
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Create CM6 light and dark themes**

Create `packages/core/src/theme.ts`:
```typescript
import { EditorView } from '@codemirror/view';

export const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff', color: '#1a1a1a' },
  '.cm-content': { caretColor: '#1a1a1a' },
  '.cm-cursor': { borderLeftColor: '#1a1a1a' },
  '.cm-activeLine': { backgroundColor: '#f3f4f620' },
  '.cm-selectionBackground': { backgroundColor: '#3b82f630' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#3b82f640' },
}, { dark: false });

export const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#1e1e2e', color: '#cdd6f4' },
  '.cm-content': { caretColor: '#cdd6f4' },
  '.cm-cursor': { borderLeftColor: '#cdd6f4' },
  '.cm-activeLine': { backgroundColor: '#313244' },
  '.cm-selectionBackground': { backgroundColor: '#45475a' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: '#585b70' },
}, { dark: true });
```

- [ ] **Step 2: Add theme compartment to createEditor**

Update `packages/core/src/editor.ts`:
```typescript
import { Compartment } from '@codemirror/state';
import { lightTheme, darkTheme } from './theme';

const themeCompartment = new Compartment();

// In createEditor, add to extensions:
themeCompartment.of(config.dark ? darkTheme : lightTheme)

// New export:
export function setEditorTheme(view: EditorView, dark: boolean) {
  view.dispatch({
    effects: themeCompartment.reconfigure(dark ? darkTheme : lightTheme),
  });
}
```

Add `dark?: boolean` to `EditorConfig`. Export `setEditorTheme` from `index.ts`.

- [ ] **Step 3: Create theme store and wire into app**

Create `apps/desktop/src/lib/stores/theme.svelte.ts` with system-follow logic via `window.matchMedia('(prefers-color-scheme: dark)')` and a `toggle()` method.

Update `apps/desktop/src/app.css` with CSS custom properties for light/dark and a `:root.dark` override.

Add `$effect` in `App.svelte` to toggle `document.documentElement.classList` and call `setEditorTheme`.

- [ ] **Step 4: Commit**

```bash
git add packages/core/ apps/desktop/
git commit -m "feat: light/dark theme support with system follow and manual toggle"
```

---

## Task 21: App — File Association

**User Story:** As a user, I can double-click a `.md` file in Finder to open it in mdedit.

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/src/App.svelte`

- [ ] **Step 1: Configure file association**

Check latest Tauri 2 docs. Add to `tauri.conf.json` under `bundle`:
```json
"fileAssociations": [
  {
    "ext": ["md", "markdown", "mdx"],
    "mimeType": "text/markdown",
    "description": "Markdown Document",
    "role": "Editor"
  }
]
```

- [ ] **Step 2: Handle file-open events from OS**

In Rust, handle the file-open event and emit to frontend. In Svelte, listen and open the file.

- [ ] **Step 3: Test with a production build**

```bash
pnpm build
```

Double-click a `.md` file in Finder — it should open in mdedit.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/
git commit -m "feat(app): register as .md file handler"
```

---

## Task 22: Polish and Release Prep

**User Story:** As a user, the app feels polished — proper focus, comfortable padding, correct metadata.

**Files:**
- Various component files and configs

- [ ] **Step 1: Editor polish**

Add content padding and max-width to Editor styles:
```css
.editor-container :global(.cm-content) {
  padding: 16px 24px;
  max-width: 80ch;
  margin: 0 auto;
}
```

- [ ] **Step 2: App metadata**

Set `productName`, `version`, `identifier`, window defaults in `tauri.conf.json`.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
cd apps/desktop/src-tauri && cargo test
```

Expected: All tests pass.

- [ ] **Step 4: Build and smoke test**

```bash
pnpm build
```

Smoke test: open file, live preview, toolbar, keyboard shortcuts, save, drag-drop, theme toggle, status bar.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: polish and release prep for Tier 1 MVP"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | Root configs, core package, Tauri+Svelte scaffold |
| 2 | Core editor factory | `packages/core/src/editor.ts` |
| 3 | Mount editor in Tauri | `Editor.svelte`, `App.svelte` |
| 4 | File open/save (Rust) | `commands.rs`, `fileOps.ts`, `fileState.svelte.ts` |
| 5 | Live preview: headings | `heading-decoration.ts` |
| 6 | Live preview: inline formatting | `inline-decoration.ts` |
| 7 | Live preview: links | `link-decoration.ts` |
| 8 | Live preview: images | `image-widget.ts` |
| 9 | Live preview: code blocks | `code-block.ts` |
| 10 | Live preview: lists, quotes, HR, tables | Four decoration files |
| 11 | Toolbar commands | `commands.ts` |
| 12 | Keybindings | `keybindings.ts` |
| 13 | Toolbar component | `Toolbar.svelte` |
| 14 | Status bar + observers | `observers.ts`, `StatusBar.svelte` |
| 15 | Auto-save | `App.svelte` |
| 16 | Recent files | `recent_files.rs` |
| 17 | Drag and drop | `App.svelte` |
| 18 | Native macOS menu | `menu.rs` |
| 19 | Window title | `App.svelte` |
| 20 | Theme support | `theme.ts`, `theme.svelte.ts` |
| 21 | File association | `tauri.conf.json` |
| 22 | Polish and release | Various |
