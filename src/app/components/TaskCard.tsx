"use client";

import type { Task } from "@/lib/tasks";
import { getTodayJST, getFirstLineOfNotes, hasTime, formatDateTime } from "@/lib/dateUtils";

export type TaskCardVariant =
  | "expired"
  | "today"
  | "tomorrow"
  | "withinWeek"
  | "withinMonth"
  | "noDeadline"
  | "completed";

type VariantStyle = {
  container: string;
  completeBtnBorder: string;
  title: string;
  notes: string;
  listBadge: string;
  dateBadge: string;
  menuBtn: string;
};

const VARIANT_STYLES: Record<TaskCardVariant, VariantStyle> = {
  expired:     { container: "bg-red-50 border-red-200",       completeBtnBorder: "border-red-300",    title: "text-red-800",    notes: "text-red-600",    listBadge: "text-red-500 bg-red-100",      dateBadge: "text-red-600 bg-red-200",      menuBtn: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"     },
  today:       { container: "bg-white border-gray-200",        completeBtnBorder: "border-gray-300",   title: "text-gray-800",   notes: "text-gray-600",   listBadge: "text-gray-400 bg-gray-100",    dateBadge: "text-blue-600 bg-blue-100",    menuBtn: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"     },
  tomorrow:    { container: "bg-orange-50 border-orange-200",  completeBtnBorder: "border-orange-300", title: "text-orange-800", notes: "text-orange-600", listBadge: "text-orange-600 bg-orange-100", dateBadge: "text-orange-600 bg-orange-200", menuBtn: "text-orange-600 hover:text-orange-800 hover:bg-orange-50" },
  withinWeek:  { container: "bg-blue-50 border-blue-200",      completeBtnBorder: "border-blue-300",   title: "text-blue-800",   notes: "text-blue-600",   listBadge: "text-blue-500 bg-blue-100",    dateBadge: "text-blue-600 bg-blue-200",    menuBtn: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"     },
  withinMonth: { container: "bg-orange-50 border-orange-200",  completeBtnBorder: "border-orange-300", title: "text-orange-800", notes: "text-orange-600", listBadge: "text-orange-500 bg-orange-100", dateBadge: "text-orange-600 bg-orange-200", menuBtn: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"    },
  noDeadline:  { container: "bg-gray-50 border-gray-200",      completeBtnBorder: "border-gray-300",   title: "text-gray-800",   notes: "text-gray-600",   listBadge: "text-gray-400 bg-gray-100",    dateBadge: "",                             menuBtn: "text-blue-600 hover:text-blue-800 hover:bg-blue-50"     },
  completed:   { container: "bg-green-50 border-green-200",    completeBtnBorder: "",                  title: "text-gray-500",   notes: "",                listBadge: "text-gray-400 bg-green-100",   dateBadge: "",                             menuBtn: ""                                                       },
};

interface TaskCardProps {
  task: Task;
  variant: TaskCardVariant;
  isCompleting?: boolean;
  isUncompleting?: boolean;
  isNewlyCompleted?: boolean;
  isChangingDue?: boolean;
  isDeleting?: boolean;
  isMenuOpen?: boolean;
  draggable?: boolean;
  onComplete?: () => void;
  onUncomplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDatePickerOpen?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: () => void;
  onTouchMove?: () => void;
  onMenuToggle?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

export default function TaskCard({
  task,
  variant,
  isCompleting = false,
  isUncompleting = false,
  isNewlyCompleted = false,
  isChangingDue = false,
  isDeleting = false,
  isMenuOpen = false,
  draggable = false,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  onDatePickerOpen,
  onClick,
  onTouchStart,
  onTouchEnd,
  onTouchMove,
  onMenuToggle,
  onDragStart,
  onDragEnd,
}: TaskCardProps) {
  const isCompleted = variant === "completed";
  const s = VARIANT_STYLES[variant];

  const containerStyle =
    isCompleting || isUncompleting
      ? { animation: "fadeOut 300ms forwards" }
      : isNewlyCompleted
      ? { animation: "slideInFromTop 300ms ease-out" }
      : undefined;

  const badges = (() => {
    switch (variant) {
      case "expired": {
        const todayStr = getTodayJST();
        const diffDays = Math.ceil(
          (new Date(todayStr).getTime() - new Date(task.due.slice(0, 10)).getTime()) / 86400000
        );
        return (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className={`text-xs ${s.listBadge} rounded px-2 py-0.5`}>{task.listTitle}</span>
            <span className={`text-xs ${s.dateBadge} rounded px-2 py-0.5 font-medium`}>
              期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}({diffDays}日経過)
            </span>
          </div>
        );
      }
      case "today":
        return (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className={`text-xs ${s.listBadge} rounded px-2 py-0.5`}>{task.listTitle}</span>
            {hasTime(task.due) && (
              <span className={`text-xs ${s.dateBadge} rounded px-2 py-0.5 font-medium`}>
                {formatDateTime(task.due, true)}
              </span>
            )}
          </div>
        );
      case "tomorrow":
        return (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className={`text-xs ${s.listBadge} rounded px-2 py-0.5`}>{task.listTitle}</span>
            {task.due && (
              <span className={`text-xs ${s.dateBadge} rounded px-2 py-0.5 font-medium`}>明日</span>
            )}
          </div>
        );
      case "withinWeek":
      case "withinMonth":
        return (
          <div className="mt-1 flex flex-wrap gap-1">
            <span className={`text-xs ${s.listBadge} rounded px-2 py-0.5`}>{task.listTitle}</span>
            {task.due && (
              <span className={`text-xs ${s.dateBadge} rounded px-2 py-0.5 font-medium`}>
                期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </span>
            )}
          </div>
        );
      case "noDeadline":
        return (
          <span className={`inline-block mt-1 text-xs ${s.listBadge} rounded px-2 py-0.5`}>
            {task.listTitle}
          </span>
        );
      case "completed":
        return (
          <span className={`inline-block mt-1 text-xs ${s.listBadge} rounded px-2 py-0.5`}>
            {task.listTitle}
          </span>
        );
    }
  })();

  return (
    <div
      className={`flex items-start gap-3 ${s.container} border rounded-lg px-4 py-3 shadow-sm ${
        isCompleted ? "opacity-80" : draggable ? "cursor-move" : "cursor-pointer"
      }`}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      style={containerStyle}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      {/* 完了 / 未完了ボタン */}
      {isCompleted ? (
        <button
          onClick={(e) => { e.stopPropagation(); onUncomplete?.(); }}
          disabled={isUncompleting}
          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 hover:bg-gray-300 hover:border-2 hover:border-gray-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="未完了にする"
        >
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onComplete?.(); }}
          disabled={isCompleting}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 ${s.completeBtnBorder} hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="完了にする"
        />
      )}

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        <p className={`${isCompleted ? "line-through" : ""} ${s.title} font-medium leading-snug break-words`}>
          {task.title}
        </p>
        {!isCompleted && getFirstLineOfNotes(task.notes) && (
          <p className={`${s.notes} text-sm mt-1 truncate`}>{getFirstLineOfNotes(task.notes)}</p>
        )}
        {badges}
      </div>

      {/* メニュー（完了カードには不要） */}
      {!isCompleted && (
        <div className="flex-shrink-0 ml-2 relative">
          {isMenuOpen ? (
            <div className="absolute right-0 top-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
              >
                編集
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDatePickerOpen?.(e); }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                disabled={isChangingDue}
              >
                期限変更
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-b-lg"
                disabled={isDeleting}
              >
                {isDeleting ? "削除中..." : "削除"}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onMenuToggle?.(); }}
              disabled={isChangingDue || isDeleting}
              className={`w-8 h-8 flex items-center justify-center ${s.menuBtn} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label="メニュー"
            >
              {isChangingDue || isDeleting ? "..." : "︙"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
