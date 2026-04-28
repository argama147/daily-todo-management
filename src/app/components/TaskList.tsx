"use client";

import { signOut } from "next-auth/react";
import { useState, useCallback, useEffect, useRef } from "react";
import type { Task } from "@/lib/tasks";
import type { User } from "next-auth";
import { getSettings, saveSettings, updateCategoriesFromTasks, getActiveFilterSet, saveSelectedFilterSetId, type AppSettings, type TaskFilterSet } from "@/lib/settings";
import { addTaskHistoryItem, type TaskHistoryItem } from "@/lib/taskHistory";
import { decodeSettingsFromBase64, SETTINGS_QR_PARAM } from "@/lib/settingsQR";
import { getFirstLineOfNotes, hasTime, formatDateTime } from "@/lib/dateUtils";
import SettingsModal from "./SettingsModal";
import TaskCard, { type TaskCardVariant } from "./TaskCard";
import TaskDetail from "./TaskDetail";
import TaskEditModal from "./TaskEditModal";
import TaskAddModal from "./TaskAddModal";
import TaskHistoryModal from "./TaskHistoryModal";
import DateChangeDetector from "./DateChangeDetector";
import DateChangePopup from "./DateChangePopup";

type Props = {
  initialTasks: Task[];
  initialExpiredTasks: Task[];
  initialCompletedTasks?: Task[];
  initialTomorrowTasks?: Task[];
  initialFutureTasks?: {
    withinWeek: Task[];
    withinMonth: Task[];
    noDeadline: Task[];
  };
  user?: User;
};

export default function TaskList({ initialTasks, initialExpiredTasks, initialCompletedTasks, initialTomorrowTasks, initialFutureTasks, user }: Props) {
  const [incompleteTasks, setIncompleteTasks] = useState<Task[]>(initialTasks);
  const [expiredTasks, setExpiredTasks] = useState<Task[]>(initialExpiredTasks);
  const [completedTasks, setCompletedTasks] = useState<Task[]>(initialCompletedTasks ?? []);
  const [tomorrowTasks, setTomorrowTasks] = useState<Task[]>(initialTomorrowTasks ?? []);
  const [futureTasks, setFutureTasks] = useState<{
    withinWeek: Task[];
    withinMonth: Task[];
    noDeadline: Task[];
  }>(initialFutureTasks ?? { withinWeek: [], withinMonth: [], noDeadline: [] });
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [uncompleting, setUncompleting] = useState<Set<string>>(new Set());
  const [newlyCompleted, setNewlyCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  type TabKey = "expired" | "today" | "completed" | "tomorrow" | "withinWeek" | "withinMonth" | "noDeadline";
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [changingDue, setChangingDue] = useState<Set<string>>(new Set());
  const [datePickerTask, setDatePickerTask] = useState<Task | null>(null);
  const [datePickerPos, setDatePickerPos] = useState({ x: 0, y: 0 });
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [showTaskMenu, setShowTaskMenu] = useState<string | null>(null);
  // 同一タスクが複数カラムに表示される場合にメニューが同時に開くのを避けるため、
  // variant（カラム種別）と task.id の複合キーで管理する
  const menuKey = (taskId: string, v: TaskCardVariant) => `${v}:${taskId}`;
  const isTaskMenuOpen = (taskId: string, v: TaskCardVariant) => showTaskMenu === menuKey(taskId, v);
  const toggleTaskMenu = (taskId: string, v: TaskCardVariant) => {
    const k = menuKey(taskId, v);
    setShowTaskMenu((cur) => (cur === k ? null : k));
  };
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [taskLists, setTaskLists] = useState<{ id: string; title: string }[]>([]);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [draggedFrom, setDraggedFrom] = useState<TabKey | null>(null);
  const draggedTaskRef = useRef<Task | null>(null);
  const draggedFromRef = useRef<TabKey | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<TabKey | null>(null);
  // 連続ドロップ時のレース防止:
  //   - taskOpGenerationRef: fetchTasks の世代番号。新しい操作（特に新たなドロップ）が
  //     入った時点で in-flight の GET レスポンスを無効化する
  //   - dragInFlightRef: 進行中のドロップ PATCH 数。バースト中は最後の1回だけ
  //     fetchTasks を撃つようコアレスする
  const taskOpGenerationRef = useRef(0);
  const dragInFlightRef = useRef(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
  const [selectedFilterSetId, setSelectedFilterSetId] = useState<string>('default');
  
  // 日付変更検出関連の状態
  const [showDateChangePopup, setShowDateChangePopup] = useState(false);
  const [isDateChangeUpdating, setIsDateChangeUpdating] = useState(false);
  
  // スワイプ・ドラッグ関連の状態
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // デスクトップドラッグスクロール関連の状態
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [scrollStart, setScrollStart] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  
  // タスク詳細表示関連の状態
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailPosition, setDetailPosition] = useState<{ x: number; y: number } | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  
  // タブの順序定義
  const tabOrder: TabKey[] = ["expired", "today", "tomorrow", "completed", "withinWeek", "withinMonth", "noDeadline"];

  // 設定の読み込み
  useEffect(() => {
    const loadedSettings = getSettings();
    setSettings(loadedSettings);
    setSelectedFilterSetId(loadedSettings.selectedFilterSetId);
  }, []);

  // URLパラメータから設定をインポート（QRコード同期）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(SETTINGS_QR_PARAM);
    if (!encoded) return;

    const imported = decodeSettingsFromBase64(encoded);
    if (!imported) {
      console.warn("QR設定のデコードに失敗しました");
      return;
    }

    saveSettings(imported);
    setSettings(imported);
    setSelectedFilterSetId(imported.selectedFilterSetId);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // タスクカテゴリーの設定を更新
  useEffect(() => {
    const allTasks = [
      ...incompleteTasks,
      ...expiredTasks,
      ...completedTasks,
      ...futureTasks.withinWeek,
      ...futureTasks.withinMonth,
      ...futureTasks.noDeadline,
    ];
    updateCategoriesFromTasks(allTasks);
    setSettings(getSettings());
  }, [incompleteTasks, expiredTasks, completedTasks, futureTasks]);

  // 設定変更時のリフレッシュ
  const refreshSettings = () => {
    setSettings(getSettings());
  };

  // タスクカテゴリーフィルタリング関数
  const filterTasksByCategory = (tasks: Task[]) => {
    return tasks.filter(task => {
      // アクティブなフィルターセットを取得
      const activeFilterSet = getActiveFilterSet(settings);
      
      // フィルターセットが存在し、かつカテゴリー設定がある場合
      if (activeFilterSet && Object.keys(activeFilterSet.categories).length > 0) {
        return activeFilterSet.categories[task.listTitle] !== false;
      }
      
      // フォールバック：従来のvisibleCategories設定を使用
      if (Object.keys(settings.visibleCategories).length === 0) {
        return true;
      }
      return settings.visibleCategories[task.listTitle] !== false;
    });
  };

  // フィルターセット切り替えハンドラー
  const handleFilterSetChange = (filterSetId: string) => {
    setSelectedFilterSetId(filterSetId);
    saveSelectedFilterSetId(filterSetId);
    
    // 設定を再読み込み
    const updatedSettings = getSettings();
    setSettings(updatedSettings);
  };

  // フィルタリングされたタスクリスト
  const filteredIncompleteTasks = filterTasksByCategory(incompleteTasks);
  const filteredExpiredTasks = filterTasksByCategory(expiredTasks);
  const filteredCompletedTasks = filterTasksByCategory(completedTasks);
  const filteredTomorrowTasks = filterTasksByCategory(tomorrowTasks);
  const filteredFutureTasks = {
    withinWeek: filterTasksByCategory(futureTasks.withinWeek),
    withinMonth: filterTasksByCategory(futureTasks.withinMonth),
    noDeadline: filterTasksByCategory(futureTasks.noDeadline),
  };

  // 現在のタブに基づいてフィルタリングされたタスクリストを取得
  const getFilteredTaskListsForCurrentTab = () => {
    const activeFilterSet = getActiveFilterSet(settings);

    // ALLタブ（デフォルト）またはカテゴリー設定がない場合はすべてのタスクリストを返す
    if (activeFilterSet.isDefault || Object.keys(activeFilterSet.categories).length === 0) {
      return taskLists;
    }

    // 現在のフィルターセットでチェックONのカテゴリーのみをフィルタリング
    return taskLists.filter(list => activeFilterSet.categories[list.title] !== false);
  };

  const filteredTaskListsForCurrentTab = getFilteredTaskListsForCurrentTab();

  const fetchTasks = useCallback(async () => {
    // 世代番号: 同時に複数の fetchTasks が in-flight になった場合、
    // または fetchTasks 中に新たなドロップ等が入った場合、
    // 古いレスポンスでローカル状態を上書きしないようガードする
    const gen = ++taskOpGenerationRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks");
      if (gen !== taskOpGenerationRef.current) return; // 古い世代 → 破棄
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "タスクの取得に失敗しました");
      }
      const data = await res.json();
      if (gen !== taskOpGenerationRef.current) return; // 古い世代 → 破棄
      setIncompleteTasks(data.todayTasks ?? []);
      setExpiredTasks(data.expiredTasks ?? []);
      setCompletedTasks(data.completedTasks ?? []);
      setTomorrowTasks(data.tomorrowTasks ?? []);
      if (data.futureTasks) {
        setFutureTasks(data.futureTasks);
      }
    } catch (e) {
      if (gen !== taskOpGenerationRef.current) return; // 古い世代のエラーは握り潰す
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      if (gen === taskOpGenerationRef.current) setLoading(false);
    }
  }, []);

  const completeTask = async (task: Task) => {
    setCompleting((prev) => new Set(prev).add(task.id));

    const patchPromise = fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, listId: task.listId, status: "completed" }),
    });

    setTimeout(() => {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setIncompleteTasks((prev) => prev.filter((t) => t.id !== task.id));
      setExpiredTasks((prev) => prev.filter((t) => t.id !== task.id));
      setTomorrowTasks((prev) => prev.filter((t) => t.id !== task.id));
      setFutureTasks((prev) => ({
        withinWeek: prev.withinWeek.filter((t) => t.id !== task.id),
        withinMonth: prev.withinMonth.filter((t) => t.id !== task.id),
        noDeadline: prev.noDeadline.filter((t) => t.id !== task.id),
      }));
      setCompletedTasks((prev) => {
        if (prev.some((t) => t.id === task.id)) return prev;
        return [task, ...prev];
      });
      setNewlyCompleted((prev) => new Set(prev).add(task.id));

      setTimeout(() => {
        setNewlyCompleted((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }, 400);
    }, 300);

    try {
      const res = await patchPromise;
      if (!res.ok) throw new Error("更新に失敗しました");

      // タスク完了の履歴を記録（PATCH成功直後、sync前に記録）
      addTaskHistoryItem(
        "complete",
        task.id,
        task.title,
        { ...task, status: "needsAction" },
        { ...task, status: "completed" }
      );

      const syncRes = await fetch("/api/tasks");
      if (syncRes.ok) {
        const data = await syncRes.json();
        setIncompleteTasks((data.todayTasks ?? []).filter((t: Task) => t.id !== task.id));
        setExpiredTasks((data.expiredTasks ?? []).filter((t: Task) => t.id !== task.id));
        setTomorrowTasks((data.tomorrowTasks ?? []).filter((t: Task) => t.id !== task.id));
        if (data.futureTasks) {
          setFutureTasks({
            withinWeek: data.futureTasks.withinWeek.filter((t: Task) => t.id !== task.id),
            withinMonth: data.futureTasks.withinMonth.filter((t: Task) => t.id !== task.id),
            noDeadline: data.futureTasks.noDeadline.filter((t: Task) => t.id !== task.id),
          });
        }
        // setTimeoutより先にsyncが完了した場合、completedTasksに未追加の可能性があるため補完
        setCompletedTasks((prev) => {
          if (prev.some((t) => t.id === task.id)) return prev;
          return [task, ...prev];
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
      const isExpired = new Date(task.due).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
      if (isExpired) {
        setExpiredTasks((prev) => [task, ...prev]);
      } else {
        setIncompleteTasks((prev) => [task, ...prev]);
      }
    }
  };

  const uncompleteTask = async (task: Task) => {
    setUncompleting((prev) => new Set(prev).add(task.id));

    const patchPromise = fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, listId: task.listId, status: "needsAction" }),
    });

    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    const today = new Date(todayStr);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    
    const taskDateStr = task.due ? task.due.slice(0, 10) : "";
    const isExpiredTask = taskDateStr !== "" && taskDateStr < todayStr;
    const isTodayTask = taskDateStr === todayStr;
    const isTomorrowTask = taskDateStr === tomorrowStr;
    const isNoDeadlineTask = taskDateStr === "";
    // isFutureTask = !isExpiredTask && !isTodayTask && !isTomorrowTask && !isNoDeadlineTask

    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const addToFutureBucket = (prev: { withinWeek: Task[]; withinMonth: Task[]; noDeadline: Task[] }) => {
      const taskDate = new Date(taskDateStr);
      const add = (list: Task[]) => list.some((t) => t.id === task.id) ? list : [task, ...list];
      if (taskDate > tomorrow && taskDate <= oneWeekFromNow) return { ...prev, withinWeek: add(prev.withinWeek) };
      return { ...prev, withinMonth: add(prev.withinMonth) };
    };

    setTimeout(() => {
      setUncompleting((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));

      // 適切なリストに戻す（syncより先に追加済みなら重複しない）
      if (isExpiredTask) {
        setExpiredTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [task, ...prev]);
      } else if (isTodayTask) {
        setIncompleteTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [task, ...prev]);
      } else if (isTomorrowTask) {
        setTomorrowTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [task, ...prev]);
      } else if (isNoDeadlineTask) {
        setFutureTasks((prev) => ({
          ...prev,
          noDeadline: prev.noDeadline.some((t) => t.id === task.id)
            ? prev.noDeadline
            : [task, ...prev.noDeadline],
        }));
      } else {
        // 未来タスク: 期限に応じたバケットへ
        setFutureTasks(addToFutureBucket);
      }
    }, 300);

    try {
      const res = await patchPromise;
      if (!res.ok) throw new Error("更新に失敗しました");

      // タスク未完了の履歴を記録（PATCH成功直後、sync前に記録）
      addTaskHistoryItem(
        "uncomplete",
        task.id,
        task.title,
        { ...task, status: "completed" },
        { ...task, status: "needsAction" }
      );

      const syncRes = await fetch("/api/tasks");
      if (syncRes.ok) {
        const data = await syncRes.json();
        const serverIncomplete = data.todayTasks ?? [];
        const serverExpired = data.expiredTasks ?? [];
        // setTimeoutより先にsyncが完了した場合: completedTasksから削除 + 適切なリストに補完
        setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
        if (isExpiredTask) {
          setExpiredTasks(
            serverExpired.some((t: Task) => t.id === task.id)
              ? serverExpired
              : [task, ...serverExpired.filter((t: Task) => t.id !== task.id)]
          );
          setIncompleteTasks(serverIncomplete);
        } else if (isTodayTask) {
          setIncompleteTasks(
            serverIncomplete.some((t: Task) => t.id === task.id)
              ? serverIncomplete
              : [task, ...serverIncomplete.filter((t: Task) => t.id !== task.id)]
          );
          setExpiredTasks(serverExpired);
        } else {
          // 未来・期限なしタスク: futureTasks も更新
          setIncompleteTasks(serverIncomplete);
          setExpiredTasks(serverExpired);
          if (data.futureTasks) {
            const sf = data.futureTasks;
            const inServer = [
              ...(sf.withinWeek ?? []),
              ...(sf.withinMonth ?? []),
              ...(sf.noDeadline ?? []),
            ].some((t: Task) => t.id === task.id);
            if (inServer) {
              setFutureTasks(sf);
            } else if (isNoDeadlineTask) {
              setFutureTasks({
                ...sf,
                noDeadline: [task, ...(sf.noDeadline ?? []).filter((t: Task) => t.id !== task.id)],
              });
            } else {
              setFutureTasks(addToFutureBucket({
                withinWeek: (sf.withinWeek ?? []).filter((t: Task) => t.id !== task.id),
                withinMonth: (sf.withinMonth ?? []).filter((t: Task) => t.id !== task.id),
                noDeadline: sf.noDeadline ?? [],
              }));
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      // On error, restore task to completed list and remove from where it was added
      setCompletedTasks((prev) => [task, ...prev]);
      if (isExpiredTask) {
        setExpiredTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else if (isTodayTask) {
        setIncompleteTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setFutureTasks((prev) => ({
          withinWeek: prev.withinWeek.filter((t) => t.id !== task.id),
          withinMonth: prev.withinMonth.filter((t) => t.id !== task.id),
          noDeadline: prev.noDeadline.filter((t) => t.id !== task.id),
        }));
      }
    }
  };

  const openDatePicker = (task: Task, e: React.MouseEvent) => {
    setDatePickerTask(task);
    setShowTaskMenu(null);
    setDatePickerPos({ x: e.clientX, y: e.clientY });
    if (datePickerRef.current) {
      datePickerRef.current.value = task.due ? task.due.slice(0, 10) : new Date().toISOString().split('T')[0];
      setTimeout(() => datePickerRef.current?.showPicker(), 0);
    }
  };

  const changeDueDate = async (task: Task, newDue: string | null) => {
    setChangingDue((prev) => new Set(prev).add(task.id));
    setDatePickerTask(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, listId: task.listId, due: newDue ?? "" }),
      });

      if (!res.ok) throw new Error("期限の変更に失敗しました");

      // 期限変更の履歴を記録（Undo対応）
      addTaskHistoryItem(
        "changeDue",
        task.id,
        task.title,
        { ...task },
        { ...task, due: newDue ?? "" }
      );

      // タスクリストを再取得
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setChangingDue((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  // Undo機能のハンドラ
  const handleUndo = async (historyItem: TaskHistoryItem): Promise<boolean> => {
    try {
      const { operation, taskId, previousState, currentState } = historyItem;
      
      // 現在のタスク状態を取得
      const allTasks = [...incompleteTasks, ...expiredTasks, ...completedTasks, ...futureTasks.withinWeek, ...futureTasks.withinMonth, ...futureTasks.noDeadline];
      const currentTask = allTasks.find(t => t.id === taskId);
      
      if (!currentTask) {
        console.error("Undo対象のタスクが見つかりません:", taskId);
        return false;
      }
      
      // 操作に応じてUndo処理を実行
      switch (operation) {
        case "complete":
          // タスク完了のUndo = タスクを未完了にする
          if (currentTask.status === "completed" && previousState) {
            await uncompleteTask(currentTask);
            return true;
          }
          break;
          
        case "uncomplete":
          // タスク未完了のUndo = タスクを完了にする
          if (currentTask.status === "needsAction" && previousState) {
            await completeTask(currentTask);
            return true;
          }
          break;
          
        case "edit":
          // タスク編集のUndo = 以前の状態に戻す
          if (previousState && previousState.title) {
            // タスク編集APIを呼び出し
            const res = await fetch("/api/tasks", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId: taskId,
                listId: currentTask.listId,
                title: previousState.title,
                notes: previousState.notes || "",
              }),
            });
            
            if (res.ok) {
              // UIの更新
              const updateTask = (task: Task) => 
                task.id === taskId 
                  ? { ...task, title: previousState.title!, notes: previousState.notes || "" }
                  : task;
              
              setIncompleteTasks(prev => prev.map(updateTask));
              setExpiredTasks(prev => prev.map(updateTask));
              setCompletedTasks(prev => prev.map(updateTask));
              setFutureTasks(prev => ({
                withinWeek: prev.withinWeek.map(updateTask),
                withinMonth: prev.withinMonth.map(updateTask),
                noDeadline: prev.noDeadline.map(updateTask),
              }));
              return true;
            }
          }
          break;
          
        case "changeDue":
          // 期限変更のUndo = 以前の期限に戻す
          if (previousState && previousState.due !== undefined) {
            const res = await fetch("/api/tasks", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                taskId: taskId,
                listId: currentTask.listId,
                due: previousState.due,
              }),
            });
            
            if (res.ok) {
              // 期限変更後にタスクリストを再取得
              const syncRes = await fetch("/api/tasks");
              if (syncRes.ok) {
                const data = await syncRes.json();
                setIncompleteTasks(data.todayTasks || []);
                setExpiredTasks(data.expiredTasks || []);
                setCompletedTasks(data.completedTasks || []);
                if (data.futureTasks) {
                  setFutureTasks(data.futureTasks);
                }
                return true;
              }
            }
          }
          break;
          
        default:
          console.error("サポートされていないUndo操作:", operation);
          return false;
      }
      
      return false;
    } catch (error) {
      console.error("Undo操作中にエラーが発生:", error);
      return false;
    }
  };

  const deleteTask = async (task: Task) => {
    setShowTaskMenu(null);

    // 楽観的削除: 全カラムから即座に除去
    setIncompleteTasks((prev) => prev.filter((t) => t.id !== task.id));
    setExpiredTasks((prev) => prev.filter((t) => t.id !== task.id));
    setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
    setTomorrowTasks((prev) => prev.filter((t) => t.id !== task.id));
    setFutureTasks((prev) => ({
      withinWeek: prev.withinWeek.filter((t) => t.id !== task.id),
      withinMonth: prev.withinMonth.filter((t) => t.id !== task.id),
      noDeadline: prev.noDeadline.filter((t) => t.id !== task.id),
    }));

    try {
      const res = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, listId: task.listId }),
      });

      if (!res.ok) throw new Error("タスクの削除に失敗しました");

      // 削除の履歴を記録（PATCH成功直後、sync前に記録）
      addTaskHistoryItem(
        "delete",
        task.id,
        task.title,
        task,
        undefined
      );

      // バックグラウンドでサーバー同期（モーダルは既に閉じている）
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      // 失敗時は再取得して正しい状態に戻す
      fetchTasks();
    }
  };

  const updateTask = async (task: Task, title: string, notes: string, due: string, newListId?: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          taskId: task.id, 
          listId: task.listId, 
          title: title,
          notes: notes,
          due: due,
          newListId: newListId
        }),
      });

      if (!res.ok) throw new Error("タスクの更新に失敗しました");

      // タスクの更新履歴を記録
      const hasContentChange = task.title !== title || task.notes !== notes;
      const hasDueChange = task.due !== due;
      
      if (hasContentChange) {
        addTaskHistoryItem(
          "edit",
          task.id,
          title, // 新しいタイトルを使用
          { ...task }, // 変更前の状態
          { ...task, title, notes } // 変更後の状態
        );
      }
      
      if (hasDueChange) {
        addTaskHistoryItem(
          "changeDue",
          task.id,
          task.title,
          { ...task }, // 変更前の状態
          { ...task, due } // 変更後の状態
        );
      }

      // タスクリストを再取得
      await fetchTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      throw e;
    }
  };

  const addTask = async (listId: string, title: string, notes: string, due: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          listId: listId, 
          title: title,
          notes: notes,
          due: due
        }),
      });

      if (!res.ok) throw new Error("タスクの作成に失敗しました");

      // タスクリストを再取得
      await fetchTasks();
      
      // タスク作成の履歴を記録（作成されたタスクIDを取得するため、APIから新しいタスク情報を取得）
      const newTaskRes = await fetch("/api/tasks");
      if (newTaskRes.ok) {
        const data = await newTaskRes.json();
        const allNewTasks = [...(data.todayTasks || []), ...(data.expiredTasks || []), ...(data.futureTasks?.withinWeek || []), ...(data.futureTasks?.withinMonth || []), ...(data.futureTasks?.noDeadline || [])];
        const createdTask = allNewTasks.find(t => t.title === title && t.listId === listId);
        
        if (createdTask) {
          addTaskHistoryItem(
            "create",
            createdTask.id,
            createdTask.title,
            undefined,
            createdTask
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      throw e;
    }
  };

  // タスクリスト取得
  const fetchTaskLists = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/lists");
      if (!res.ok) throw new Error("タスクリストの取得に失敗しました");
      
      const data = await res.json();
      setTaskLists(data.lists || []);
    } catch (e) {
      console.error("Error fetching task lists:", e);
    }
  }, []);

  // 初回読み込み時にタスクリストも取得
  useEffect(() => {
    fetchTaskLists();
  }, [fetchTaskLists]);

  // 編集中の全状態をクリアする関数
  const clearAllEditingStates = useCallback(() => {
    setEditingTask(null);
    setShowAddTaskModal(false);
    setShowSettings(false);
    setShowHistoryModal(false);
    setShowTaskMenu(null);
    setDatePickerTask(null);
    setShowLogoutConfirm(false);
    setSelectedTask(null);
    setDetailPosition(null);
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsSwiping(false);
    setIsDragging(false);
    setTouchStart(null);
    setTouchEnd(null);
    setDragStart(null);
    setDraggedTask(null);
    setDraggedFrom(null);
    setDragOverTarget(null);
  }, [longPressTimer]);

  // 日付変更検出時の処理
  const handleDateChange = useCallback(() => {
    // まず編集状態をクリア
    clearAllEditingStates();
    // ポップアップ表示
    setShowDateChangePopup(true);
  }, [clearAllEditingStates]);

  // 日付変更ポップアップのOK処理
  const handleDateChangeConfirm = useCallback(async () => {
    setIsDateChangeUpdating(true);
    try {
      // タスクリストとタスクリスト一覧を更新
      await Promise.all([fetchTasks(), fetchTaskLists()]);
    } catch (error) {
      console.error("日付変更時の更新エラー:", error);
      setError("更新中にエラーが発生しました");
    } finally {
      setIsDateChangeUpdating(false);
      setShowDateChangePopup(false);
    }
  }, [fetchTasks, fetchTaskLists]);

  // ドラッグ&ドロップ — 移動可否マトリクス
  const ALLOWED_DROPS: Partial<Record<TabKey, TabKey[]>> = {
    expired:     ["today", "completed", "tomorrow", "withinWeek", "withinMonth", "noDeadline"],
    today:       ["completed", "tomorrow", "withinWeek", "withinMonth", "noDeadline"],
    tomorrow:    ["today", "completed", "withinWeek", "withinMonth", "noDeadline"],
    withinWeek:  ["today", "tomorrow", "completed", "withinMonth", "noDeadline"],
    withinMonth: ["today", "tomorrow", "completed", "withinWeek", "noDeadline"],
    noDeadline:  ["today", "tomorrow", "completed", "withinWeek", "withinMonth"],
    // completed: なし（ドラッグ移動不可）
  };

  // 移動先カテゴリに対応する期限日（ISO文字列 or null=クリア）
  const getDueDateForCategory = (target: TabKey): string | null => {
    if (target === "noDeadline") return null;
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    const d = new Date(todayStr + "T00:00:00.000Z");
    const offsetMap: Partial<Record<TabKey, number>> = {
      today: 0, tomorrow: 1, withinWeek: 2, withinMonth: 8,
    };
    const offset = offsetMap[target];
    if (offset === undefined) return null;
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
  };

  const isDropAllowed = (target: TabKey) => {
    const from = draggedFromRef.current ?? draggedFrom;
    if (!from) return false;
    return (ALLOWED_DROPS[from] ?? []).includes(target);
  };

  const handleDragStart = (e: React.DragEvent, task: Task, fromTab: TabKey) => {
    if (isMobile()) return;
    draggedTaskRef.current = task;
    draggedFromRef.current = fromTab;
    setDraggedTask(task);
    setDraggedFrom(fromTab);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
  };

  const handleDragOver = (e: React.DragEvent, target: TabKey) => {
    if (!isDropAllowed(target)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverTarget(target);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, dropTarget: TabKey) => {
    e.preventDefault();
    setDragOverTarget(null);

    const task = draggedTaskRef.current ?? draggedTask;
    const from = draggedFromRef.current ?? draggedFrom;
    if (!task || !from) return;
    if (!(ALLOWED_DROPS[from] ?? []).includes(dropTarget)) {
      draggedTaskRef.current = null;
      draggedFromRef.current = null;
      setDraggedTask(null);
      setDraggedFrom(null);
      return;
    }

    draggedTaskRef.current = null;
    draggedFromRef.current = null;
    setDraggedTask(null);
    setDraggedFrom(null);

    // 進行中の fetchTasks があれば、その応答が後で楽観的更新を上書きするのを防ぐため
    // 世代番号をインクリメントして無効化する
    taskOpGenerationRef.current++;
    dragInFlightRef.current += 1;

    const finalizeDragSync = () => {
      dragInFlightRef.current -= 1;
      // 連続ドロップを 1 回の fetchTasks にコアレスする (Google Tasks API 負荷軽減 +
      // PATCH_A 完了後 PATCH_B 完了前に GET が走って B が一瞬戻る現象を防止)
      if (dragInFlightRef.current === 0) {
        fetchTasks();
      }
    };

    // 楽観的更新: 元バケットから即時除去し、移動先バケットに即時追加
    const removeFromBucket = (tab: TabKey) => {
      switch (tab) {
        case "expired":     setExpiredTasks((p) => p.filter((t) => t.id !== task.id)); break;
        case "today":       setIncompleteTasks((p) => p.filter((t) => t.id !== task.id)); break;
        case "tomorrow":    setTomorrowTasks((p) => p.filter((t) => t.id !== task.id)); break;
        case "completed":   setCompletedTasks((p) => p.filter((t) => t.id !== task.id)); break;
        case "withinWeek":  setFutureTasks((p) => ({ ...p, withinWeek: p.withinWeek.filter((t) => t.id !== task.id) })); break;
        case "withinMonth": setFutureTasks((p) => ({ ...p, withinMonth: p.withinMonth.filter((t) => t.id !== task.id) })); break;
        case "noDeadline":  setFutureTasks((p) => ({ ...p, noDeadline: p.noDeadline.filter((t) => t.id !== task.id) })); break;
      }
    };

    removeFromBucket(from);

    if (dropTarget === "completed") {
      const updatedTask: Task = { ...task, status: "completed" };
      setCompletedTasks((p) => (p.some((t) => t.id === task.id) ? p : [updatedTask, ...p]));

      try {
        const res = await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, listId: task.listId, status: "completed" }),
        });
        if (!res.ok) throw new Error("更新に失敗しました");

        addTaskHistoryItem(
          "complete",
          task.id,
          task.title,
          { ...task, status: "needsAction" },
          updatedTask
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        finalizeDragSync();
      }
    } else {
      const newDue = getDueDateForCategory(dropTarget) ?? "";
      const updatedTask: Task = { ...task, due: newDue };

      const addToBucket = (tab: TabKey) => {
        switch (tab) {
          case "today":       setIncompleteTasks((p) => (p.some((t) => t.id === task.id) ? p : [updatedTask, ...p])); break;
          case "tomorrow":    setTomorrowTasks((p) => (p.some((t) => t.id === task.id) ? p : [updatedTask, ...p])); break;
          case "withinWeek":  setFutureTasks((p) => ({ ...p, withinWeek: p.withinWeek.some((t) => t.id === task.id) ? p.withinWeek : [updatedTask, ...p.withinWeek] })); break;
          case "withinMonth": setFutureTasks((p) => ({ ...p, withinMonth: p.withinMonth.some((t) => t.id === task.id) ? p.withinMonth : [updatedTask, ...p.withinMonth] })); break;
          case "noDeadline":  setFutureTasks((p) => ({ ...p, noDeadline: p.noDeadline.some((t) => t.id === task.id) ? p.noDeadline : [updatedTask, ...p.noDeadline] })); break;
        }
      };

      addToBucket(dropTarget);

      try {
        const res = await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, listId: task.listId, due: newDue }),
        });
        if (!res.ok) throw new Error("期限の変更に失敗しました");

        addTaskHistoryItem("changeDue", task.id, task.title, { ...task }, updatedTask);
      } catch (err) {
        setError(err instanceof Error ? err.message : "エラーが発生しました");
      } finally {
        finalizeDragSync();
      }
    }
  };

  const handleDragEnd = () => {
    draggedTaskRef.current = null;
    draggedFromRef.current = null;
    setDraggedTask(null);
    setDraggedFrom(null);
    setDragOverTarget(null);
  };

  // モバイル端末検出
  const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  };

  // タスク詳細表示ハンドラー
  const handleTaskClick = (task: Task, event: React.MouseEvent) => {
    // モバイルでは長押しで詳細表示するため、通常クリックでは何もしない
    if (isMobile() || !task.notes) return;

    // 同じタスクをクリックした場合は吹き出しを閉じる
    if (selectedTask?.id === task.id) {
      handleCloseDetail();
      return;
    }

    // デスクトップでタスクにnotesがある場合は詳細を表示
    const rect = event.currentTarget.getBoundingClientRect();
    setDetailPosition({
      x: rect.right,
      y: rect.top + window.scrollY
    });
    setSelectedTask(task);
  };

  // モバイル長押しハンドラー
  const handleTaskLongPress = (task: Task) => {
    if (!task.notes) return;
    setSelectedTask(task);
  };

  // タスクタッチハンドラー
  const handleTaskTouchStart = (task: Task, event: React.TouchEvent) => {
    if (!isMobile() || !task.notes) return;

    const timer = setTimeout(() => {
      handleTaskLongPress(task);
    }, 500); // 500ms長押しで詳細表示

    setLongPressTimer(timer);
  };

  const handleTaskTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTaskTouchMove = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // 詳細表示を閉じる
  const handleCloseDetail = () => {
    setSelectedTask(null);
    setDetailPosition(null);
  };

  // デスクトップでのマウスドラッグスクロール
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile()) return;

    // draggable なカード（またはその子要素）上で押下した場合は、
    // ネイティブ HTML5 ドラッグを優先するためスクロールドラッグを開始しない。
    // preventDefault() を呼ぶと dragstart が発火しなくなるため、ここで抜ける。
    const target = e.target as HTMLElement | null;
    if (target?.closest('[draggable="true"]')) return;

    const container = containerRef.current;
    if (!container) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setScrollStart({ left: container.scrollLeft, top: container.scrollTop });

    // カーソルを掴み状態に変更
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || isMobile()) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    // 横スクロールを実行
    container.scrollLeft = scrollStart.left - deltaX;
    container.scrollTop = scrollStart.top - deltaY;
    
    e.preventDefault();
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    setIsDragging(false);
    setDragStart(null);
    
    // カーソルを元に戻す
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
  };

  // グローバルマウスアップイベント（ドラッグ中にマウスがコンテナ外に出た場合）
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragStart || isMobile()) return;
      
      const container = containerRef.current;
      if (!container) return;
      
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      container.scrollLeft = scrollStart.left - deltaX;
      container.scrollTop = scrollStart.top - deltaY;
    };

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
    }

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [isDragging, dragStart, scrollStart]);

  // タスクメニューを外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showTaskMenu) {
        setShowTaskMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showTaskMenu]);

  // スワイプイベントハンドラー
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile()) return;
    
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile() || !touchStart) return;
    
    const touch = e.touches[0];
    setTouchEnd({ x: touch.clientX, y: touch.clientY });
    
    // 水平方向のスワイプ距離をチェック
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    
    // 水平スワイプが垂直スワイプより大きい場合のみスワイプとして認識
    if (deltaX > 20 && deltaX > deltaY) {
      setIsSwiping(true);
      e.preventDefault(); // スクロールを防ぐ
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile() || !touchStart || !touchEnd || !isSwiping) {
      setTouchStart(null);
      setTouchEnd(null);
      setIsSwiping(false);
      return;
    }

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = Math.abs(touchEnd.y - touchStart.y);
    
    // 最小スワイプ距離と垂直方向の許容量をチェック
    const minSwipeDistance = 50;
    const maxVerticalDistance = 100;
    
    if (Math.abs(deltaX) > minSwipeDistance && deltaY < maxVerticalDistance) {
      const currentIndex = tabOrder.indexOf(activeTab);
      
      if (deltaX > 0 && currentIndex > 0) {
        // 右スワイプ：前のタブに移動
        setActiveTab(tabOrder[currentIndex - 1]);
      } else if (deltaX < 0 && currentIndex < tabOrder.length - 1) {
        // 左スワイプ：次のタブに移動
        setActiveTab(tabOrder[currentIndex + 1]);
      }
    }
    
    setTouchStart(null);
    setTouchEnd(null);
    setIsSwiping(false);
  };

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <input
        ref={datePickerRef}
        type="date"
        style={{
          position: 'fixed',
          left: datePickerPos.x,
          top: datePickerPos.y,
          opacity: 0,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
        onChange={(e) => {
          if (datePickerTask && e.target.value) {
            changeDueDate(datePickerTask, e.target.value + "T00:00:00.000Z");
          }
          setDatePickerTask(null);
        }}
        onBlur={() => setDatePickerTask(null)}
      />
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="w-full mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">今日のタスク</h1>
            <p className="text-sm text-gray-500">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* タスク追加ボタン */}
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              aria-label="タスク追加"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">タスク追加</span>
            </button>
            {/* 履歴ボタン */}
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 transition-colors"
              aria-label="操作履歴"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="hidden sm:inline">履歴</span>
            </button>
            {/* デスクトップ: 設定ボタン（歯車アイコン＋テキスト） */}
            <button
              onClick={() => setShowSettings(true)}
              className="hidden lg:flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              設定
            </button>
            {/* 更新ボタン: モバイルはアイコンのみ、デスクトップはテキスト */}
            <button
              onClick={fetchTasks}
              disabled={loading}
              className="flex items-center justify-center text-blue-600 hover:text-blue-800 disabled:opacity-50"
              aria-label="更新"
            >
              <svg className={`w-5 h-5 lg:hidden ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden lg:inline text-sm">{loading ? "更新中..." : "更新"}</span>
            </button>
            {/* ユーザー名＋ログアウト: モバイルは縦並び、デスクトップは横並び */}
            {user && settings.showUserName && (
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name || "ユーザー"}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <div className="flex flex-col lg:flex-row lg:items-center lg:gap-2">
                  <span className="text-sm text-gray-700 font-medium leading-tight">
                    {user.name || user.email}
                  </span>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="text-xs lg:text-sm text-gray-500 hover:text-gray-700 text-left leading-tight"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            )}
            {!(user && settings.showUserName) && (
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ログアウト
              </button>
            )}
            {/* モバイル: ハンバーガーボタン（一番右） */}
            <button
              onClick={() => setShowSettings(true)}
              className="lg:hidden flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="設定"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 py-6 overflow-hidden">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && incompleteTasks.length === 0 && expiredTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">タスクを取得中...</div>
        ) : (
          <>
            {/* フィルターセット選択タブ（モバイル・複数ある場合のみ表示） */}
            {settings.taskFilterSets.length > 1 && (
              <div className="lg:hidden border-b border-gray-300 mb-4">
                <div className="flex overflow-x-auto">
                  {settings.taskFilterSets.map((filterSet) => (
                    <button
                      key={filterSet.id}
                      onClick={() => handleFilterSetChange(filterSet.id)}
                      className={`flex-shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                        selectedFilterSetId === filterSet.id
                          ? "border-green-500 text-green-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {filterSet.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* モバイルのみ: タブ */}
            <div className="flex lg:hidden border-b border-gray-200 mb-4 overflow-x-auto">
              {[
                { key: "expired" as TabKey, label: "期限切れ", count: filteredExpiredTasks.length },
                { key: "today" as TabKey, label: "本日", count: filteredIncompleteTasks.length },
                { key: "tomorrow" as TabKey, label: "明日", count: filteredTomorrowTasks.length },
                { key: "completed" as TabKey, label: "完了", count: filteredCompletedTasks.length },
                { key: "withinWeek" as TabKey, label: "一週間", count: filteredFutureTasks.withinWeek.length },
                { key: "withinMonth" as TabKey, label: "一ヶ月", count: filteredFutureTasks.withinMonth.length },
                { key: "noDeadline" as TabKey, label: "期限なし", count: filteredFutureTasks.noDeadline.length },
              ]
                .filter((tab) => settings.visibleLists[tab.key])
                .map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-shrink-0 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-blue-500 text-blue-600"
                        : "border-transparent text-gray-500"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 text-xs">({tab.count})</span>
                  </button>
                ))}
            </div>

            {/* モバイル: アクティブタブのみ表示 */}
            <div 
              ref={containerRef}
              className="lg:hidden"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {activeTab === "expired" && settings.visibleLists.expired && (
                <div>
                  <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
                    期限切れタスク <span className="font-normal text-red-400">({filteredExpiredTasks.length}件)</span>
                  </h2>
                  {filteredExpiredTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                      期限切れタスクがここに表示されます
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredExpiredTasks.map((task) => (
                        <TaskCard key={task.id} task={task} variant="expired"
                          isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "expired")}
                          onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                          onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                          onMenuToggle={() => toggleTaskMenu(task.id, "expired")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "today" && settings.visibleLists.today && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    本日の未完了タスク <span className="font-normal text-gray-400">({filteredIncompleteTasks.length}件)</span>
                  </h2>
                  {filteredIncompleteTasks.length === 0 && filteredExpiredTasks.length === 0 && filteredCompletedTasks.length === 0 ? (
                    <div className="text-center py-12"><div className="text-4xl mb-3">🎉</div><p className="text-gray-500">今日期限のタスクはありません</p></div>
                  ) : filteredIncompleteTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">すべて完了しました！</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredIncompleteTasks.map((task) => (
                        <TaskCard key={task.id} task={task} variant="today"
                          isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "today")}
                          onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                          onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                          onMenuToggle={() => toggleTaskMenu(task.id, "today")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "completed" && settings.visibleLists.completed && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    完了したタスク <span className="font-normal text-gray-400">({filteredCompletedTasks.length}件)</span>
                  </h2>
                  {filteredCompletedTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">完了したタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredCompletedTasks.map((task) => (
                        <TaskCard key={task.id} task={task} variant="completed"
                          isUncompleting={uncompleting.has(task.id)} isNewlyCompleted={newlyCompleted.has(task.id)}
                          onUncomplete={() => uncompleteTask(task)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "tomorrow" && settings.visibleLists.tomorrow && (
                <div>
                  <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
                    明日のタスク <span className="font-normal text-orange-400">({filteredTomorrowTasks.length}件)</span>
                  </h2>
                  {filteredTomorrowTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">明日期限のタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTomorrowTasks.map((task) => (
                        <TaskCard key={task.id} task={task} variant="tomorrow"
                          isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "tomorrow")}
                          onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                          onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                          onMenuToggle={() => toggleTaskMenu(task.id, "tomorrow")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "withinWeek" && settings.visibleLists.withinWeek && (
                <div>
                  <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">
                    一週間以内のタスク <span className="font-normal text-blue-400">({filteredFutureTasks.withinWeek.length}件)</span>
                  </h2>
                  {filteredFutureTasks.withinWeek.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">一週間以内のタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFutureTasks.withinWeek.map((task) => (
                        <TaskCard key={task.id} task={task} variant="withinWeek"
                          isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "withinWeek")}
                          onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                          onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                          onMenuToggle={() => toggleTaskMenu(task.id, "withinWeek")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "withinMonth" && settings.visibleLists.withinMonth && (
                <div>
                  <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
                    一ヶ月以内のタスク <span className="font-normal text-orange-400">({filteredFutureTasks.withinMonth.length}件)</span>
                  </h2>
                  {filteredFutureTasks.withinMonth.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">一ヶ月以内のタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFutureTasks.withinMonth.map((task) => (
                        <TaskCard key={task.id} task={task} variant="withinMonth"
                          isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "withinMonth")}
                          onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                          onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                          onMenuToggle={() => toggleTaskMenu(task.id, "withinMonth")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "noDeadline" && settings.visibleLists.noDeadline && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                    期限なしタスク <span className="font-normal text-gray-400">({filteredFutureTasks.noDeadline.length}件)</span>
                  </h2>
                  {filteredFutureTasks.noDeadline.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">期限なしのタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {filteredFutureTasks.noDeadline.map((task) => (
                        <TaskCard key={task.id} task={task} variant="noDeadline"
                          isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "noDeadline")}
                          onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                          onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                          onMenuToggle={() => toggleTaskMenu(task.id, "noDeadline")}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* フィルターセット選択タブ（デスクトップ・複数ある場合のみ表示） */}
            {settings.taskFilterSets.length > 1 && (
              <div className="hidden lg:block border-b border-gray-300 mb-6">
                <div className="flex overflow-x-auto">
                  {settings.taskFilterSets.map((filterSet) => (
                    <button
                      key={filterSet.id}
                      onClick={() => handleFilterSetChange(filterSet.id)}
                      className={`flex-shrink-0 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                        selectedFilterSetId === filterSet.id
                          ? "border-green-500 text-green-600"
                          : "border-transparent text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {filterSet.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* デスクトップ: 動的カラム数 */}
            <div 
              ref={containerRef}
              className={`hidden lg:grid gap-4 overflow-x-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`} 
              style={{ 
                gridTemplateColumns: `repeat(${Object.values(settings.visibleLists).filter(Boolean).length || 1}, minmax(280px, 1fr))` 
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              {/* 期限切れカラム */}
              {settings.visibleLists.expired && (
              <div>
                <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
                  期限切れタスク{" "}
                  <span className="font-normal text-red-400">
                    ({filteredExpiredTasks.length}件)
                  </span>
                </h2>
                {filteredExpiredTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    期限切れタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredExpiredTasks.map((task) => (
                      <TaskCard key={task.id} task={task} variant="expired"
                        isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "expired")}
                        draggable={!isMobile()} onDragStart={(e) => handleDragStart(e, task, "expired")} onDragEnd={handleDragEnd}
                        onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                        onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                        onMenuToggle={() => toggleTaskMenu(task.id, "expired")}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* 完了カラム */}
              {settings.visibleLists.completed && (
              <div
                onDragOver={(e) => handleDragOver(e, "completed")}
                onDrop={(e) => handleDrop(e, "completed")}
                onDragLeave={handleDragLeave}
                className={dragOverTarget === "completed" && isDropAllowed("completed") ? "ring-2 ring-green-400 rounded-lg" : ""}
              >
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  完了したタスク{" "}
                  <span className="font-normal text-gray-400">
                    ({filteredCompletedTasks.length}件)
                  </span>
                </h2>
                {filteredCompletedTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    完了したタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCompletedTasks.map((task) => (
                      <TaskCard key={task.id} task={task} variant="completed"
                        isUncompleting={uncompleting.has(task.id)} isNewlyCompleted={newlyCompleted.has(task.id)}
                        onUncomplete={() => uncompleteTask(task)}
                        onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* 未完了カラム */}
              {settings.visibleLists.today && (
              <div
                onDragOver={(e) => handleDragOver(e, "today")}
                onDrop={(e) => handleDrop(e, "today")}
                onDragLeave={handleDragLeave}
                className={dragOverTarget === "today" && isDropAllowed("today") ? "ring-2 ring-gray-400 rounded-lg" : ""}
              >
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  本日の未完了タスク{" "}
                  <span className="font-normal text-gray-400">
                    ({filteredIncompleteTasks.length}件)
                  </span>
                </h2>
                {filteredIncompleteTasks.length === 0 && filteredExpiredTasks.length === 0 && filteredCompletedTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🎉</div>
                    <p className="text-gray-500">今日期限のタスクはありません</p>
                  </div>
                ) : filteredIncompleteTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    すべて完了しました！
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredIncompleteTasks.map((task) => (
                      <TaskCard key={task.id} task={task} variant="today"
                        isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "today")}
                        draggable={!isMobile()} onDragStart={(e) => handleDragStart(e, task, "today")} onDragEnd={handleDragEnd}
                        onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                        onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                        onMenuToggle={() => toggleTaskMenu(task.id, "today")}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* 明日のタスクカラム */}
              {settings.visibleLists.tomorrow && (
              <div
                onDragOver={(e) => handleDragOver(e, "tomorrow")}
                onDrop={(e) => handleDrop(e, "tomorrow")}
                onDragLeave={handleDragLeave}
                className={dragOverTarget === "tomorrow" && isDropAllowed("tomorrow") ? "ring-2 ring-orange-400 rounded-lg" : ""}
              >
                <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
                  明日のタスク{" "}
                  <span className="font-normal text-orange-400">
                    ({filteredTomorrowTasks.length}件)
                  </span>
                </h2>
                {filteredTomorrowTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    明日期限のタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTomorrowTasks.map((task) => (
                      <TaskCard key={task.id} task={task} variant="tomorrow"
                        isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "tomorrow")}
                        draggable={!isMobile()} onDragStart={(e) => handleDragStart(e, task, "tomorrow")} onDragEnd={handleDragEnd}
                        onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                        onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                        onMenuToggle={() => toggleTaskMenu(task.id, "tomorrow")}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}


              {/* 一週間以内カラム */}
              {settings.visibleLists.withinWeek && (
              <div
                onDragOver={(e) => handleDragOver(e, "withinWeek")}
                onDrop={(e) => handleDrop(e, "withinWeek")}
                onDragLeave={handleDragLeave}
                className={dragOverTarget === "withinWeek" && isDropAllowed("withinWeek") ? "ring-2 ring-blue-400 rounded-lg" : ""}
              >
                <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">
                  一週間以内{" "}
                  <span className="font-normal text-blue-400">
                    ({filteredFutureTasks.withinWeek.length}件)
                  </span>
                </h2>
                {filteredFutureTasks.withinWeek.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    一週間以内のタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFutureTasks.withinWeek.map((task) => (
                      <TaskCard key={task.id} task={task} variant="withinWeek"
                        isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "withinWeek")}
                        draggable={!isMobile()} onDragStart={(e) => handleDragStart(e, task, "withinWeek")} onDragEnd={handleDragEnd}
                        onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                        onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                        onMenuToggle={() => toggleTaskMenu(task.id, "withinWeek")}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* 一ヶ月以内カラム */}
              {settings.visibleLists.withinMonth && (
              <div
                onDragOver={(e) => handleDragOver(e, "withinMonth")}
                onDrop={(e) => handleDrop(e, "withinMonth")}
                onDragLeave={handleDragLeave}
                className={dragOverTarget === "withinMonth" && isDropAllowed("withinMonth") ? "ring-2 ring-orange-400 rounded-lg" : ""}
              >
                <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
                  一ヶ月以内{" "}
                  <span className="font-normal text-orange-400">
                    ({filteredFutureTasks.withinMonth.length}件)
                  </span>
                </h2>
                {filteredFutureTasks.withinMonth.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    一ヶ月以内のタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFutureTasks.withinMonth.map((task) => (
                      <TaskCard key={task.id} task={task} variant="withinMonth"
                        isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "withinMonth")}
                        draggable={!isMobile()} onDragStart={(e) => handleDragStart(e, task, "withinMonth")} onDragEnd={handleDragEnd}
                        onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                        onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                        onMenuToggle={() => toggleTaskMenu(task.id, "withinMonth")}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}

              {/* 期限なしカラム */}
              {settings.visibleLists.noDeadline && (
              <div
                onDragOver={(e) => handleDragOver(e, "noDeadline")}
                onDrop={(e) => handleDrop(e, "noDeadline")}
                onDragLeave={handleDragLeave}
                className={dragOverTarget === "noDeadline" && isDropAllowed("noDeadline") ? "ring-2 ring-gray-400 rounded-lg" : ""}
              >
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  期限なし{" "}
                  <span className="font-normal text-gray-400">
                    ({filteredFutureTasks.noDeadline.length}件)
                  </span>
                </h2>
                {filteredFutureTasks.noDeadline.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    期限なしのタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFutureTasks.noDeadline.map((task) => (
                      <TaskCard key={task.id} task={task} variant="noDeadline"
                        isCompleting={completing.has(task.id)} isChangingDue={changingDue.has(task.id)} isMenuOpen={isTaskMenuOpen(task.id, "noDeadline")}
                        draggable={!isMobile()} onDragStart={(e) => handleDragStart(e, task, "noDeadline")} onDragEnd={handleDragEnd}
                        onComplete={() => completeTask(task)} onEdit={() => { setEditingTask(task); setShowTaskMenu(null); }} onDelete={() => deleteTask(task)} onDatePickerOpen={(e) => openDatePicker(task, e)}
                        onClick={(e) => handleTaskClick(task, e)} onTouchStart={(e) => handleTaskTouchStart(task, e)} onTouchEnd={handleTaskTouchEnd} onTouchMove={handleTaskTouchMove}
                        onMenuToggle={() => toggleTaskMenu(task.id, "noDeadline")}
                      />
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>
          </>
        )}
      </main>
      
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => {
          setShowSettings(false);
          refreshSettings();
        }}
        allTasks={[
          ...incompleteTasks,
          ...expiredTasks,
          ...completedTasks,
          ...tomorrowTasks,
          ...futureTasks.withinWeek,
          ...futureTasks.withinMonth,
          ...futureTasks.noDeadline,
        ]}
      />
      
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          isVisible={!!selectedTask}
          position={detailPosition || undefined}
          onClose={handleCloseDetail}
          isMobile={isMobile()}
        />
      )}
      
      <TaskEditModal 
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={updateTask}
      />
      
      <TaskAddModal 
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onAdd={addTask}
        taskLists={taskLists}
        filteredTaskLists={filteredTaskListsForCurrentTab}
      />

      <TaskHistoryModal 
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onUndo={handleUndo}
      />

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-xs w-full p-6">
            <p className="text-gray-800 text-sm mb-6">ログアウトしますか？</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                キャンセル
              </button>
              <button
                onClick={() => signOut()}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 日付変更検出 */}
      <DateChangeDetector 
        onDateChange={handleDateChange}
        isEnabled={!showDateChangePopup && !isDateChangeUpdating}
      />

      {/* 日付変更ポップアップ */}
      <DateChangePopup 
        isOpen={showDateChangePopup}
        onConfirm={handleDateChangeConfirm}
        isUpdating={isDateChangeUpdating}
      />
    </div>
  );
}
