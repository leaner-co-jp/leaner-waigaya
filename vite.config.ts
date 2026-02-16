import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],

  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Rustソースの変更を無視
      ignored: ['**/src-tauri/**'],
    },
  },

  // Tauri CLI では clearScreen が false
  clearScreen: false,

  build: {
    rollupOptions: {
      input: {
        control: './control.html',
        display: './display.html',
      },
    },
    // Tauriのターゲット
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // デバッグビルドではminifyしない
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // デバッグビルドではsourcemapを生成
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  // 環境変数 (Tauri)
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
});
