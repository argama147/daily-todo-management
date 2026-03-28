"use client";

import { useState, useRef, useEffect } from "react";
import type { Task } from "@/lib/tasks";

type TaskDetailProps = {
  task: Task;
  isVisible: boolean;
  position?: { x: number; y: number };
  onClose: () => void;
  isMobile?: boolean;
};

// URLパターンを検出する正規表現
const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

// テキスト内のURLをリンクに変換する関数
const renderTextWithLinks = (text: string, isMobile: boolean = false) => {
  if (!text) return text;

  const parts = text.split(URL_PATTERN);
  return parts.map((part, index) => {
    if (part.match(URL_PATTERN)) {
      return (
        <a
          key={index}
          href={part}
          target={isMobile ? "_self" : "_blank"}
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline break-all"
          onClick={(e) => {
            e.stopPropagation();
            if (isMobile) {
              // モバイルではブラウザで開く
              window.open(part, '_blank');
              e.preventDefault();
            }
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function TaskDetail({ task, isVisible, position, onClose, isMobile = false }: TaskDetailProps) {
  const [showDetail, setShowDetail] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && task.notes) {
      setShowDetail(true);
    } else {
      setShowDetail(false);
    }
  }, [isVisible, task.notes]);

  // クリック外しで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (detailRef.current && !detailRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (showDetail) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetail, onClose]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (showDetail) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showDetail, onClose]);

  if (!task.notes || !showDetail) {
    return null;
  }

  if (isMobile) {
    // モバイル版：ダイアログ表示
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
        <div
          ref={detailRef}
          className="bg-white rounded-lg shadow-xl max-w-sm w-full max-h-96 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 truncate">タスクの詳細</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="閉じる"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 overflow-y-auto max-h-64">
            <h4 className="font-medium text-gray-800 mb-2 break-words">{task.title}</h4>
            <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
              {renderTextWithLinks(task.notes, true)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PC版：吹き出し表示
  const tooltipStyle: React.CSSProperties = position ? {
    position: 'absolute',
    left: position.x + 10,
    top: position.y - 10,
    zIndex: 50,
  } : {
    position: 'relative',
    zIndex: 50,
  };

  return (
    <div
      ref={detailRef}
      style={tooltipStyle}
      className="bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-xs w-80 animate-fadeIn"
    >
      {/* 矢印 */}
      <div className="absolute left-[-8px] top-4 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white"></div>
      <div className="absolute left-[-9px] top-4 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-gray-300"></div>
      
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-gray-800 text-sm break-words flex-1 mr-2">{task.title}</h4>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
          aria-label="閉じる"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
        {renderTextWithLinks(task.notes)}
      </div>
    </div>
  );
}