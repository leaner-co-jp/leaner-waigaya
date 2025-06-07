# COMSC - Slack Message Display App

Slack メッセージを Electron アプリで透過ウィンドウに表示するアプリケーションです。

## 技術スタック

- **Electron**: デスクトップアプリケーションフレームワーク
- **Electron Forge**: パッケージング・配布ツール
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

### 3. プロダクション環境での実行

```bash
# Electron Forgeでアプリを起動
npm start
```

### 4. パッケージング・配布

```bash
# HTMLファイルをビルドしてアプリをパッケージ化
npm run package

# インストーラーを作成
npm run make

# 配布（設定済みの場合）
npm run publish
```

## 開発用コマンド

- `npm start`: Electron Forge でアプリを起動
- `npm run dev`: Vite サーバーのみ起動
- `npm run build`: プロダクション用に HTML ファイルをビルド
- `npm run preview`: ビルドしたファイルをプレビュー
- `npm run electron:dev`: 開発環境で Electron アプリを起動
- `npm run package`: アプリをパッケージ化
- `npm run make`: インストーラーを作成
- `npm run publish`: アプリを配布（設定済みの場合）

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
├── out/                    # Electron Forgeパッケージ出力
├── vite.config.js          # Vite設定
├── forge.config.js         # Electron Forge設定
└── package.json
```

## パッケージング詳細

### サポートプラットフォーム

- **macOS**: ZIP 形式の配布パッケージ
- **Windows**: Squirrel.Windows 形式のインストーラー
- **Linux**: DEB・RPM パッケージ

### 出力ディレクトリ

- `out/COMSC-{platform}-{arch}/`: パッケージ化されたアプリ
- `out/make/`: インストーラー・配布パッケージ

### カスタマイズ

`forge.config.js`でパッケージングの詳細設定が可能：

- アプリ名・アイコン
- インストーラーの設定
- 配布設定
- セキュリティ設定（Fuses）

## 開発とプロダクションの違い

### 開発環境

- HTML ファイルは Vite サーバー（`http://localhost:5173`）から読み込み
- ホットリロード対応
- 開発者ツール利用可能

### プロダクション環境

- HTML ファイルは`dist/`フォルダのビルド済みファイルから読み込み
- 最適化されたバンドル
- パッケージ化されたアプリ

## 推奨ワークフロー

1. **開発時**: `npm run electron:dev` で開発環境を使用
2. **テスト時**: `npm start` でプロダクション環境をテスト
3. **パッケージ化**: `npm run package` でアプリをパッケージ化
4. **配布**: `npm run make` でインストーラーを作成

## Slack 設定

アプリを使用するには、Slack App の作成とトークンの取得が必要です。詳細はアプリ内のセットアップガイドを参照してください。
