# COMSC - Slack Message Display App

Slack メッセージを Electron アプリで透過ウィンドウに表示するアプリケーションです。

## 技術スタック

- **Electron**: デスクトップアプリケーションフレームワーク
- **Vite**: 高速なビルドツール
- **Slack API**: Slack メッセージの取得

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 開発環境での実行

```bash
# Viteサーバーを起動してElectronアプリを実行
npm run electron:dev
```

このコマンドは以下を実行します：

- Vite サーバーを `http://localhost:5173` で起動
- サーバーが起動したら Electron アプリを開発モードで起動

### 3. プロダクションビルド

```bash
# HTMLファイルをビルド
npm run build

# Electronアプリをパッケージ化
npm run electron:build

# パッケージ化のみ（インストーラーなし）
npm run electron:pack
```

## 開発用コマンド

- `npm run dev`: Vite サーバーのみ起動
- `npm run build`: プロダクション用に HTML ファイルをビルド
- `npm run preview`: ビルドしたファイルをプレビュー
- `npm run electron:dev`: 開発環境で Electron アプリを起動
- `npm run electron:build`: アプリをビルドしてパッケージ化
- `npm run electron:pack`: パッケージ化のみ実行

## ファイル構造

```
comsc/
├── main.js                 # Electronメインプロセス
├── display/
│   ├── display.html        # 透過表示ウィンドウ
│   ├── display.css
│   └── display.js
├── control/
│   ├── control.html        # コントロールパネル
│   ├── control.css
│   ├── control.js
│   └── slack-client.js     # Slack API クライアント
├── dist/                   # Viteビルド出力
├── release/                # Electronビルド出力
├── vite.config.js          # Vite設定
├── electron-builder.json   # Electron Builder設定
└── package.json
```

## 開発とプロダクションの違い

### 開発環境

- HTML ファイルは Vite サーバー（`http://localhost:5173`）から読み込み
- ホットリロード対応
- 開発者ツール利用可能

### プロダクション環境

- HTML ファイルは`dist/`フォルダのビルド済みファイルから読み込み
- 最適化されたバンドル
- パッケージ化されたアプリ

## Slack 設定

アプリを使用するには、Slack App の作成とトークンの取得が必要です。詳細はアプリ内のセットアップガイドを参照してください。
