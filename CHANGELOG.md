## [1.3.4] - 2026-05-22

### Added
- Socket Modeの再接続・切断通知と画像の非同期取得を実装

### Fixed
- Socket Modeのタスク重複実行とAPI呼び出しタイムアウトを修正
- tauri-api.ts リスナーの Promise 完了前アンマウントによるメモリリークを修正
- Socket Mode 安定化のレビュー指摘点（4件）を修正
- SocketRetryOutcome を impl ブロック外に移してビルドエラーを解消

---

## [1.3.3] - 2026-05-22

### Fixed
- アプリ終了時にSocket Mode接続を適切にクローズするよう修正

---

## [1.3.2] - 2026-05-12

### Added
- Slack API設定変更の検知機能を追加（トークン・チャンネル設定変更時に自動で再接続）

### Changed
- トークン設定UIの改善とデバッグログの強化
- 依存パッケージのバージョンアップ

---

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
