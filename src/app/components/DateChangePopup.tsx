"use client";

import { useEffect } from "react";

interface DateChangePopupProps {
  isOpen: boolean;
  onConfirm: () => void;
  isUpdating?: boolean;
}

export default function DateChangePopup({ isOpen, onConfirm, isUpdating = false }: DateChangePopupProps) {
  // ESCキーでの閉じるを無効化
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
      onClick={(e) => e.stopPropagation()} // クリックイベントの伝播を防ぐ
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center">
          {/* アイコン */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
            <svg 
              className="h-6 w-6 text-blue-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>

          {/* タイトルとメッセージ */}
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            日付が変更されました
          </h3>
          
          {isUpdating ? (
            <div className="text-sm text-gray-600 mb-6">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>更新中...</span>
              </div>
              <p className="mt-2">しばらくお待ちください</p>
            </div>
          ) : (
            <div className="text-sm text-gray-600 mb-6">
              <p>タスクリストを最新の状態に更新します。</p>
              <p className="mt-2 text-orange-600">
                ※ 編集中の操作はキャンセルされます
              </p>
            </div>
          )}

          {/* ボタン */}
          {!isUpdating && (
            <div className="flex justify-center">
              <button
                onClick={onConfirm}
                className="inline-flex justify-center px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                OK
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}