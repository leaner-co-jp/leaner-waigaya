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

Slack WebSocket → Rust(`slack_client.rs`) → Tauriイベント emit → Control側 `TextQueue` に蓄積 → `display-slack-message` で Display へ → `DisplayWindow.tsx` でFramer Motionアニメーション付き表示。画像付きメッセージはテキストを先に `add-to-text-queue`、画像は非同期取得後 `message-images-ready` → `display-message-images-update` で追送（5秒タイムアウト）

## Gotchas

- **macOS専用**: `transparent` + `macOSPrivateApi: true` はmacOSのみ有効。他OSでは透過表示が動作しない
- **Auto-updater**: GitHub Releases の `latest.json` をエンドポイントとして自動更新。ビルド時は minisign 秘密鍵が必要（`tauri signer generate` で生成）。`ControlApp.tsx` が起動時にチェックし、更新があれば**同意を求めずダウンロード・適用して自動で再起動する**（古いバージョンが残ると多重起動の検知など新しい診断が効かないため）。失敗時は起動を止めず、バナーと再試行ボタンを出す
- **ポート固定**: Vite は `1420` をstrict使用。`tauri:dev` 前に他プロセスが占有していると起動失敗する
- **HMRポート**: Vite HMR はポート `1421` も使用する（`vite.config.ts` で設定）
- **データ保存先**: 設定・ユーザー・絵文字データは `~/Library/Application Support/jp.co.leaner.waigaya/` に保存（`slack-config.json`, `users.json`, `emojis.json`）
- **Viteマルチエントリ**: `control.html` と `display.html` が別エントリ。`vite.config.ts` の `rollupOptions.input` で管理
- **`_queueAction` フラグ**: `SlackMessage._queueAction` はフロントエンド内部用（TextQueueへの追加指示）。Slack API由来ではない
- **絵文字変換**: `emoji-converter.ts` の出力は HTML文字列。インナーHTMLとして描画するため、Slack API以外の入力を渡さないこと
- **外部URLを開く**: `openUrl` from `@tauri-apps/plugin-opener`（Rust側 `tauri-plugin-opener = "2"` と対応）
- **Slack message subtype**: `message` タイプイベントには `bot_message`/`message_changed`/`message_deleted` 等のsubtypeがある。`SlackEvent` 構造体に `subtype: Option<String>` フィールドが必要
- **デバッグログ経路**: Rust → フロントエンドのデバッグ情報は `socket-mode-debug`（String payload）イベント経由でLogViewerに届く
- **受信ループを止めない**: Socket Mode の受信ループは ACK と Pong の送信だけを担当し、イベント本体の処理（`users.info` / `conversations.replies` / 画像取得）は mpsc 経由でワーカータスクに渡す。受信ループで Slack Web API を待つと（`HTTP_TIMEOUT` は30秒）後続イベントの ACK と Ping への Pong が遅れ、Slack 側で配信失敗と数えられる。ワーカーは再接続をまたいで1本だけなのでメッセージの到着順は保たれる。ヘルスチェックの `auth.test` も同じ理由で `tokio::spawn` に逃がしている
- **Enable Events が勝手にオフになる**: Slack は60分の間にイベント配信の95%以上が失敗すると Event Subscriptions を自動で無効化してメールを送る。Socket Mode は WebSocket 接続が1本もないとイベントを配信できないため、誰もアプリを起動していない時間帯が長いとこれだけでも無効化されうる（アプリの不具合とは限らない）。Event Subscriptions 画面の Delayed Events は、ダウンタイム中に取りこぼしたイベントを24時間かけて再配信する機能。有効にすると起動直後に何時間も前のメッセージが流れ出すため、このアプリではオフのままにする
- **接続の生死監視（Ping / スリープ復帰）**: 30秒ごとにこちらから Ping を送る。送信が失敗すれば経路が死んでいる。あわせて2つ見ている。(1) 何も受信しない状態が90秒続いたらハーフオープン（経路は死んだが RST が届かず `read` が永久に待つ状態）とみなして張り直す。イベント・Ping・Pong のどれでも「受信」に数えるので静かなチャンネルでも誤検知しない。(2) Ping タイマーの発火間隔を `SystemTime`（壁時計）で測り、90秒を超えて空いていたら OS がスリープしていたとみなして張り直す。`Instant` は単調時計でスリープ中に進まないが `SystemTime` は進むので、この差でスリープ復帰を検出できる（`NSWorkspace` 等の macOS API に依存せずに済む）。**Ping 側の interval は既定の Burst 挙動のままにする**——復帰直後に溜まった tick が即発火することが検出の速さにつながる。逆にヘルスチェック側は `MissedTickBehavior::Delay` にしてある（長時間スリープすると復帰時に `auth.test` を何十回も連打することになるため）
- **ヘルスチェック**: Socket Modeループ内で5分ごとに `auth.test` を実行。失敗時は `socket-mode-warning` でLogViewerに警告を表示する（`auth.test` が落ちても WebSocket は生きているため、接続状態は落とさない）。応答待ちで受信ループを止めないよう `tokio::spawn` で実行する
- **slack-last-event イベント**: メッセージ/リアクション受信時にemitされ、フロントエンドで「最後のイベント受信: X分前」を表示する。30分以上未受信の場合はEvent Subscriptions確認の警告を表示
- **Slackエラー変換**: `translate_slack_error()` (slack_client.rs) が `socket_mode_not_enabled`/`invalid_auth`/`missing_scope` 等のエラーコードを日本語メッセージに変換
- **Socket Mode 再接続イベント**: `socket-mode-connected` / `socket-mode-disconnected` / `socket-mode-reconnecting`（試行回数: number）/ `socket-mode-error`。UIの接続状態は `socket-mode-connected` で true、`disconnected`/`error` で false。**接続は生きているが伝えたいことは `socket-mode-warning`（String payload）を使う**（起動通知の投稿失敗、受信経路の異常など）。こちらは接続状態を落とさずLogViewerにwarnとして出るだけ。接続の生死と関係ない事象に `socket-mode-error` を使うと、繋がっているのにUIが切断表示になる
- **起動通知と受信経路チェック**: Socket Mode が初めて確立したとき（プロセスにつき1回、再接続では投稿しない）、監視チャンネル全部に `OSユーザー名@ホスト名` を含む起動通知を投稿する。Bot Token に `chat:write` スコープが必要。投稿した `(channel, ts)` を `startup_probe` に覚えておき、15秒以内に Events API 経由で戻ってくるかを見る。戻ってこなければ「投稿は届いたのに受信が死んでいる」＝ Event Subscriptions が無効の可能性として `socket-mode-warning` で警告する。`chat.postMessage`（Web API）と Events API は別経路なので、両方通して初めて疎通と言える
- **終了通知**: `disconnect()` の先頭で監視チャンネルに終了通知（💤）を投稿する。`lib.rs` の `RunEvent::Exit` から `block_on(disconnect())` で呼ばれるため、アプリ終了時にも通る（UIの切断ボタンからも同じ経路）。起動通知を投稿できたとき（`startup_announced`）だけ出し、投稿したらフラグを false に戻して二重投稿を防ぐ。**全チャンネル並列で投稿し全体3秒で打ち切る**——共有HTTPクライアントのタイムアウトは30秒なので、そのままだとアプリが閉じるまで最悪30秒待たされる。切断→再接続すると `startup_notified` は接続タスクごとのローカル変数なので起動通知が再度出て、「終了 → 起動」と対になる
- **Bot User の投稿に bot_message subtype は付かない**: `bot_message` が付くのは Incoming Webhook 等の場合で、Bot Token で `chat.postMessage` した投稿は subtype なしの通常メッセージとして届く。自分の投稿の判定に subtype を使うと素通りするので、`startup_probe` に覚えた ts との一致で判定する。一致したら受信確認を取るだけで打ち切らず、起動通知も通常のメッセージとして画面に流す（自分のぶんも他人のぶんも表示される）
- **Slack に送るテキストの絵文字**: Slack はメッセージ内の Unicode 絵文字をコロン記法に正規化して Events API で返すため、投稿時に 📡 と書いても受信時には `:satellite_antenna:` になる。`emoji-converter.ts` のマップは gemoji（GitHubの絵文字名）由来なので Slack 固有の名前は変換できず、`:satellite_antenna:` がそのまま表示される。さらに同じ名前が別の絵文字を指すこともある（`satellite` は Slack で 🛰️、gemoji で 📡）。アプリから投稿する文言には両方で一致する名前（`:wave:` `:tv:` `:rocket:` `:eyes:` `:white_check_mark:` など）を使う
- **多重起動の検知**: Socket Mode の `hello` に含まれる `num_connections`（このアプリが張っている接続の総数）を `socket-mode-connections`（number payload）で通知する。2以上なら同じトークンで他のユーザーが起動しており、Slackはイベントを接続のどれか1つにしか配信しないためメッセージが分散する。判定できるのは接続確立時のみ（先に接続していた側は次の再接続まで気づけない）
- **画像追送イベント**: `message-images-ready`（Rust→Control）、`display-message-images-update`（Control→Display）。相関キーは `(channel, timestamp)` の組
- **トークン更新タイミング**: `update_config` でトークンを変更しても、実行中の Socket Mode には即反映されない。次回の再接続（切断→接続、または自動再接続）から新トークンが使われる

## コーディング規約

- TypeScript: strict mode有効
- React: 関数コンポーネント + Hooks
- スタイリング: Tailwind CSS utility-first
- Rust: edition 2021
