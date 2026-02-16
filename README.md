# Leaner Waigaya

Slack の特定のチャンネルの会話をデスクトップに透過表示させて、チームの「わいわいがやがや」した雰囲気を感じられるようにするデスクトップアクセサリです。

## 主な機能

- 指定した Slack チャンネルのメッセージをリアルタイムで表示
- デスクトップ上に常に最前面で透過表示
- 複数チャンネルの監視に対応
- カスタム絵文字の表示
- スレッド返信の親メッセージ表示
- アプリ起動時の自動アップデートチェック

## 技術スタック

- **バックエンド**: Rust + Tauri v2
- **フロントエンド**: React + TypeScript + Vite
- **Slack連携**: Socket Mode (WebSocket) + Web API

## 開発方法

### 前提条件

- [Node.js](https://nodejs.org/) v20 以上
- [Rust](https://www.rust-lang.org/tools/install) (最新の stable)
- [Tauri v2 の前提条件](https://v2.tauri.app/start/prerequisites/)

### セットアップ

```sh
npm install
```

### 開発サーバーの起動

```sh
npm run tauri:dev
```

### ビルド

```sh
npm run tauri:build
```

## 自動アップデート

アプリ起動時に GitHub Releases から最新バージョンを自動チェックします。新しいバージョンがある場合、コントロールウィンドウ上部にバナーが表示され、「更新する」ボタンからアップデートできます。

### リリース方法（開発者向け）

1. `src-tauri/tauri.conf.json` の `version` を更新
2. タグをプッシュしてリリースを作成
   ```sh
   git tag v1.1.0
   git push --tags
   ```
3. GitHub Actions が自動でビルド・署名・GitHub Release 作成・`latest.json` 生成を行います

### 署名キーのセットアップ（初回のみ）

```sh
npx tauri signer generate -w ~/.tauri/leaner-waigaya.key
```

生成された公開鍵は `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` に設定済みです。秘密鍵とパスワードは GitHub Secrets に以下の名前で登録してください：

- `TAURI_SIGNING_PRIVATE_KEY` — 秘密鍵の内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — パスワード

## ダウンロードと実行方法

### 1. アプリケーションのダウンロード

1.  リポジトリの [Releases](https://github.com/leaner-co-jp/leaner-waigaya/releases) ページに移動します。
2.  最新のリリースから、お使いの OS に合ったインストーラーをダウンロードします。
    - macOS: `.dmg` ファイル
    - Windows: `.msi` または `.exe` ファイル

### 2. macOS での実行方法

macOS のセキュリティ機能（Gatekeeper）により、ダウンロードしたアプリケーションをそのままでは開けない場合があります。その場合は、以下の手順で実行してください。

1.  ダウンロードした zip ファイルを解凍します。
2.  ターミナルを開き、`cd`コマンドでアプリケーションが保存されているディレクトリに移動します。
    ```sh
    # 例：ダウンロードフォルダに保存した場合
    cd ~/Downloads/
    ```
3.  以下のコマンドを実行して、macOS の検疫属性を解除します。
    ```sh
    xattr -d com.apple.quarantine "Leaner Waigaya.app"
    ```
4.  これで、アプリケーションをダブルクリックで起動できるようになります。

### 3. Windows での実行方法

Windows のセキュリティ機能（SmartScreen）により、インストーラーの実行時に警告が表示されることがあります。

1.  ダウンロードした `.msi` または `.exe` インストーラーを実行します。
2.  「Windows によって PC が保護されました」という画面が表示された場合は、「詳細情報」をクリックします。
3.  次に表示される「実行」ボタンをクリックすると、インストールが開始されます。
