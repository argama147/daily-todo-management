# 技術メモ — todo プロジェクト（Next.js）固有

---

## Next.js / フロントエンド

### App Router での API Route エラーハンドリング

- `try/catch` で必ず `console.error` する（サーバーログが唯一の手がかりになる）
- 開発中は `detail` フィールドで詳細をクライアントに返す（本番では除外）

```typescript
// サーバー: 開発環境限定でdetailを返す
catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json(
    { error: "Failed", detail: process.env.NODE_ENV === "development" ? message : undefined },
    { status: 500 }
  );
}

// クライアント: detailを優先表示
if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.detail ?? "エラーが発生しました");
}
```
