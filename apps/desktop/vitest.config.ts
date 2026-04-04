import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
    },
  },
  define: {
    // Provide a default value for the build-time flag so tests can import
    // updater.ts without a Tauri/Vite build step. Individual tests can
    // override the runtime behaviour via vi.stubGlobal('__MDEDIT_UPDATER_ENABLED__', false).
    __MDEDIT_UPDATER_ENABLED__: true,
  },
  esbuild: {
    // tsconfig.json extends .svelte-kit/tsconfig.json which is only generated
    // after `pnpm build` or `pnpm dev`. In a test-only environment that file
    // does not exist and esbuild/vite would throw TSConfckParseError.
    // Passing an empty raw config makes esbuild skip the project tsconfig
    // lookup entirely; tsconfig.test.json covers the real compiler options
    // but is not auto-discovered by esbuild (it only looks for tsconfig.json).
    tsconfigRaw: '{}',
  },
  test: {
    environment: 'jsdom',
  },
});
