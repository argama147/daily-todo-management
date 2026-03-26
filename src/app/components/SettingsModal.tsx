"use client";

import { useState, useEffect } from "react";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings";
import type { Task } from "@/lib/tasks";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTasks?: Task[];
}

export default function SettingsModal({ isOpen, onClose, allTasks = [] }: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>({
    showUserName: true,
    visibleLists: {
      expired: true,
      today: true,
      completed: true,
      withinWeek: true,
      withinMonth: true,
      longTerm: true,
      noDeadline: true,
    },
    visibleCategories: {},
  });

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
    }
  }, [isOpen]);

  const handleSave = () => {
    saveSettings(settings);
    onClose();
  };

  const handleToggleUserName = () => {
    setSettings(prev => ({
      ...prev,
      showUserName: !prev.showUserName,
    }));
  };

  const handleToggleList = (listKey: keyof AppSettings["visibleLists"]) => {
    setSettings(prev => ({
      ...prev,
      visibleLists: {
        ...prev.visibleLists,
        [listKey]: !prev.visibleLists[listKey],
      },
    }));
  };

  const handleToggleCategory = (categoryKey: string) => {
    setSettings(prev => ({
      ...prev,
      visibleCategories: {
        ...prev.visibleCategories,
        [categoryKey]: !prev.visibleCategories[categoryKey],
      },
    }));
  };

  // 利用可能なカテゴリー一覧を取得
  const availableCategories = Array.from(
    new Set(allTasks.map(task => task.listTitle).filter(Boolean))
  ).sort();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* ユーザー名表示設定 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">表示設定</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">ログイン名を表示</span>
              <button
                onClick={handleToggleUserName}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.showUserName ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.showUserName ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* リスト表示設定 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">表示するリスト</h3>
            <div className="space-y-3">
              {[
                { key: "expired" as const, label: "期限切れタスク" },
                { key: "today" as const, label: "本日の未完了タスク" },
                { key: "completed" as const, label: "完了したタスク" },
                { key: "withinWeek" as const, label: "一週間以内のタスク" },
                { key: "withinMonth" as const, label: "一ヶ月以内のタスク" },
                { key: "longTerm" as const, label: "長期タスク" },
                { key: "noDeadline" as const, label: "期限なしタスク" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    id={key}
                    checked={settings.visibleLists[key]}
                    onChange={() => handleToggleList(key)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor={key} className="ml-2 text-sm text-gray-600">
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* タスクカテゴリー表示設定 */}
          {availableCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">表示するタスクの種別</h3>
              <div className="space-y-3">
                {availableCategories.map((category) => (
                  <div key={category} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`category-${category}`}
                      checked={settings.visibleCategories[category] !== false}
                      onChange={() => handleToggleCategory(category)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor={`category-${category}`} className="ml-2 text-sm text-gray-600">
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}