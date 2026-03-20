@AGENTS.md

## Git / GitHub ルール

### 認証情報・シークレットのコミット禁止

以下のファイル・情報は**絶対にコミット・push しないこと**:

- `.env`, `.env.local`, `.env.*.local` などの環境変数ファイル
- APIキー、OAuth Client Secret、JWT シークレット等の認証情報
- パスワード、アクセストークン、秘密鍵（`.pem`, `.key` 等）

**コミット前の確認手順:**

```bash
git diff --cached  # ステージ済みの差分を必ず確認する
```

上記ファイルが `git status` に現れた場合、`.gitignore` への追加を先に行う。

---

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
