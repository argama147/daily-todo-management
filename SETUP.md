# 今日のタスク - Google Tasks 連携 Web アプリ

Google Tasks と連携し、今日が期限のタスクを全リストから一覧表示する Next.js アプリ。

## 機能

- Google アカウントで OAuth 2.0 ログイン
- 全タスクリストから今日期限のタスクを抽出して一覧表示
- 各タスクにリスト名バッジを表示
- 丸ボタンでタスクを完了にできる
- 「更新」ボタンで最新状態を再取得

## 技術スタック

| 項目 | 内容 |
|---|---|
| フレームワーク | Next.js 16 (App Router) |
| 認証 | NextAuth.js v5 (beta) + Google OAuth 2.0 |
| API | Google Tasks API v1 (`googleapis`) |
| スタイル | Tailwind CSS |
| 言語 | TypeScript |

## ファイル構成

```
todo/
├── auth.ts                                    # NextAuth 設定（Google OAuth + Tasks スコープ）
├── .env.local                                 # 環境変数（要設定）
└── src/
    ├── app/
    │   ├── layout.tsx                         # SessionProvider を配置
    │   ├── page.tsx                           # メイン UI（タスク一覧・完了ボタン）
    │   └── api/
    │       ├── auth/[...nextauth]/route.ts    # OAuth コールバック
    │       └── tasks/route.ts                 # タスク取得(GET) / 完了更新(PATCH)
    └── types/
        └── next-auth.d.ts                     # Session 型拡張（accessToken）
```

## セットアップ手順

### 1. Google Cloud Console の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **APIとサービス > ライブラリ** で **「Google Tasks API」** を有効化
3. **APIとサービス > 認証情報** で **「OAuth 2.0 クライアント ID」** を作成
   - 種類: **ウェブアプリケーション**
   - 承認済みリダイレクト URI: `http://localhost:3000/api/auth/callback/google`
4. **Google Auth Platform > 対象** でテストユーザーに自分のメールアドレスを追加

### 2. 環境変数の設定

`.env.local` を編集：

```env
GOOGLE_CLIENT_ID=取得したクライアントID
GOOGLE_CLIENT_SECRET=取得したクライアントシークレット
AUTH_SECRET=ランダムな文字列（openssl rand -base64 32 で生成）
NEXTAUTH_URL=http://localhost:3000
```

### 3. 依存パッケージのインストール・起動

```bash
npm install
npm run dev
```

`http://localhost:3000` を開いて「Google でログイン」をクリック。

## 実装のポイント

### タスクの日付フィルタリング

Google Tasks API の `due` フィールドは UTC 午前0時で保存される（例: `2026-03-20T00:00:00.000Z`）。
API の `dueMin`/`dueMax` パラメータはタイムゾーンの関係で期待通りに動作しないことがあるため、全タスクを取得後にサーバー側で日付文字列（`YYYY-MM-DD`）を比較してフィルタリングしている。

```typescript
const todayStr = new Date().toLocaleDateString("sv-SE", {
  timeZone: "Asia/Tokyo",
}); // "2026-03-20" 形式

const taskDate = task.due.slice(0, 10);
if (taskDate === todayStr) { ... }
```

### アクセストークンの受け渡し

NextAuth の JWT コールバックで Google のアクセストークンを保存し、セッション経由で API ルートに渡している。

```typescript
// auth.ts
callbacks: {
  async jwt({ token, account }) {
    if (account) token.accessToken = account.access_token;
    return token;
  },
  async session({ session, token }) {
    session.accessToken = token.accessToken as string;
    return session;
  },
}
```
