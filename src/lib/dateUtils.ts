/** 今日の日付を JST で YYYY-MM-DD 形式で返す */
export function getTodayJST(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/** メモの最初の行を返す（空の場合は空文字） */
export function getFirstLineOfNotes(notes?: string): string {
  if (!notes || notes.trim() === "") return "";
  return notes.trim().split(/\r?\n/)[0];
}

/** ISO 日付文字列に時刻が含まれているかを返す */
export function hasTime(dueDateString: string): boolean {
  if (!dueDateString) return false;
  const timePart = dueDateString.split("T")[1];
  if (!timePart) return false;
  return !timePart.startsWith("00:00:00");
}

/** 日付（と時刻）を ja-JP ロケールでフォーマットする */
export function formatDateTime(dueDateString: string, showTime = false): string {
  if (!dueDateString) return "";
  const date = new Date(dueDateString);
  const dateStr = date.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  if (showTime && hasTime(dueDateString)) {
    const timeStr = date.toLocaleTimeString("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr}`;
  }
  return dateStr;
}
