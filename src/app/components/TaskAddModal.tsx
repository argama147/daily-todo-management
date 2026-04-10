"use client";

import { useState, useEffect } from "react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (listId: string, title: string, notes: string, due: string) => Promise<void>;
  taskLists: { id: string; title: string }[];
  filteredTaskLists?: { id: string; title: string }[];
};

export default function TaskAddModal({ isOpen, onClose, onAdd, taskLists, filteredTaskLists }: Props) {
  const [listId, setListId] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [adding, setAdding] = useState(false);

  // モーダルが開かれた時にリセット
  useEffect(() => {
    if (isOpen) {
      const availableLists = filteredTaskLists || taskLists;
      setListId(availableLists.length > 0 ? availableLists[0].id : "");
      setTitle("");
      setNotes("");
      setDueDate("");
      setDueTime("");
      setAdding(false);
    }
  }, [isOpen, taskLists, filteredTaskLists]);

  if (!isOpen) return null;

  const handleAdd = async () => {
    if (!title.trim()) {
      alert("タスク内容を入力してください");
      return;
    }

    if (!listId) {
      alert("タスク種別を選択してください");
      return;
    }

    setAdding(true);
    try {
      // 日付と時刻を組み合わせてISO形式に変換
      let isoDate = "";
      if (dueDate) {
        if (dueTime) {
          isoDate = `${dueDate}T${dueTime}:00.000Z`;
        } else {
          // 時刻が未設定の場合は23:59に設定
          isoDate = `${dueDate}T23:59:00.000Z`;
        }
      }

      await onAdd(listId, title.trim(), notes.trim(), isoDate);
      onClose();
    } catch (e) {
      // エラーハンドリングは親コンポーネントで行う
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">新規タスク追加</h2>
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
          {/* タスク種別（リスト選択） */}
          <div>
            <label htmlFor="task-list" className="block text-sm font-medium text-gray-700 mb-1">
              タスク種別 <span className="text-red-500">*</span>
            </label>
            <select
              id="task-list"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            >
              {(filteredTaskLists || taskLists).map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
          </div>

          {/* タスク内容 */}
          <div>
            <label htmlFor="add-task-title" className="block text-sm font-medium text-gray-700 mb-1">
              タスク内容 <span className="text-red-500">*</span>
            </label>
            <input
              id="add-task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="タスク内容を入力"
            />
          </div>

          {/* 詳細 */}
          <div>
            <label htmlFor="add-task-notes" className="block text-sm font-medium text-gray-700 mb-1">
              詳細
            </label>
            <textarea
              id="add-task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900"
              placeholder="詳細を入力（任意）"
            />
          </div>

          {/* 期限日 */}
          <div>
            <label htmlFor="add-task-due-date" className="block text-sm font-medium text-gray-700 mb-1">
              期限日
            </label>
            <input
              id="add-task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
            <div className="text-xs text-gray-500 mt-1">
              未入力の場合は期限なしとして設定されます
            </div>
          </div>

          {/* 期限時刻 */}
          {dueDate && (
            <div>
              <label htmlFor="add-task-due-time" className="block text-sm font-medium text-gray-700 mb-1">
                期限時刻
              </label>
              <input
                id="add-task-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
              <div className="text-xs text-gray-500 mt-1">
                未入力の場合は23:59に設定されます
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={adding}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleAdd}
            disabled={adding || !title.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? "追加中..." : "追加"}
          </button>
        </div>
      </div>
    </div>
  );
}