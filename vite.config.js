import { defineConfig } from "vite"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  // ベースパス
  base: "./",

  // ビルド設定
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        display: resolve(__dirname, "display/display.html"),
        control: resolve(__dirname, "control/control.html"),
      },
    },
  },

  // 開発サーバー設定
  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },

  // Electronとの互換性のため
  define: {
    global: "globalThis",
  },
})
