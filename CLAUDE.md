# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Leaner Waigaya - Slackの特定チャンネルの会話をデスクトップに透過表示するデスクトップアクセサリ。Tauri v2（Rust）+ React 19 + TypeScript + Vite + Tailwind CSS構成。

## 開発コマンド

```bash
npm run dev            # フロントエンドのみ起動（Tauriなし、UI確認用）
npm run tauri:dev      # 開発モード起動（フロントエンド + Rustバックエンド）
npm run tauri:build    # 本番ビルド
npm run type:check     # TypeScript型チェック
cd src-tauri && cargo check  # Rustのコンパイルエラーだけ素早く確認（full buildより速い）
```

前提条件: Node.js v20以上、Rust最新stable、Tauri v2の前提条件

## Slack セットアップ（初回）

1. Slack App を作成し **Socket Mode** を有効化
2. Bot Token（`xoxb-`）と App Token（`xapp-`）を取得
3. アプリ起動後、controlウィンドウでトークンを入力して接続

## アーキテクチャ

### マルチウィンドウ構成

- **controlウィンドウ** (`control.html` → `src/control-renderer.ts` → `ControlApp.tsx`): Slack接続管理、チャンネル選択、表示設定のUI
- **displayウィンドウ** (`display.html` → `src/display-renderer.ts` → `DisplayApp.tsx`): メッセージの透過表示。常に最前面、マウスイベント透過
  - `tauri.conf.json` で `transparent: true`, `alwaysOnTop: true` を設定
  - macOSでの透過には `macOSPrivateApi: true` が必須

### フロントエンド → バックエンド通信

- **Tauriコマンド（invoke）**: フロントエンドからRustの関数を呼び出す（`slack_connect`, `save_settings`等）
- **Tauriイベント（emit/listen）**: ウィンドウ間通信とRust→フロントエンドの通知（`display-slack-message`, `display-settings-update`等）
- フロントエンドのIPC呼び出しは `src/lib/tauri-api.ts` に集約（`tauriAPI` を直接 import して使う）

### バックエンド（Rust: src-tauri/src/）

- `lib.rs`: Tauriアプリセットアップとコマンド登録
- `slack_client.rs`: Slack Socket Mode WebSocket接続、メッセージ受信、Web API呼び出し
- `storage.rs`: ローカル設定の永続化
- `commands/slack.rs`, `commands/config.rs`: Tauriコマンド実装

### キーファイル（フロントエンド）

- `src/lib/types.ts`: フロントエンド全体の型定義
- `src/lib/tauri-api.ts`: Tauri IPC ラッパー（全 invoke/listen はここ経由）
- `src/lib/TextQueue.ts`: displayウィンドウのメッセージキュー管理
- `src/lib/emoji-converter.ts`: Slack絵文字（`:name:`）→ Unicode/HTMLイメージ変換
- `src/components/`: UI コンポーネント群（ChannelManager, DisplayWindow, SlackConnection, EmojiManager（カスタム絵文字管理）, UserManager（ユーザー情報キャッシュ）等）
- `src/hooks/useLogger.ts`: コントロールUI用のログ管理（最大100件保持）
- `src/components/DisplaySettings.tsx`: 表示設定UI（フォントサイズ、速度、表示位置等）
- `src/components/LogViewer.tsx`: コントロールUI内のログ表示コンポーネント

### メッセージ表示フロー

Slack WebSocket → Rust(`slack_client.rs`) → Tauriイベント emit → Display側で `TextQueue`(`src/lib/TextQueue.ts`) に蓄積 → `DisplayWindow.tsx` でFramer Motionアニメーション付き表示

## Gotchas

- **macOS専用**: `transparent` + `macOSPrivateApi: true` はmacOSのみ有効。他OSでは透過表示が動作しない
- **Auto-updater**: GitHub Releases の `latest.json` をエンドポイントとして自動更新。ビルド時は minisign 秘密鍵が必要（`tauri signer generate` で生成）
- **ポート固定**: Vite は `1420` をstrict使用。`tauri:dev` 前に他プロセスが占有していると起動失敗する
- **HMRポート**: Vite HMR はポート `1421` も使用する（`vite.config.ts` で設定）
- **データ保存先**: 設定・ユーザー・絵文字データは `~/Library/Application Support/jp.co.leaner.waigaya/` に保存（`slack-config.json`, `users.json`, `emojis.json`）
- **Viteマルチエントリ**: `control.html` と `display.html` が別エントリ。`vite.config.ts` の `rollupOptions.input` で管理
- **`_queueAction` フラグ**: `SlackMessage._queueAction` はフロントエンド内部用（TextQueueへの追加指示）。Slack API由来ではない
- **絵文字変換**: `emoji-converter.ts` の出力は HTML文字列。インナーHTMLとして描画するため、Slack API以外の入力を渡さないこと
- **外部URLを開く**: `openUrl` from `@tauri-apps/plugin-opener`（Rust側 `tauri-plugin-opener = "2"` と対応）
- **Slack message subtype**: `message` タイプイベントには `bot_message`/`message_changed`/`message_deleted` 等のsubtypeがある。`SlackEvent` 構造体に `subtype: Option<String>` フィールドが必要
- **デバッグログ経路**: Rust → フロントエンドのデバッグ情報は `socket-mode-debug`（String payload）イベント経由でLogViewerに届く
- **ヘルスチェック**: Socket Modeループ内で5分ごとに `auth.test` を実行。失敗時はLogViewerに警告を表示
- **slack-last-event イベント**: メッセージ/リアクション受信時にemitされ、フロントエンドで「最後のイベント受信: X分前」を表示する。30分以上未受信の場合はEvent Subscriptions確認の警告を表示
- **Slackエラー変換**: `translate_slack_error()` (slack_client.rs) が `socket_mode_not_enabled`/`invalid_auth`/`missing_scope` 等のエラーコードを日本語メッセージに変換

## コーディング規約

- TypeScript: strict mode有効
- React: 関数コンポーネント + Hooks
- スタイリング: Tailwind CSS utility-first
- Rust: edition 2021
