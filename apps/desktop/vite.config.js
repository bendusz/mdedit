import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [sveltekit()],

  define: {
    // Build-time flag: true only when MDEDIT_UPDATER_PUBKEY env var is set (CI release builds).
    // Dev builds default to false, disabling update checks entirely.
    // @ts-expect-error process is a nodejs global
    __MDEDIT_UPDATER_ENABLED__: !!process.env.MDEDIT_UPDATER_PUBKEY,
    // Inject the real pubkey at build time; falls back to the placeholder in dev.
    __MDEDIT_UPDATER_PUBKEY__: JSON.stringify(
      // @ts-expect-error process is a nodejs global
      process.env.MDEDIT_UPDATER_PUBKEY || 'REPLACE_WITH_REAL_PUBLIC_KEY_BEFORE_RELEASE'
    ),
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
