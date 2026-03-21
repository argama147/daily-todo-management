# Git / GitHub ルール — todo プロジェクト固有

## PR 作成時のルール

- Assignees に接続中の GitHub アカウント（`argama147`）を必ず設定すること
  ```bash
  gh pr create --assignee argama147 ...
  ```

---

## 作業フロー

**原則として、仕様PR → 実装PRの順で進める。**

1. 仕様PR（テンプレート: `spec.md`）を作成・マージしてから実装に着手する
2. 実装PR（テンプレート: `impl.md`）には必ず元の仕様PRへのリンクを記載する

PRテンプレートは `.github/PULL_REQUEST_TEMPLATE/` に格納されており、PR作成時に `?template=spec.md` または `?template=impl.md` をURLに付与して選択する。

```bash
# 仕様PR作成
gh pr create --template spec.md ...

# 実装PR作成
gh pr create --template impl.md ...
```
