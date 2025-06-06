# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

透過背景でテキストを表示するクロスプラットフォームデスクトップアプリケーション。
Electronベースで、ウィンドウフレームなしで純粋にテキストのみを画面上に表示します。

## 開発コマンド

```bash
npm start          # アプリケーションを起動
npm install        # 依存関係をインストール
```

## アーキテクチャ

- **main.js**: Electronのメインプロセス。透過ウィンドウの設定を管理
- **index.html**: レンダラープロセス。テキスト表示のUI
- **package.json**: プロジェクト設定とElectron依存関係

## 主要機能

- 透過背景でのテキスト表示
- ウィンドウフレームなし（frame: false）
- 常に最前面表示（alwaysOnTop: true）
- ドラッグ可能なウィンドウ（-webkit-app-region: drag）