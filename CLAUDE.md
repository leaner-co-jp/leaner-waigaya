# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Leaner Waigaya - Slackの特定チャンネルの会話をデスクトップに透過表示するデスクトップアクセサリ。Tauri v2（Rust）+ React 19 + TypeScript + Vite + Tailwind CSS構成。

## 開発コマンド

```bash
npm run tauri:dev      # 開発モード起動（フロントエンド + Rustバックエンド）
npm run tauri:build    # 本番ビルド
npm run type:check     # TypeScript型チェック
```

前提条件: Node.js v20以上、Rust最新stable、Tauri v2の前提条件

## アーキテクチャ

### マルチウィンドウ構成

- **controlウィンドウ** (`control.html` → `src/control-renderer.ts` → `ControlApp.tsx`): Slack接続管理、チャンネル選択、表示設定のUI
- **displayウィンドウ** (`display.html` → `src/display-renderer.ts` → `DisplayApp.tsx`): メッセージの透過表示。常に最前面、マウスイベント透過

### フロントエンド → バックエンド通信

- **Tauriコマンド（invoke）**: フロントエンドからRustの関数を呼び出す（`slack_connect`, `save_settings`等）
- **Tauriイベント（emit/listen）**: ウィンドウ間通信とRust→フロントエンドの通知（`display-slack-message`, `display-settings-update`等）
- フロントエンドのIPC呼び出しは `src/lib/tauri-api.ts` に集約（`window.electronAPI`互換レイヤー）

### バックエンド（Rust: src-tauri/src/）

- `lib.rs`: Tauriアプリセットアップとコマンド登録
- `slack_client.rs`: Slack Socket Mode WebSocket接続、メッセージ受信、Web API呼び出し
- `storage.rs`: ローカル設定の永続化
- `commands/slack.rs`, `commands/config.rs`: Tauriコマンド実装

### メッセージ表示フロー

Slack WebSocket → Rust(`slack_client.rs`) → Tauriイベント emit → Display側で `TextQueue`(`src/lib/TextQueue.ts`) に蓄積 → `DisplayWindow.tsx` でFramer Motionアニメーション付き表示

## コーディング規約

- TypeScript: strict mode有効
- React: 関数コンポーネント + Hooks
- スタイリング: Tailwind CSS utility-first
- Rust: edition 2021
