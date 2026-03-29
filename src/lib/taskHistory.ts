import { type Task } from "@/lib/tasks";

// 操作の種類を定義
export type TaskOperation = 
  | "create"
  | "complete"
  | "uncomplete"
  | "edit"
  | "delete"
  | "changeDue";

// 操作履歴のアイテム
export interface TaskHistoryItem {
  id: string;                    // 履歴アイテムの一意ID
  timestamp: number;             // 操作時刻（タイムスタンプ）
  operation: TaskOperation;      // 操作の種類
  taskId: string;               // 対象のタスクID
  taskTitle: string;            // 操作時点のタスクタイトル
  previousState?: Partial<Task>; // 操作前のタスクの状態
  currentState?: Partial<Task>;  // 操作後のタスクの状態
}

// Cookie関連の定数
const HISTORY_COOKIE_KEY = "task_history";
const MAX_HISTORY_ITEMS = 20;

// Cookieからタスク操作履歴を取得
export function getTaskHistory(): TaskHistoryItem[] {
  if (typeof window === "undefined") return [];
  
  try {
    const cookieValue = document.cookie
      .split("; ")
      .find(row => row.startsWith(`${HISTORY_COOKIE_KEY}=`))
      ?.split("=")[1];
    
    if (!cookieValue) return [];
    
    const decodedValue = decodeURIComponent(cookieValue);
    const history = JSON.parse(decodedValue) as TaskHistoryItem[];
    
    // 新しい順にソート
    return history.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to parse task history from cookie:", error);
    return [];
  }
}

// タスク操作履歴をCookieに保存
export function saveTaskHistory(history: TaskHistoryItem[]): void {
  if (typeof window === "undefined") return;
  
  try {
    // 最新の20件のみ保持
    const limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);
    const jsonValue = JSON.stringify(limitedHistory);
    const encodedValue = encodeURIComponent(jsonValue);
    
    // Cookieの有効期限を30日に設定
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30);
    
    document.cookie = `${HISTORY_COOKIE_KEY}=${encodedValue}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;
  } catch (error) {
    console.error("Failed to save task history to cookie:", error);
  }
}

// 新しい操作をタスク履歴に追加
export function addTaskHistoryItem(
  operation: TaskOperation,
  taskId: string,
  taskTitle: string,
  previousState?: Partial<Task>,
  currentState?: Partial<Task>
): void {
  const currentHistory = getTaskHistory();
  
  const newItem: TaskHistoryItem = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    operation,
    taskId,
    taskTitle,
    previousState,
    currentState,
  };
  
  const updatedHistory = [newItem, ...currentHistory];
  saveTaskHistory(updatedHistory);
}

// 操作の表示名を取得
export function getOperationDisplayName(operation: TaskOperation): string {
  switch (operation) {
    case "create":
      return "タスク作成";
    case "complete":
      return "タスク完了";
    case "uncomplete":
      return "完了取消";
    case "edit":
      return "タスク編集";
    case "delete":
      return "タスク削除";
    case "changeDue":
      return "期限変更";
    default:
      return "不明な操作";
  }
}

// 操作をUndoできるかどうかを判定
export function canUndoOperation(item: TaskHistoryItem): boolean {
  // 削除された操作はUndoできない（タスクが存在しない可能性があるため）
  if (item.operation === "delete") {
    return false;
  }
  
  // 作成操作のUndoは削除になるため、慎重に判断
  // ここでは簡単化のため、作成以外のUndoを許可
  return item.operation !== "create";
}

// 操作履歴から特定のタスクに関連する履歴をクリア
export function clearTaskHistoryForTask(taskId: string): void {
  const currentHistory = getTaskHistory();
  const filteredHistory = currentHistory.filter(item => item.taskId !== taskId);
  saveTaskHistory(filteredHistory);
}

// 操作履歴を完全にクリア
export function clearAllTaskHistory(): void {
  saveTaskHistory([]);
}

// 特定の履歴アイテムを削除
export function removeTaskHistoryItem(historyItemId: string): void {
  const currentHistory = getTaskHistory();
  const filteredHistory = currentHistory.filter(item => item.id !== historyItemId);
  saveTaskHistory(filteredHistory);
}