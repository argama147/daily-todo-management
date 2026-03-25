"use client";

import { signOut } from "next-auth/react";
import { useState, useCallback } from "react";
import type { Task } from "@/lib/tasks";
import type { User } from "next-auth";

type Props = {
  initialTasks: Task[];
  initialExpiredTasks: Task[];
  initialCompletedTasks?: Task[];
  initialFutureTasks?: {
    withinWeek: Task[];
    withinMonth: Task[];
    longTerm: Task[];
    noDeadline: Task[];
  };
  user?: User;
};

export default function TaskList({ initialTasks, initialExpiredTasks, initialCompletedTasks, initialFutureTasks, user }: Props) {
  const [incompleteTasks, setIncompleteTasks] = useState<Task[]>(initialTasks);
  const [expiredTasks, setExpiredTasks] = useState<Task[]>(initialExpiredTasks);
  const [completedTasks, setCompletedTasks] = useState<Task[]>(initialCompletedTasks ?? []);
  const [futureTasks, setFutureTasks] = useState<{
    withinWeek: Task[];
    withinMonth: Task[];
    longTerm: Task[];
    noDeadline: Task[];
  }>(initialFutureTasks ?? { withinWeek: [], withinMonth: [], longTerm: [], noDeadline: [] });
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [uncompleting, setUncompleting] = useState<Set<string>>(new Set());
  const [newlyCompleted, setNewlyCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  type TabKey = "expired" | "today" | "completed" | "withinWeek" | "withinMonth" | "longTerm" | "noDeadline";
  const [activeTab, setActiveTab] = useState<TabKey>("today");
  const [changingDue, setChangingDue] = useState<Set<string>>(new Set());
  const [showDatePicker, setShowDatePicker] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "タスクの取得に失敗しました");
      }
      const data = await res.json();
      setIncompleteTasks(data.todayTasks ?? []);
      setExpiredTasks(data.expiredTasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const completeTask = async (task: Task) => {
    setCompleting((prev) => new Set(prev).add(task.id));

    const patchPromise = fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, listId: task.listId }),
    });

    setTimeout(() => {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setIncompleteTasks((prev) => prev.filter((t) => t.id !== task.id));
      setExpiredTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCompletedTasks((prev) => [task, ...prev]);
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

      const syncRes = await fetch("/api/tasks");
      if (syncRes.ok) {
        const data = await syncRes.json();
        setIncompleteTasks(data.todayTasks);
        setExpiredTasks(data.expiredTasks);
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

    setTimeout(() => {
      setUncompleting((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
      
      // Add back to appropriate list based on due date
      const isExpired = new Date(task.due).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
      if (isExpired) {
        setExpiredTasks((prev) => [task, ...prev]);
      } else {
        setIncompleteTasks((prev) => [task, ...prev]);
      }
    }, 300);

    try {
      const res = await patchPromise;
      if (!res.ok) throw new Error("更新に失敗しました");

      const syncRes = await fetch("/api/tasks");
      if (syncRes.ok) {
        const data = await syncRes.json();
        setIncompleteTasks(data.todayTasks);
        setExpiredTasks(data.expiredTasks);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      // On error, restore task to completed list
      setCompletedTasks((prev) => [task, ...prev]);
      const isExpired = new Date(task.due).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
      if (isExpired) {
        setExpiredTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setIncompleteTasks((prev) => prev.filter((t) => t.id !== task.id));
      }
    }
  };

  const changeDueDate = async (task: Task, newDue: string) => {
    setChangingDue((prev) => new Set(prev).add(task.id));
    setShowDatePicker(null);

    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, listId: task.listId, due: newDue }),
      });

      if (!res.ok) throw new Error("期限の変更に失敗しました");

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

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">今日のタスク</h1>
            <p className="text-sm text-gray-500">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchTasks}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading ? "更新中..." : "更新"}
            </button>
            {user && (
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name || "ユーザー"}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700 font-medium">
                  {user.name || user.email}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && incompleteTasks.length === 0 && expiredTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">タスクを取得中...</div>
        ) : (
          <>
            {/* モバイルのみ: タブ */}
            <div className="flex lg:hidden border-b border-gray-200 mb-4 overflow-x-auto">
              {[
                { key: "expired" as TabKey, label: "期限切れ", count: expiredTasks.length },
                { key: "today" as TabKey, label: "本日", count: incompleteTasks.length },
                { key: "completed" as TabKey, label: "完了", count: completedTasks.length },
                { key: "withinWeek" as TabKey, label: "一週間", count: futureTasks.withinWeek.length },
                { key: "withinMonth" as TabKey, label: "一ヶ月", count: futureTasks.withinMonth.length },
                { key: "longTerm" as TabKey, label: "長期", count: futureTasks.longTerm.length },
                { key: "noDeadline" as TabKey, label: "期限なし", count: futureTasks.noDeadline.length },
              ].map((tab) => (
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
            <div className="lg:hidden">
              {activeTab === "expired" && (
                <div>
                  <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
                    期限切れタスク <span className="font-normal text-red-400">({expiredTasks.length}件)</span>
                  </h2>
                  {expiredTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                      期限切れタスクがここに表示されます
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {expiredTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 shadow-sm"
                          style={completing.has(task.id) ? { animation: "fadeOut 300ms forwards" } : undefined}
                        >
                          <button onClick={() => completeTask(task)} disabled={completing.has(task.id)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-red-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="完了にする" />
                          <div className="flex-1 min-w-0">
                            <p className="text-red-800 font-medium leading-snug break-words">{task.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="text-xs text-red-500 bg-red-100 rounded px-2 py-0.5">{task.listTitle}</span>
                              <span className="text-xs text-red-600 bg-red-200 rounded px-2 py-0.5 font-medium">
                                期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                                ({(() => { const t = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }); const d = Math.ceil((new Date(t).getTime() - new Date(task.due.slice(0, 10)).getTime()) / 86400000); return `${d}日経過`; })()})
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {showDatePicker === task.id ? (
                              <input
                                type="date"
                                defaultValue={task.due.slice(0, 10)}
                                onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                                onBlur={() => setShowDatePicker(null)}
                                className="text-xs p-1 border rounded"
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={() => setShowDatePicker(task.id)}
                                disabled={changingDue.has(task.id)}
                                className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="期限変更"
                              >
                                {changingDue.has(task.id) ? "..." : "︙"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "today" && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    本日の未完了タスク <span className="font-normal text-gray-400">({incompleteTasks.length}件)</span>
                  </h2>
                  {incompleteTasks.length === 0 && expiredTasks.length === 0 && completedTasks.length === 0 ? (
                    <div className="text-center py-12"><div className="text-4xl mb-3">🎉</div><p className="text-gray-500">今日期限のタスクはありません</p></div>
                  ) : incompleteTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">すべて完了しました！</div>
                  ) : (
                    <div className="space-y-2">
                      {incompleteTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"
                          style={completing.has(task.id) ? { animation: "fadeOut 300ms forwards" } : undefined}
                        >
                          <button onClick={() => completeTask(task)} disabled={completing.has(task.id)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="完了にする" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-800 font-medium leading-snug break-words">{task.title}</p>
                            <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">{task.listTitle}</span>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {showDatePicker === task.id ? (
                              <input
                                type="date"
                                defaultValue={new Date().toISOString().split('T')[0]}
                                onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                                onBlur={() => setShowDatePicker(null)}
                                className="text-xs p-1 border rounded"
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={() => setShowDatePicker(task.id)}
                                disabled={changingDue.has(task.id)}
                                className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="期限変更"
                              >
                                {changingDue.has(task.id) ? "..." : "︙"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "completed" && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    完了したタスク <span className="font-normal text-gray-400">({completedTasks.length}件)</span>
                  </h2>
                  {completedTasks.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">完了したタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {completedTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 shadow-sm opacity-80"
                          style={newlyCompleted.has(task.id) ? { animation: "slideInFromTop 300ms ease-out" } : uncompleting.has(task.id) ? { animation: "fadeOut 300ms forwards" } : undefined}
                        >
                          <button onClick={() => uncompleteTask(task)} disabled={uncompleting.has(task.id)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 hover:bg-gray-300 hover:border-2 hover:border-gray-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="未完了にする">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-500 font-medium leading-snug line-through break-words">{task.title}</p>
                            <span className="inline-block mt-1 text-xs text-gray-400 bg-green-100 rounded px-2 py-0.5">{task.listTitle}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "withinWeek" && (
                <div>
                  <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">
                    一週間以内のタスク <span className="font-normal text-blue-400">({futureTasks.withinWeek.length}件)</span>
                  </h2>
                  {futureTasks.withinWeek.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">一週間以内のタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {futureTasks.withinWeek.map((task) => (
                        <div key={task.id} className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 shadow-sm" style={completing.has(task.id) ? { animation: "fadeOut 300ms forwards" } : undefined}>
                          <button onClick={() => completeTask(task)} disabled={completing.has(task.id)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="完了にする" />
                          <div className="flex-1 min-w-0">
                            <p className="text-blue-800 font-medium leading-snug break-words">{task.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="text-xs text-blue-500 bg-blue-100 rounded px-2 py-0.5">{task.listTitle}</span>
                              <span className="text-xs text-blue-600 bg-blue-200 rounded px-2 py-0.5 font-medium">
                                期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {showDatePicker === task.id ? (
                              <input type="date" defaultValue={task.due.slice(0, 10)} onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")} onBlur={() => setShowDatePicker(null)} className="text-xs p-1 border rounded" autoFocus />
                            ) : (
                              <button onClick={() => setShowDatePicker(task.id)} disabled={changingDue.has(task.id)} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                {changingDue.has(task.id) ? "..." : "︙"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "withinMonth" && (
                <div>
                  <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
                    一ヶ月以内のタスク <span className="font-normal text-orange-400">({futureTasks.withinMonth.length}件)</span>
                  </h2>
                  {futureTasks.withinMonth.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">一ヶ月以内のタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {futureTasks.withinMonth.map((task) => (
                        <div key={task.id} className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 shadow-sm" style={completing.has(task.id) ? { animation: "fadeOut 300ms forwards" } : undefined}>
                          <button onClick={() => completeTask(task)} disabled={completing.has(task.id)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-orange-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="完了にする" />
                          <div className="flex-1 min-w-0">
                            <p className="text-orange-800 font-medium leading-snug break-words">{task.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="text-xs text-orange-500 bg-orange-100 rounded px-2 py-0.5">{task.listTitle}</span>
                              <span className="text-xs text-orange-600 bg-orange-200 rounded px-2 py-0.5 font-medium">
                                期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {showDatePicker === task.id ? (
                              <input type="date" defaultValue={task.due.slice(0, 10)} onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")} onBlur={() => setShowDatePicker(null)} className="text-xs p-1 border rounded" autoFocus />
                            ) : (
                              <button onClick={() => setShowDatePicker(task.id)} disabled={changingDue.has(task.id)} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                {changingDue.has(task.id) ? "..." : "︙"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "longTerm" && (
                <div>
                  <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wide mb-3">
                    長期タスク <span className="font-normal text-purple-400">({futureTasks.longTerm.length}件)</span>
                  </h2>
                  {futureTasks.longTerm.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">長期タスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {futureTasks.longTerm.map((task) => (
                        <div key={task.id} className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 shadow-sm" style={completing.has(task.id) ? { animation: "fadeOut 300ms forwards" } : undefined}>
                          <button onClick={() => completeTask(task)} disabled={completing.has(task.id)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-purple-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="完了にする" />
                          <div className="flex-1 min-w-0">
                            <p className="text-purple-800 font-medium leading-snug break-words">{task.title}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="text-xs text-purple-500 bg-purple-100 rounded px-2 py-0.5">{task.listTitle}</span>
                              <span className="text-xs text-purple-600 bg-purple-200 rounded px-2 py-0.5 font-medium">
                                期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                              </span>
                            </div>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {showDatePicker === task.id ? (
                              <input type="date" defaultValue={task.due.slice(0, 10)} onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")} onBlur={() => setShowDatePicker(null)} className="text-xs p-1 border rounded" autoFocus />
                            ) : (
                              <button onClick={() => setShowDatePicker(task.id)} disabled={changingDue.has(task.id)} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                {changingDue.has(task.id) ? "..." : "︙"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === "noDeadline" && (
                <div>
                  <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                    期限なしタスク <span className="font-normal text-gray-400">({futureTasks.noDeadline.length}件)</span>
                  </h2>
                  {futureTasks.noDeadline.length === 0 ? (
                    <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">期限なしのタスクがここに表示されます</div>
                  ) : (
                    <div className="space-y-2">
                      {futureTasks.noDeadline.map((task) => (
                        <div key={task.id} className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 shadow-sm" style={completing.has(task.id) ? { animation: "fadeOut 300ms forwards" } : undefined}>
                          <button onClick={() => completeTask(task)} disabled={completing.has(task.id)} className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="完了にする" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-800 font-medium leading-snug break-words">{task.title}</p>
                            <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">{task.listTitle}</span>
                          </div>
                          <div className="flex-shrink-0 ml-2">
                            {showDatePicker === task.id ? (
                              <input type="date" defaultValue={new Date().toISOString().split('T')[0]} onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")} onBlur={() => setShowDatePicker(null)} className="text-xs p-1 border rounded" autoFocus />
                            ) : (
                              <button onClick={() => setShowDatePicker(task.id)} disabled={changingDue.has(task.id)} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed">
                                {changingDue.has(task.id) ? "..." : "︙"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* デスクトップ: 7カラム並列 */}
            <div className="hidden lg:grid grid-cols-7 gap-4">
              {/* 期限切れカラム */}
              <div>
                <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
                  期限切れタスク{" "}
                  <span className="font-normal text-red-400">
                    ({expiredTasks.length}件)
                  </span>
                </h2>
                {expiredTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    期限切れタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expiredTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 shadow-sm"
                        style={
                          completing.has(task.id)
                            ? { animation: "fadeOut 300ms forwards" }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => completeTask(task)}
                          disabled={completing.has(task.id)}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-red-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="完了にする"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-red-800 font-medium leading-snug break-words">
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-xs text-red-500 bg-red-100 rounded px-2 py-0.5">
                              {task.listTitle}
                            </span>
                            <span className="text-xs text-red-600 bg-red-200 rounded px-2 py-0.5 font-medium">
                              期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                              ({(() => {
                                const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
                                const taskDate = task.due.slice(0, 10);
                                const diffTime = new Date(todayStr).getTime() - new Date(taskDate).getTime();
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                return `${diffDays}日経過`;
                              })()})
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {showDatePicker === task.id ? (
                            <input
                              type="date"
                              defaultValue={task.due.slice(0, 10)}
                              onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                              onBlur={() => setShowDatePicker(null)}
                              className="text-xs p-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setShowDatePicker(task.id)}
                              disabled={changingDue.has(task.id)}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="期限変更"
                            >
                              {changingDue.has(task.id) ? "..." : "︙"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 未完了カラム */}
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  本日の未完了タスク{" "}
                  <span className="font-normal text-gray-400">
                    ({incompleteTasks.length}件)
                  </span>
                </h2>
                {incompleteTasks.length === 0 && expiredTasks.length === 0 && completedTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🎉</div>
                    <p className="text-gray-500">今日期限のタスクはありません</p>
                  </div>
                ) : incompleteTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    すべて完了しました！
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incompleteTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"
                        style={
                          completing.has(task.id)
                            ? { animation: "fadeOut 300ms forwards" }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => completeTask(task)}
                          disabled={completing.has(task.id)}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="完了にする"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800 font-medium leading-snug break-words">
                            {task.title}
                          </p>
                          <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                            {task.listTitle}
                          </span>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {showDatePicker === task.id ? (
                            <input
                              type="date"
                              defaultValue={new Date().toISOString().split('T')[0]}
                              onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                              onBlur={() => setShowDatePicker(null)}
                              className="text-xs p-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setShowDatePicker(task.id)}
                              disabled={changingDue.has(task.id)}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="期限変更"
                            >
                              {changingDue.has(task.id) ? "..." : "︙"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 完了カラム */}
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  完了したタスク{" "}
                  <span className="font-normal text-gray-400">
                    ({completedTasks.length}件)
                  </span>
                </h2>
                {completedTasks.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    完了したタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {completedTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 shadow-sm opacity-80"
                        style={
                          newlyCompleted.has(task.id)
                            ? { animation: "slideInFromTop 300ms ease-out" }
                            : uncompleting.has(task.id)
                            ? { animation: "fadeOut 300ms forwards" }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => uncompleteTask(task)}
                          disabled={uncompleting.has(task.id)}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 hover:bg-gray-300 hover:border-2 hover:border-gray-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="未完了にする"
                        >
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-500 font-medium leading-snug line-through break-words">
                            {task.title}
                          </p>
                          <span className="inline-block mt-1 text-xs text-gray-400 bg-green-100 rounded px-2 py-0.5">
                            {task.listTitle}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 一週間以内カラム */}
              <div>
                <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">
                  一週間以内{" "}
                  <span className="font-normal text-blue-400">
                    ({futureTasks.withinWeek.length}件)
                  </span>
                </h2>
                {futureTasks.withinWeek.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    一週間以内のタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {futureTasks.withinWeek.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 shadow-sm"
                        style={
                          completing.has(task.id)
                            ? { animation: "fadeOut 300ms forwards" }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => completeTask(task)}
                          disabled={completing.has(task.id)}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="完了にする"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-blue-800 font-medium leading-snug text-sm break-words">
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-xs text-blue-500 bg-blue-100 rounded px-2 py-0.5">
                              {task.listTitle}
                            </span>
                            <span className="text-xs text-blue-600 bg-blue-200 rounded px-2 py-0.5 font-medium">
                              {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {showDatePicker === task.id ? (
                            <input
                              type="date"
                              defaultValue={task.due.slice(0, 10)}
                              onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                              onBlur={() => setShowDatePicker(null)}
                              className="text-xs p-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setShowDatePicker(task.id)}
                              disabled={changingDue.has(task.id)}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="期限変更"
                            >
                              {changingDue.has(task.id) ? "..." : "︙"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 一ヶ月以内カラム */}
              <div>
                <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-3">
                  一ヶ月以内{" "}
                  <span className="font-normal text-orange-400">
                    ({futureTasks.withinMonth.length}件)
                  </span>
                </h2>
                {futureTasks.withinMonth.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    一ヶ月以内のタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {futureTasks.withinMonth.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 shadow-sm"
                        style={
                          completing.has(task.id)
                            ? { animation: "fadeOut 300ms forwards" }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => completeTask(task)}
                          disabled={completing.has(task.id)}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-orange-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="完了にする"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-orange-800 font-medium leading-snug text-sm break-words">
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-xs text-orange-500 bg-orange-100 rounded px-2 py-0.5">
                              {task.listTitle}
                            </span>
                            <span className="text-xs text-orange-600 bg-orange-200 rounded px-2 py-0.5 font-medium">
                              {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {showDatePicker === task.id ? (
                            <input
                              type="date"
                              defaultValue={task.due.slice(0, 10)}
                              onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                              onBlur={() => setShowDatePicker(null)}
                              className="text-xs p-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setShowDatePicker(task.id)}
                              disabled={changingDue.has(task.id)}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="期限変更"
                            >
                              {changingDue.has(task.id) ? "..." : "︙"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 長期カラム */}
              <div>
                <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wide mb-3">
                  長期{" "}
                  <span className="font-normal text-purple-400">
                    ({futureTasks.longTerm.length}件)
                  </span>
                </h2>
                {futureTasks.longTerm.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    長期タスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {futureTasks.longTerm.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 shadow-sm"
                        style={
                          completing.has(task.id)
                            ? { animation: "fadeOut 300ms forwards" }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => completeTask(task)}
                          disabled={completing.has(task.id)}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-purple-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="完了にする"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-purple-800 font-medium leading-snug text-sm break-words">
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-xs text-purple-500 bg-purple-100 rounded px-2 py-0.5">
                              {task.listTitle}
                            </span>
                            <span className="text-xs text-purple-600 bg-purple-200 rounded px-2 py-0.5 font-medium">
                              {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                            </span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {showDatePicker === task.id ? (
                            <input
                              type="date"
                              defaultValue={task.due.slice(0, 10)}
                              onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                              onBlur={() => setShowDatePicker(null)}
                              className="text-xs p-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setShowDatePicker(task.id)}
                              disabled={changingDue.has(task.id)}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="期限変更"
                            >
                              {changingDue.has(task.id) ? "..." : "︙"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 期限なしカラム */}
              <div>
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                  期限なし{" "}
                  <span className="font-normal text-gray-400">
                    ({futureTasks.noDeadline.length}件)
                  </span>
                </h2>
                {futureTasks.noDeadline.length === 0 ? (
                  <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                    期限なしのタスクがここに表示されます
                  </div>
                ) : (
                  <div className="space-y-2">
                    {futureTasks.noDeadline.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 shadow-sm"
                        style={
                          completing.has(task.id)
                            ? { animation: "fadeOut 300ms forwards" }
                            : undefined
                        }
                      >
                        <button
                          onClick={() => completeTask(task)}
                          disabled={completing.has(task.id)}
                          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="完了にする"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-800 font-medium leading-snug text-sm break-words">
                            {task.title}
                          </p>
                          <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                            {task.listTitle}
                          </span>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          {showDatePicker === task.id ? (
                            <input
                              type="date"
                              defaultValue={new Date().toISOString().split('T')[0]}
                              onChange={(e) => changeDueDate(task, e.target.value + "T00:00:00.000Z")}
                              onBlur={() => setShowDatePicker(null)}
                              className="text-xs p-1 border rounded"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => setShowDatePicker(task.id)}
                              disabled={changingDue.has(task.id)}
                              className="w-8 h-8 flex items-center justify-center text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="期限変更"
                            >
                              {changingDue.has(task.id) ? "..." : "︙"}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
