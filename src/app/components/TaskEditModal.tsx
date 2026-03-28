"use client";

import { useState, useEffect } from "react";
import type { Task } from "@/lib/tasks";

type Props = {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task, title: string, notes: string, due: string) => Promise<void>;
};

export default function TaskEditModal({ task, isOpen, onClose, onSave }: Props) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  // モーダルが開かれた時にタスクの値をセット
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || "");
      setDue(task.due ? task.due.slice(0, 16) : ""); // YYYY-MM-DDTHH:MM形式
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      alert("タスク名を入力してください");
      return;
    }

    setSaving(true);
    try {
      // 日付形式をISO形式に変換
      const isoDate = due ? `${due}:00.000Z` : task.due;
      await onSave(task, title.trim(), notes.trim(), isoDate);
      onClose();
    } catch (e) {
      // エラーハンドリングは親コンポーネントで行う
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">タスク編集</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="閉じる"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* タスク種別（リスト名） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タスク種別
            </label>
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
              {task.listTitle}
            </div>
          </div>

          {/* タスク内容 */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 mb-1">
              タスク内容 <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="タスク内容を入力"
            />
          </div>

          {/* 詳細 */}
          <div>
            <label htmlFor="task-notes" className="block text-sm font-medium text-gray-700 mb-1">
              詳細
            </label>
            <textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
              placeholder="詳細を入力（任意）"
            />
          </div>

          {/* 期限 */}
          <div>
            <label htmlFor="task-due" className="block text-sm font-medium text-gray-700 mb-1">
              期限
            </label>
            <input
              id="task-due"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}