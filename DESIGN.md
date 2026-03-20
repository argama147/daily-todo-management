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
クライアント側: 楽観的更新（300msアニメーション後に未完了→完了列に移動）
PATCH成功後: GET /api/tasks で同期検証・不一致修正
PATCH失敗時: ロールバック（完了列から除去・未完了列に戻す）＋エラー表示
```

---

## コンポーネント設計

### page.tsx（唯一のページ）

状態管理はすべて React の `useState` で完結。

| state | 型 | 役割 |
|---|---|---|
| `incompleteTasks` | `Task[]` | 未完了タスク一覧（APIから取得） |
| `completedTasks` | `Task[]` | 完了タスク一覧（セッション内状態・操作で追加） |
| `loading` | `boolean` | ローディング表示制御 |
| `completing` | `Set<string>` | フェードアウト中のタスクID |
| `newlyCompleted` | `Set<string>` | スライドイン中のタスクID（アニメーション後に除去） |
| `error` | `string \| null` | エラーメッセージ表示 |

**表示の分岐:**

```
未ログイン      → ログインボタン画面
ローディング中  → 「読み込み中...」
ログイン済み    → 未完了/完了 2カラムレイアウト
タスクなし      → 「今日期限のタスクはありません」（未完了列に表示）
```

---

## 楽観的更新とUI状態管理

### 採用背景

PATCH完了を待ってからUIを更新すると、操作のフィードバックが遅れユーザー体験が悪化する。楽観的更新を採用することで操作直後に画面が反応し、失敗時はロールバックして整合性を保つ。

### completeTask() のフロー

```
ユーザーが ○ をクリック
    ↓
1. completing に task.id を追加
   → 未完了列のカードに fadeOut アニメーション (300ms)

    ↓ (300ms後 setTimeout)

2. incompleteTasks から除去 + completedTasks 先頭に追加
   completing から除去、newlyCompleted に追加
   → 完了列にカードが slideInFromTop アニメーション付きで出現
   → 400ms後に newlyCompleted から除去

    ↓ (PATCHは1と並行して実行中)

3. PATCH結果を処理
   ├─ 成功: GET /api/tasks でサーバー状態を取得し setIncompleteTasks で同期
   └─ 失敗: completedTasks から除去 + incompleteTasks に戻す + エラー表示
```

**ポイント:** PATCHとアニメーション(300ms)は並行実行。PATCHはアニメーション完了を待たない。

### PATCH失敗時のロールバック方針

- `completedTasks` から該当タスクを除去
- `incompleteTasks` の先頭に該当タスクを戻す
- エラーメッセージを表示してユーザーに知らせる

---

## 2カラムレイアウトと完了アニメーション

### レイアウト

```
┌──────────────────────┬──────────────────────────────┐
│ 未完了 (N件)         │ 完了 (N件)                   │
│ ┌──────────────────┐ │ ┌──────────────────────────┐ │
│ │ ○ タスクA       │ │ │ ✓ タスクB (取り消し線)   │ │
│ └──────────────────┘ │ └──────────────────────────┘ │
└──────────────────────┴───────────────────────────────┘
```

- レスポンシブ: モバイル(`md`未満)では縦積み（未完了 → 完了の順）
- 完了列のタスクはチェックマーク付き、テキストに取り消し線、緑背景

### CSSアニメーション (globals.css)

```css
@keyframes slideInFromTop {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes fadeOut {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.95); }
}
```

- `completing.has(task.id)` → `style={{ animation: 'fadeOut 300ms forwards' }}`
- `newlyCompleted.has(task.id)` → `style={{ animation: 'slideInFromTop 300ms ease-out' }}`

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
