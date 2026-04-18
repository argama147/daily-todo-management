"use client";

import { useState, useEffect } from "react";
import { getSettings, saveSettings, createTaskFilterSet, getActiveFilterSet, type AppSettings, type TaskFilterSet } from "@/lib/settings";
import { buildSettingsShareUrl } from "@/lib/settingsQR";
import QRCodeModal from "./QRCodeModal";
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
      tomorrow: true,
      withinWeek: true,
      withinMonth: true,
      noDeadline: true,
    },
    visibleCategories: {},
    taskFilterSets: [],
    selectedFilterSetId: 'default',
  });
  const [newFilterSetName, setNewFilterSetName] = useState('');
  const [showNewFilterSetForm, setShowNewFilterSetForm] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
    }
  }, [isOpen]);

  const handleSave = () => {
    const settingsToSave = {
      ...settings,
      taskFilterSets: settings.taskFilterSets.map(set => ({ ...set, name: set.name.trim() })),
    };
    saveSettings(settingsToSave);
    onClose();
  };

  const handleOpenQR = () => {
    setQrUrl(buildSettingsShareUrl(settings));
    setShowQRCode(true);
  };

  const handleCancel = () => {
    setShowNewFilterSetForm(false);
    setNewFilterSetName('');
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

  const handleToggleAllLists = (turnOn: boolean) => {
    setSettings(prev => ({
      ...prev,
      visibleLists: {
        expired: turnOn,
        today: turnOn,
        completed: turnOn,
        tomorrow: turnOn,
        withinWeek: turnOn,
        withinMonth: turnOn,
        noDeadline: turnOn,
      },
    }));
  };

  // 全てのリストがONかどうかをチェック
  const areAllListsOn = () => {
    return Object.values(settings.visibleLists).every(value => value === true);
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

  const handleToggleFilterSetCategory = (filterSetId: string, categoryKey: string) => {
    setSettings(prev => ({
      ...prev,
      taskFilterSets: prev.taskFilterSets.map(set =>
        set.id === filterSetId
          ? {
              ...set,
              categories: {
                ...set.categories,
                [categoryKey]: !set.categories[categoryKey],
              },
            }
          : set
      ),
    }));
  };

  const handleToggleAllFilterSetCategories = (filterSetId: string, turnOn: boolean) => {
    setSettings(prev => ({
      ...prev,
      taskFilterSets: prev.taskFilterSets.map(set =>
        set.id === filterSetId
          ? {
              ...set,
              categories: Object.keys(set.categories).reduce((acc, key) => {
                acc[key] = turnOn;
                return acc;
              }, {} as Record<string, boolean>),
            }
          : set
      ),
    }));
  };

  // フィルターセットの全カテゴリーがONかどうかをチェック
  const areAllFilterSetCategoriesOn = (filterSet: TaskFilterSet) => {
    const categoryKeys = Object.keys(filterSet.categories);
    return categoryKeys.length > 0 && categoryKeys.every(key => filterSet.categories[key] !== false);
  };

  const handleAddFilterSet = () => {
    if (!newFilterSetName.trim()) return;

    // 利用可能なカテゴリー一覧から全て有効にした状態で新しいセットを作成
    const allCategories: Record<string, boolean> = {};
    availableCategories.forEach(category => {
      allCategories[category] = true;
    });

    const newFilterSet = createTaskFilterSet(newFilterSetName.trim(), allCategories);
    setSettings(prev => ({
      ...prev,
      taskFilterSets: [...prev.taskFilterSets, newFilterSet],
    }));
    
    setNewFilterSetName('');
    setShowNewFilterSetForm(false);
  };

  const handleDeleteFilterSet = (filterSetId: string) => {
    setSettings(prev => ({
      ...prev,
      taskFilterSets: prev.taskFilterSets.filter(set => set.id !== filterSetId),
      selectedFilterSetId: prev.selectedFilterSetId === filterSetId 
        ? (prev.taskFilterSets.find(set => set.isDefault)?.id || prev.taskFilterSets[0]?.id || 'default')
        : prev.selectedFilterSetId,
    }));
  };

  const handleUpdateFilterSetName = (filterSetId: string, newName: string) => {
    if (newName.length > 10) return;

    setSettings(prev => ({
      ...prev,
      taskFilterSets: prev.taskFilterSets.map(set =>
        set.id === filterSetId
          ? { ...set, name: newName }
          : set
      ),
    }));
  };

  // 利用可能なカテゴリー一覧を取得
  const availableCategories = Array.from(
    new Set(allTasks.map(task => task.listTitle).filter(Boolean))
  ).sort();

  if (!isOpen) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">表示するリスト</h3>
              <button
                onClick={() => {
                  const allOn = areAllListsOn();
                  handleToggleAllLists(!allOn);
                }}
                className="text-xs px-2 py-1 border border-blue-300 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50"
              >
                {areAllListsOn() ? '全てチェックOFF' : '全てチェックON'}
              </button>
            </div>
            <div className="space-y-3">
              {[
                { key: "expired" as const, label: "期限切れタスク" },
                { key: "today" as const, label: "本日の未完了タスク" },
                { key: "completed" as const, label: "完了したタスク" },
                { key: "tomorrow" as const, label: "明日のタスク" },
                { key: "withinWeek" as const, label: "一週間以内のタスク" },
                { key: "withinMonth" as const, label: "一ヶ月以内のタスク" },
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

          {/* フィルターセット管理 */}
          {availableCategories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">表示するタスクの種別</h3>
              
              {/* 既存のフィルターセット一覧 */}
              <div className="space-y-4">
                {settings.taskFilterSets.map((filterSet) => (
                  <div key={filterSet.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <input
                        type="text"
                        value={filterSet.name}
                        onChange={(e) => handleUpdateFilterSetName(filterSet.id, e.target.value)}
                        maxLength={10}
                        className="text-sm font-medium text-gray-700 border border-gray-300 rounded px-2 py-1 flex-1 mr-2"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const allOn = areAllFilterSetCategoriesOn(filterSet);
                            handleToggleAllFilterSetCategories(filterSet.id, !allOn);
                          }}
                          className="text-xs px-2 py-1 border border-blue-300 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          {areAllFilterSetCategoriesOn(filterSet) ? '全てチェックOFF' : '全てチェックON'}
                        </button>
                        {!filterSet.isDefault && (
                          <button
                            onClick={() => handleDeleteFilterSet(filterSet.id)}
                            className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                          >
                            削除
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {availableCategories.map((category) => (
                        <div key={category} className="flex items-center">
                          <input
                            type="checkbox"
                            id={`filter-${filterSet.id}-${category}`}
                            checked={filterSet.categories[category] !== false}
                            onChange={() => handleToggleFilterSetCategory(filterSet.id, category)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <label htmlFor={`filter-${filterSet.id}-${category}`} className="ml-2 text-xs text-gray-600">
                            {category}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                
                {/* 新しいフィルターセット追加フォーム */}
                {showNewFilterSetForm ? (
                  <div className="border border-gray-300 border-dashed rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="セット名（10文字まで）"
                        value={newFilterSetName}
                        onChange={(e) => setNewFilterSetName(e.target.value)}
                        maxLength={10}
                        className="text-sm text-gray-900 border border-gray-300 rounded px-2 py-1 flex-1 placeholder:text-gray-400"
                        autoFocus
                      />
                      <button
                        onClick={handleAddFilterSet}
                        disabled={!newFilterSetName.trim()}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        追加
                      </button>
                      <button
                        onClick={() => {
                          setShowNewFilterSetForm(false);
                          setNewFilterSetName('');
                        }}
                        className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 border border-gray-300 rounded"
                      >
                        キャンセル
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">新しいセットは全てのカテゴリーがチェック済みの状態で作成されます</p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewFilterSetForm(true)}
                    className="w-full border border-gray-300 border-dashed rounded-lg p-3 text-sm text-gray-600 hover:text-gray-800 hover:border-gray-400"
                  >
                    + 新しいフィルターセットを追加
                  </button>
                )}
              </div>
            </div>
          )}

          {/* デバイス間設定同期 */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">デバイス間設定同期</h3>
            <button
              onClick={handleOpenQR}
              className="w-full border border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50"
            >
              QRコードで別のデバイスと同期
            </button>
            <p className="text-xs text-gray-400 mt-1">現在の設定をQRコードで別のデバイスに送れます</p>
          </div>

          {/* このアプリについて */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">このアプリについて</h3>
            <div className="space-y-2">
              <a
                href="/help"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                ヘルプ・使い方
              </a>
            </div>
          </div>

        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={settings.taskFilterSets.some(s => !s.name.trim())}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存
          </button>
        </div>
      </div>
    </div>
    <QRCodeModal isOpen={showQRCode} url={qrUrl} onClose={() => setShowQRCode(false)} />
    </>
  );
}