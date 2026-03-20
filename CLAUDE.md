@AGENTS.md

## Git / GitHub ルール

### コミット・push・PR 作成前の確認

- `git push` を実行する前に、必ずユーザーに確認を取ること
- PR を作成する前に、必ずユーザーに確認を取ること

### PR 作成時のルール

- Assignees に接続中の GitHub アカウント（`argama147`）を必ず設定すること
  ```
  gh pr create --assignee argama147 ...
  ```

### ブランチ命名規則

| ブランチ種別 | 命名規則 | 例 |
|---|---|---|
| 機能追加 | `feature/<対応名>` | `feature/add-task-filter` |
| ドキュメント | `docs/<対応名>` | `docs/update-readme` |
| バグ修正 | `fix/<対応名>` | `fix/timezone-issue` |
