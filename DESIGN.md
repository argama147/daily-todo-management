# アプリ設計ドキュメント

## 概要

Google Tasks の全リストから今日期限のタスクを抽出し、1画面に集約表示する Web アプリ。

---

## アーキテクチャ

```
ブラウザ (Next.js Client Component)
    │
    │  useSession() → セッション確認
    │  fetch("/api/tasks") → タスク取得
    │
    ▼
Next.js サーバー (App Router / Route Handler)
    │
    ├── /api/auth/[...nextauth]  ← NextAuth が OAuth フローを処理
    └── /api/tasks               ← Google Tasks API を呼び出してタスクを返す
            │
            ▼
    Google Tasks API v1
```

---

## 認証フロー

```
1. ユーザーが「Google でログイン」をクリック
        ↓
2. NextAuth が Google OAuth 2.0 の認証ページへリダイレクト
   スコープ: openid / email / profile / tasks (読み書き)
        ↓
3. ユーザーが Google アカウントで認証・権限を許可
        ↓
4. Google が /api/auth/callback/google にリダイレクト
        ↓
5. NextAuth の jwt コールバックが access_token をJWTに保存
        ↓
6. JWT が暗号化されてブラウザの Cookie に保存
        ↓
7. 以降のリクエストで Cookie → auth() → session.accessToken として利用可能
```

---

## データフロー

### タスク取得 (GET /api/tasks)

```
クライアント
  └─ fetch("/api/tasks")
        ↓
Route Handler (tasks/route.ts)
  ├─ auth() で Cookie からセッション取得 → accessToken を取り出す
  ├─ Google Tasks API: tasklists.list() → 全リスト取得
  └─ 各リストに対して tasks.list() → 全未完了タスク取得
        ↓
サーバー側フィルタリング
  └─ task.due の先頭10文字(YYYY-MM-DD) と今日の日付(JST)を比較
        ↓
レスポンス: { tasks: TaskItem[] }
  └─ id, title, due, status, listId, listTitle
```

### タスク完了 (PATCH /api/tasks)

```
クライアント
  └─ fetch("/api/tasks", { method: "PATCH", body: { taskId, listId } })
        ↓
Route Handler
  └─ tasks.patch({ status: "completed" }) → Google Tasks API を更新
        ↓
クライアント側で該当タスクをリストから除去（楽観的更新なし・確認後に除去）
```

---

## コンポーネント設計

### page.tsx（唯一のページ）

状態管理はすべて React の `useState` で完結。

| state | 型 | 役割 |
|---|---|---|
| `tasks` | `Task[]` | 表示するタスク一覧 |
| `loading` | `boolean` | ローディング表示制御 |
| `completing` | `Set<string>` | 完了処理中のタスクID（ボタン無効化用） |
| `error` | `string \| null` | エラーメッセージ表示 |

**表示の分岐:**

```
未ログイン      → ログインボタン画面
ローディング中  → 「読み込み中...」
タスクあり      → タスクカード一覧
タスクなし      → 「今日期限のタスクはありません」
```

---

## API 設計

### GET /api/tasks

| 項目 | 内容 |
|---|---|
| 認証 | Cookie の JWT セッション必須 |
| 処理 | 全リストの未完了タスクを取得し、今日(JST)が期限のものを返す |
| レスポンス | `{ tasks: TaskItem[] }` |
| エラー | 401 (未認証) / 500 (API エラー) |

### PATCH /api/tasks

| 項目 | 内容 |
|---|---|
| 認証 | Cookie の JWT セッション必須 |
| ボディ | `{ taskId: string, listId: string }` |
| 処理 | 指定タスクを `status: "completed"` に更新 |
| レスポンス | `{ success: true }` |

---

## 主要な設計判断

### なぜサーバー側でフィルタリングするか

Google Tasks API の `dueMin`/`dueMax` パラメータは UTC 基準で動作するが、due 日付は UTC 午前0時（`2026-03-20T00:00:00.000Z`）で保存される。日本時間(JST = UTC+9)では同じ「今日」でも UTC との差異が生じるため、全タスクを取得後にサーバーで `YYYY-MM-DD` の文字列比較を行うことで確実なフィルタリングを実現している。

### なぜ JWT セッションを使うか

データベース不要でシンプルに構成できるため。NextAuth v5 はアダプター未設定の場合デフォルトで JWT セッションになる。Google の access_token を JWT に埋め込み、API ルートで `auth()` を呼ぶだけで取り出せる。

### なぜ Route Handler でAPIを作るか

ブラウザから直接 Google Tasks API を呼ぶと access_token がフロントに露出する。Route Handler 経由にすることで access_token はサーバー側のみに閉じ、CORS 問題も発生しない。
