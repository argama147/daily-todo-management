# API ノウハウ — google-todo-management

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
