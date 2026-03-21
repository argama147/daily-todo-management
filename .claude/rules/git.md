# Git / GitHub ルール — todo プロジェクト固有

## PR 作成時のルール

- Assignees に接続中の GitHub アカウント（`argama147`）を必ず設定すること
  ```bash
  gh pr create --assignee argama147 ...
  ```

---

## 作業フロー

**原則として、仕様Issue → 実装PRの順で進める。**

1. 仕様Issue（テンプレート: `spec.md`）を作成・クローズしてから実装に着手する
2. 実装PR（テンプレート: `impl.md`）には必ず元の仕様IssueへのリンクをCloses #xxx で記載する

```bash
# 仕様Issue作成
gh issue create --template spec.md ...

# 実装PR作成
gh pr create --template impl.md ...
```
