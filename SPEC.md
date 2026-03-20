# アプリ仕様書

## 概要

**「今日のタスク」** — Google Tasks の全リストから今日期限のタスクを抽出し、1画面に集約表示する Web アプリ。

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 16 (App Router) |
| 認証 | NextAuth.js v5 (beta) + Google OAuth 2.0 |
| API連携 | Google Tasks API v1 (`googleapis`) |
| スタイル | Tailwind CSS |
| 言語 | TypeScript |
| セッション | JWT (DBなし) |

---

## 機能一覧

| 機能 | 詳細 |
|------|------|
| Googleログイン | OAuth 2.0 でログイン/ログアウト |
| タスク一覧表示 | 全タスクリストから今日期限のもの（未完了）を抽出して表示 |
| リスト名バッジ | 各タスクにどのリストか表示 |
| タスク完了 | 丸ボタンをクリックで `completed` に更新、一覧から除去 |
| 手動更新 | 「更新」ボタンで最新状態を再取得 |

---

## 画面遷移

```
未ログイン        → ログインボタン画面
セッション読込中  → 「読み込み中...」
ログイン済み      → タスク一覧 or「今日のタスクはありません」
```

---

## API エンドポイント

| メソッド | パス | 処理 |
|----------|------|------|
| `GET` | `/api/tasks` | 全リストから今日(JST)期限の未完了タスクを返す |
| `PATCH` | `/api/tasks` | `{ taskId, listId }` を受け取り `status: completed` に更新 |
| `GET/POST` | `/api/auth/[...nextauth]` | OAuth コールバック処理 |

---

## 認証フロー

1. Googleログイン → OAuth 2.0 認証
2. スコープ: `openid email profile tasks`（読み書き）
3. `access_token` / `refresh_token` を JWT に保存 → Cookie に暗号化保存
4. API ルートで `auth()` を呼んで `session.accessToken` を取得

---

## 主要な設計判断

**タイムゾーン対応**: Google Tasks の `due` は UTC 午前0時固定のため、API の `dueMin/dueMax` は使わず全タスクを取得後にサーバー側で日付文字列(`YYYY-MM-DD`)比較してフィルタリング。

**セキュリティ**: `access_token` はサーバーサイド(Route Handler)のみで使用し、フロントに露出しない。

**状態管理**: `useState` のみで完結（外部状態管理ライブラリ不使用）。

---

## ファイル構成

```
todo/
├── auth.ts                                   # NextAuth設定（スコープ・JWTコールバック）
├── .env.local                                # 環境変数（GOOGLE_CLIENT_ID等）
└── src/
    ├── app/
    │   ├── layout.tsx                        # SessionProvider配置
    │   ├── page.tsx                          # メインUI（Client Component）
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts   # OAuth処理
    │       └── tasks/route.ts                # タスク取得・完了更新
    └── types/
        └── next-auth.d.ts                    # Session型拡張
```
