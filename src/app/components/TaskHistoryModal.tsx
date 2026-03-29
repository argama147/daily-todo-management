"use client";

import { useState, useEffect } from "react";
import { 
  getTaskHistory, 
  getOperationDisplayName, 
  canUndoOperation, 
  removeTaskHistoryItem,
  type TaskHistoryItem 
} from "@/lib/taskHistory";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUndo: (historyItem: TaskHistoryItem) => Promise<boolean>;
};

export default function TaskHistoryModal({ isOpen, onClose, onUndo }: Props) {
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [undoing, setUndoing] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setHistory(getTaskHistory());
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleUndo = async (historyItem: TaskHistoryItem) => {
    if (!canUndoOperation(historyItem)) {
      setErrorMessage("この操作はUndoできません");
      return;
    }

    setUndoing(prev => new Set(prev).add(historyItem.id));
    setErrorMessage(null);

    try {
      const success = await onUndo(historyItem);
      
      if (success) {
        // Undo成功時は該当履歴アイテムを削除
        removeTaskHistoryItem(historyItem.id);
        setHistory(getTaskHistory());
      } else {
        setErrorMessage("Undo操作に失敗しました。タスクの状態を確認してください。");
      }
    } catch (error) {
      console.error("Undo operation failed:", error);
      setErrorMessage("Undo操作中にエラーが発生しました。");
    } finally {
      setUndoing(prev => {
        const newSet = new Set(prev);
        newSet.delete(historyItem.id);
        return newSet;
      });
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "たった今";
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getOperationColor = (operation: string): string => {
    switch (operation) {
      case "create":
        return "text-green-600 bg-green-50";
      case "complete":
        return "text-blue-600 bg-blue-50";
      case "uncomplete":
        return "text-yellow-600 bg-yellow-50";
      case "edit":
        return "text-purple-600 bg-purple-50";
      case "delete":
        return "text-red-600 bg-red-50";
      case "changeDue":
        return "text-orange-600 bg-orange-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">操作履歴</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-600">{errorMessage}</p>
            <button
              onClick={() => setErrorMessage(null)}
              className="mt-2 text-sm text-red-500 hover:text-red-700 underline"
            >
              閉じる
            </button>
          </div>
        )}

        <div className="overflow-y-auto max-h-96 p-4">
          {history.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500">まだ操作履歴がありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getOperationColor(item.operation)}`}>
                        {getOperationDisplayName(item.operation)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mb-1">
                      {item.taskTitle}
                    </p>
                    {item.previousState && item.currentState && (
                      <div className="text-xs text-gray-500">
                        {item.operation === "edit" && item.previousState.title !== item.currentState.title && (
                          <p>「{item.previousState.title}」→「{item.currentState.title}」</p>
                        )}
                        {item.operation === "changeDue" && (
                          <p>
                            期限: {item.previousState.due ? new Date(item.previousState.due).toLocaleDateString("ja-JP") : "なし"} 
                            → {item.currentState.due ? new Date(item.currentState.due).toLocaleDateString("ja-JP") : "なし"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canUndoOperation(item) ? (
                      <button
                        onClick={() => handleUndo(item)}
                        disabled={undoing.has(item.id)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {undoing.has(item.id) ? "実行中..." : "Undo"}
                      </button>
                    ) : (
                      <span className="px-3 py-1 text-sm bg-gray-100 text-gray-400 rounded cursor-not-allowed">
                        Undo不可
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4">
          <p className="text-xs text-gray-500 text-center">
            最新20件の操作履歴を表示しています
          </p>
        </div>
      </div>
    </div>
  );
}