## [1.3.1] - 2026-03-02

### Added
- release skill を追加（リリース作業の自動化）

### Changed
- `out/` を .gitignore に追加

---

## [1.3.0] - 2026-02-27

### Added
- 管理ウィンドウへのログ表示エリアを追加し、Slack診断ログを整備

### Fixed
- カスタム絵文字のレースコンディションを修正

### Changed
- チャンネル一覧で参加チャンネルを上位に表示し、未参加チャンネルを選択不可に
- ハードコードの絵文字マップを gemoji パッケージに置き換え
- `window.electronAPI` 互換レイヤーを削除し、`tauriAPI` の直接 import に移行
- Tailwind CSS v3 → v4 にメジャーアップデート
- Vite v5 → v7、`@vitejs/plugin-react` v4 → v5 にメジャーアップデート
- postcss を直接依存から削除し、Cargo.lock のバージョンを同期
- 依存パッケージのマイナー/パッチアップデート
