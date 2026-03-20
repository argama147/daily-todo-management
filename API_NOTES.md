# API ノウハウ — google-todo-management

---

## OAuth / 認証

### access_token のリフレッシュ処理は必須

**なぜ気づかなかったか:** 初回ログイン直後はトークンが有効なため、1時間後まで問題が表面化しなかった。
**ルール:** NextAuth で Google OAuth を使う場合、JWT コールバックにリフレッシュ処理を必ずセットで実装する。

```typescript
// auth.ts — jwt コールバックのテンプレート
async jwt({ token, account }) {
  if (account) {
    token.accessToken = account.access_token;
    token.refreshToken = account.refresh_token;
    token.expiresAt = account.expires_at;
  }

  // まだ有効なら返す（60秒の余裕）
  const expiresAt = token.expiresAt as number | undefined;
  if (!expiresAt || Date.now() / 1000 < expiresAt - 60) return token;

  // 期限切れ → リフレッシュ
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + refreshed.expires_in,
    };
  } catch (err) {
    console.error("[auth] Token refresh failed:", err);
    return { ...token, error: "RefreshTokenError" };
  }
}
```

- refresh_token を取得するには `access_type: "offline"` + `prompt: "consent"` が必要
- リフレッシュ失敗時は `error: "RefreshTokenError"` をセットし、クライアントで `signIn()` へリダイレクト

---

## Google Tasks API v1

### 完了タスクの取得には `showCompleted` と `showHidden` の両方が必要

`tasks.list` で完了タスクを取得するには `showCompleted: true` だけでは不十分で、`showHidden: true` も必要。

```typescript
tasksApi.tasks.list({
  tasklist: list.id!,
  maxResults: 100,
  showCompleted: true,
  showHidden: true,   // これがないと完了タスクが返ってこない
})
```

---

### 完了タスクのフィルタリングは `completed` フィールド（タイムスタンプ）で行う

**`due` と `completed` の違い:**

| フィールド | 形式 | 値の意味 | 注意点 |
|---|---|---|---|
| `due` | `"2026-03-21T00:00:00.000Z"` | 期限日（UTC 午前0時固定） | 完了タスクは `due` が空になる場合がある |
| `completed` | `"2026-03-21T10:30:00.000Z"` | 完了した日時（実際の時刻） | `status === "completed"` のタスクのみ存在 |

**今日完了したタスクのフィルタリング:**

```typescript
if (task.status === "completed" && task.completed) {
  // completed は実際の完了時刻なので toLocaleDateString でJST変換して比較
  const completedDate = new Date(task.completed).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
  if (completedDate === todayStr) { /* ... */ }
}
```

- `due` と異なり `completed` は実際のタイムスタンプなので JST 変換が意味を持つ
- 完了タスクは `due` が空 (`undefined`) になる場合があるため `task.due ?? ""` でフォールバックが必要

---

### Google Tasks API v1 は繰り返し情報を返さない

`recurrence`・`repeat` フィールドは存在しない。`links` も空配列。Google Calendar UI の ↺ アイコンは Tasks API 経由では取得不可。

---

## NextAuth v5 (beta)

- `AUTH_SECRET` 未設定だとセッションが null になる
- `access_token` は `jwt` → `session` コールバック経由で `session.accessToken` に渡す
- API Route でのセッション取得は `await auth()` を使う（`getServerSession` は v4 の書き方）

---

## Google Cloud Console セットアップ

### API 有効化を忘れやすい

Cloud Console でプロジェクトを作った後、使いたい API（Tasks, Calendar 等）を個別に有効化しないと 403 になる。
→ セットアップ時に必ず確認する。

### Google OAuth セットアップチェックリスト

- [ ] Google Cloud Console で対象 API を有効化
- [ ] OAuth 同意画面でテストユーザーに自分のメールを追加（未審査アプリは必須）
- [ ] リダイレクト URI に `http://localhost:3000/api/auth/callback/google` を追加
- [ ] `.env.local` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `AUTH_SECRET` を設定
