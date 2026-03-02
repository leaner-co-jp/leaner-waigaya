---
name: release
description: 機密情報チェック→CHANGELOG生成→バージョンバンプ→コミット→タグ→プッシュのリリース作業を実行。「リリースしたい」「vX.Y.Z をリリース」と言った時に使用
argument-hint: <version>
---

# Leaner Waigaya リリース手順

引数として新バージョン（例: `1.4.0`）を受け取り、以下の手順でリリース作業を行う。

## 手順

### 1. 準備確認

- 引数の `<version>` から `v` プレフィックスを除去して正規化する（例: `v1.4.0` → `1.4.0`）
- `package.json` の現在バージョンを読んで直前タグ（例: `v1.3.0`）を確認する
- ユーザーに確認する：「現在 X.Y.Z → v{version} にリリースします。よろしいですか？」
- `git status` でコミットされていない変更がないか確認する（あれば警告）

### 2. 機密情報チェック（gitleaks）

直前タグからHEADまでの差分を gitleaks でスキャンする：

```bash
gitleaks detect --log-opts="-p v{prevVersion}..HEAD"
```

- **検出あり**: リリースを中断し、該当箇所をユーザーに報告する
- **検出なし**: 「機密情報は検出されませんでした」と報告して次へ進む

### 3. CHANGELOG.md 生成

`git log v{prevVersion}..HEAD --oneline` でコミット一覧を取得し、内容を読んで以下の形式で `CHANGELOG.md` の先頭に追記する（既存の `CHANGELOG.md` がなければ新規作成）：

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- 新機能の説明

### Fixed
- バグ修正の説明

### Changed
- 変更の説明
```

- バージョンバンプ用コミットメッセージ（例: "v1.3.0 リリース"）はChangelog から除外する
- コミットメッセージから内容を推測して適切なカテゴリに分類する

### 4. バージョンバンプ（3ファイル同時更新）

以下の3ファイルのバージョン文字列を更新する：

| ファイル | 更新箇所 |
|----------|----------|
| `package.json` | `"version": "..."` |
| `src-tauri/Cargo.toml` | `version = "..."` |
| `src-tauri/tauri.conf.json` | `"version": "..."` |

### 5. package-lock.json 更新

```bash
npm install --package-lock-only
```

### 6. コミット

```bash
git add CHANGELOG.md package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "v{version} リリース"
```

### 7. タグ作成 & プッシュ

```bash
git tag v{version}
git push origin main
git push origin v{version}
```

### 8. 完了報告

リリース完了後、以下を報告する：
- タグ `v{version}` を作成してプッシュした旨
- GitHub Actions が自動ビルド・リリースを実行している旨
- GitHub のリリースページ URL（リポジトリ: `leaner-co-jp/leaner-waigaya`）
